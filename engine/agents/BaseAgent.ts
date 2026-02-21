// ============================================================
// MULTI-AGENT RESEARCH SYSTEM — Base Agent
// Foundation class for all specialized research agents
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type {
  AnyAgentRole,
  AgentState,
  AgentStatus,
  AgentMetrics,
  ResearchFinding,
  ResearchPhase,
  CodeAnalysisPhase,
  TaskResult,
  ResearchTask,
  StreamEvent,
} from '../models/types';
import { MessageBus } from '../coordination/MessageBus';

export interface AgentConfig {
  role: AnyAgentRole;
  name: string;
  expertise: string;
  systemPrompt: string;
  model?: string;
  maxTokens?: number;
}

export type EventEmitFn = (event: StreamEvent) => void;

// Tool handler: receives tool input, returns tool result as string
export type ToolHandler = (toolName: string, toolInput: Record<string, unknown>) => Promise<string>;

export abstract class BaseAgent {
  protected client: Anthropic;
  protected config: AgentConfig;
  protected messageBus: MessageBus;
  protected state: AgentState;
  protected emitEvent: EventEmitFn;

  private startTime?: number;

  constructor(
    config: AgentConfig,
    messageBus: MessageBus,
    emitEvent: EventEmitFn
  ) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.config = {
      model: process.env.RESEARCH_MODEL || 'claude-opus-4-6',
      maxTokens: parseInt(process.env.RESEARCH_MAX_TOKENS || '12000', 10),
      ...config,
    };
    this.messageBus = messageBus;
    this.emitEvent = emitEvent;

