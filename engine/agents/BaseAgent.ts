// ============================================================
// MULTI-AGENT RESEARCH SYSTEM — Base Agent
// Foundation class for all specialized research agents
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type {
  AgentRole,
  AgentState,
  AgentStatus,
  AgentMetrics,
  ResearchFinding,
  ResearchPhase,
  TaskResult,
  ResearchTask,
  StreamEvent,
} from '../models/types';
import { MessageBus } from '../coordination/MessageBus';

export interface AgentConfig {
  role: AgentRole;
  name: string;
  expertise: string;
  systemPrompt: string;
  model?: string;
  maxTokens?: number;
}

export type EventEmitFn = (event: StreamEvent) => void;

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
      model: 'claude-opus-4-6',
      maxTokens: 32000,
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

  get role(): AgentRole {
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
    phase: ResearchPhase,
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

  // Core method: calls Claude with streaming + adaptive thinking
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

      // Update metrics
      this.state.metrics.tokensUsed += totalTokens;
      this.state.metrics.avgResponseTime =
        (this.state.metrics.avgResponseTime * this.state.metrics.tasksCompleted +
          duration) /
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

  // Execute a task — implemented by each specialized agent
  abstract executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult>;

  // Shutdown cleanup
  shutdown(): void {
    this.updateStatus('idle');
    this.messageBus.unsubscribe(this.config.role);
  }
}