    this.state = {
      role: config.role,
      status: 'idle',
      completedTasks: [],
      findings: [],
      metrics: {
        tasksCompleted: 0,
        tokensUsed: 0,
        thinkingTokens: 0,
        avgResponseTime: 0,
        qualityScore: 0,
      },
      lastUpdated: new Date(),
    };
  }

  get role(): AnyAgentRole {
    return this.config.role;
  }

  get name(): string {
    return this.config.name;
  }

  getState(): AgentState {
    return { ...this.state };
  }

  protected updateStatus(status: AgentStatus, currentTask?: string): void {
    this.state.status = status;
    if (currentTask !== undefined) {
      this.state.currentTask = currentTask;
    }
    this.state.lastUpdated = new Date();

    this.emitEvent({
      type: 'agent_update',
      sessionId: '',
      agentRole: this.config.role,
      data: {
        status,
        currentTask: this.state.currentTask,
        name: this.config.name,
        metrics: this.state.metrics,
      },
      timestamp: new Date(),
    });
  }

  protected createFinding(
    title: string,
    content: string,
    phase: ResearchPhase | CodeAnalysisPhase,
    confidence: number,
    evidence: string[] = [],
    tags: string[] = []
  ): ResearchFinding {
    const finding: ResearchFinding = {
      id: uuidv4(),
      agentRole: this.config.role,
      phase,
      title,
      content,
      confidence: Math.min(1, Math.max(0, confidence)),
      evidence,
      timestamp: new Date(),
      tags,
    };

    this.state.findings.push(finding);

    this.emitEvent({
      type: 'finding',
      sessionId: '',
      agentRole: this.config.role,
      data: { finding },
      timestamp: new Date(),
    });

    return finding;
  }

  // ─── Standard Claude Call (adaptive thinking, no tools) ───
  protected async callClaude(
    userMessage: string,
    additionalContext?: string,
    tools?: Anthropic.Tool[]
  ): Promise<{
    text: string;
    thinking: string;
    tokensUsed: number;
    thinkingTokens: number;
  }> {
    this.startTime = Date.now();
    this.updateStatus('thinking');

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: additionalContext
          ? `${additionalContext}\n\n---\n\n${userMessage}`
          : userMessage,
      },
    ];

    let fullText = '';
    let fullThinking = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const streamParams: any = {
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        thinking: { type: 'adaptive' }, // Opus 4.6 adaptive thinking
        system: this.config.systemPrompt,
        messages,
        ...(tools && tools.length > 0 ? { tools } : {}),
      };

      const stream = this.client.messages.stream(streamParams);

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'thinking_delta') {
            fullThinking += event.delta.thinking;
            this.emitEvent({
              type: 'thinking',
              sessionId: '',
              agentRole: this.config.role,
              data: { chunk: event.delta.thinking, agentName: this.config.name },
              timestamp: new Date(),
            });
          } else if (event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            this.emitEvent({
              type: 'text_delta',
              sessionId: '',
              agentRole: this.config.role,
              data: { chunk: event.delta.text, agentName: this.config.name },
              timestamp: new Date(),
            });
          }
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage?.output_tokens ?? 0;
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage?.input_tokens ?? 0;
        }
      }

      const duration = Date.now() - this.startTime;
      const totalTokens = inputTokens + outputTokens;

      this.state.metrics.tokensUsed += totalTokens;
      this.state.metrics.avgResponseTime =
        (this.state.metrics.avgResponseTime * this.state.metrics.tasksCompleted + duration) /
        (this.state.metrics.tasksCompleted + 1);

      return {
        text: fullText,
        thinking: fullThinking,
        tokensUsed: totalTokens,
        thinkingTokens: fullThinking.length > 0 ? Math.floor(fullThinking.length / 4) : 0,
      };
    } catch (error) {
      this.updateStatus('error', `Error: ${(error as Error).message}`);
      throw error;
    }
  }

  // ─── Agentic Tool Calling Loop ─────────────────────────────
  // Calls Claude in a loop, executing tools until Claude provides a final answer.
  // Uses non-streaming for the tool-call rounds (fast), streaming for the final answer.
  protected async callClaudeWithTools(
    userMessage: string,
    tools: Anthropic.Tool[],
    toolHandler: ToolHandler,
    additionalContext?: string,
    maxToolRounds = 5
  ): Promise<{
    text: string;
    thinking: string;
    tokensUsed: number;
    thinkingTokens: number;
    toolCallCount: number;
  }> {
    this.startTime = Date.now();
    this.updateStatus('working', 'Searching real databases...');

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: additionalContext
          ? `${additionalContext}\n\n---\n\n${userMessage}`
          : userMessage,
      },
    ];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let toolCallCount = 0;
    let finalText = '';
    let finalThinking = '';

    try {
      for (let round = 0; round < maxToolRounds; round++) {
        // Use non-streaming for tool rounds (faster, simpler)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestParams: any = {
          model: this.config.model!,
          max_tokens: this.config.maxTokens!,
          system: this.config.systemPrompt,
          messages,
          tools,
          tool_choice: round === 0 ? { type: 'auto' } : { type: 'auto' },
        };

        const response = await this.client.messages.create(requestParams);

        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;

        // Check if Claude wants to use tools
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        const textBlocks = response.content.filter(
          (b): b is Anthropic.TextBlock => b.type === 'text'
        );

        if (textBlocks.length > 0) {
          finalText += textBlocks.map((b) => b.text).join('');
        }

        if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
          // Claude is done — stream the final synthesis if not already streamed
          if (finalText.length === 0) {
            // Shouldn't happen but fallback
            break;
          }
          break;
        }

        // Claude wants to call tools
        // Add the assistant response to messages
        messages.push({ role: 'assistant', content: response.content });

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (toolBlock) => {
            toolCallCount++;

            // Emit tool_call event for real-time UI
            this.emitEvent({
              type: 'tool_call',
              sessionId: '',
              agentRole: this.config.role,
              data: {
                toolName: toolBlock.name,
                toolInput: toolBlock.input,
                agentName: this.config.name,
                round,
              },
              timestamp: new Date(),
            });

            const result = await toolHandler(
              toolBlock.name,
              toolBlock.input as Record<string, unknown>
            );

            // Emit tool_result event
            this.emitEvent({
              type: 'tool_result',
              sessionId: '',
              agentRole: this.config.role,
              data: {
                toolName: toolBlock.name,
                resultPreview: result.slice(0, 200),
                agentName: this.config.name,
              },
              timestamp: new Date(),
            });

            return {
              type: 'tool_result' as const,
              tool_use_id: toolBlock.id,
              content: result,
            };
          })
        );

        // Add tool results to messages for next round
        messages.push({ role: 'user', content: toolResults });

        this.updateStatus('working', `Analyzing ${toolCallCount} database results...`);
      }

      // Now do a final streaming call so the user sees the synthesis in real-time
      if (finalText.length > 0) {
        // We already have the final text from the non-streaming loop
        // Stream it character by character for UI consistency
        for (const char of finalText.split('')) {
          this.emitEvent({
            type: 'text_delta',
            sessionId: '',
            agentRole: this.config.role,
            data: { chunk: char, agentName: this.config.name },
            timestamp: new Date(),
          });
        }
      } else {
        // Last round didn't produce text — do a final call with streaming
        const stream = this.client.messages.stream({
          model: this.config.model!,
          max_tokens: this.config.maxTokens!,
          system: this.config.systemPrompt,
          messages,
        } as Parameters<typeof this.client.messages.stream>[0]);

        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              finalText += event.delta.text;
              this.emitEvent({
                type: 'text_delta',
                sessionId: '',
                agentRole: this.config.role,
                data: { chunk: event.delta.text, agentName: this.config.name },
                timestamp: new Date(),
              });
            }
          } else if (event.type === 'message_delta') {
            totalOutputTokens += event.usage?.output_tokens ?? 0;
          } else if (event.type === 'message_start') {
            totalInputTokens += event.message.usage?.input_tokens ?? 0;
          }
        }
      }

      const duration = Date.now() - this.startTime!;
      const totalTokens = totalInputTokens + totalOutputTokens;

      this.state.metrics.tokensUsed += totalTokens;
      this.state.metrics.avgResponseTime =
        (this.state.metrics.avgResponseTime * this.state.metrics.tasksCompleted + duration) /
        (this.state.metrics.tasksCompleted + 1);

      return {
        text: finalText,
        thinking: finalThinking,
        tokensUsed: totalTokens,
        thinkingTokens: 0,
        toolCallCount,
      };
    } catch (error) {
      this.updateStatus('error', `Error: ${(error as Error).message}`);
      throw error;
    }
  }

  // ─── Quick Chat (for interactive mid-session questions) ────
  // Lightweight call for answering user questions about the current session
  async chat(userMessage: string, sessionContext: string): Promise<string> {
    this.updateStatus('working', 'Responding to user question...');

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `## CURRENT SESSION CONTEXT\n${sessionContext}\n\n---\n\n## USER QUESTION\n${userMessage}\n\nPlease answer based on the research context above. Be specific, concise, and helpful.`,
      },
    ];

    try {
      const response = await this.client.messages.create({
        model: this.config.model!,
        max_tokens: 2000,
        system: this.config.systemPrompt,
        messages,
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      this.state.metrics.tokensUsed += response.usage.input_tokens + response.usage.output_tokens;
      this.updateStatus('idle');
      return text;
    } catch (error) {
      this.updateStatus('error');
      throw error;
    }
  }

  // Execute a task — implemented by each specialized agent
  abstract executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult>;

  // Shutdown cleanup
  shutdown(): void {
    this.updateStatus('idle');
    this.messageBus.unsubscribe(this.config.role);
  }
}
