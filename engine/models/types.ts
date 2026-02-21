// ============================================================
// MULTI-AGENT RESEARCH SYSTEM — Core Types
// Elite Scientific Research Team Architecture
// ============================================================

export type AgentRole =
  | 'research_director'
  | 'literature_reviewer'
  | 'hypothesis_generator'
  | 'methodology_expert'
  | 'data_analyst'
  | 'critical_reviewer'
  | 'synthesis_specialist'
  | 'scientific_writer'
  | 'citation_manager';

export type AgentStatus =
  | 'idle'
  | 'initializing'
  | 'thinking'
  | 'working'
  | 'reviewing'
  | 'completed'
  | 'error'
  | 'waiting';

export type ResearchPhase =
  | 'initialization'
  | 'literature_review'
  | 'hypothesis_formation'
  | 'methodology_design'
  | 'data_analysis'
  | 'critical_review'
  | 'synthesis'
  | 'writing'
  | 'citation_management'
  | 'final_review'
  | 'completed';

export type MessageType =
  | 'task_assignment'
  | 'task_result'
  | 'agent_status_update'
  | 'research_finding'
  | 'review_request'
  | 'review_response'
  | 'coordination'
  | 'broadcast'
  | 'error'
  | 'progress_update';

export interface AgentMessage {
  id: string;
  type: MessageType;
  from: AgentRole | 'orchestrator' | 'system';
  to: AgentRole | 'orchestrator' | 'all';
  timestamp: Date;
  payload: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  correlationId?: string;
}

export interface AgentState {
  role: AgentRole;
  status: AgentStatus;
  currentTask?: string;
  completedTasks: string[];
  findings: ResearchFinding[];
  metrics: AgentMetrics;
  lastUpdated: Date;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tokensUsed: number;
  thinkingTokens: number;
  avgResponseTime: number;
  qualityScore: number;
}

export interface ResearchFinding {
  id: string;
  agentRole: AgentRole;
  phase: ResearchPhase;
  title: string;
  content: string;
  confidence: number; // 0-1
  evidence: string[];
  timestamp: Date;
  tags: string[];
  citations?: Citation[];
}

export interface Citation {
  id: string;
  authors: string[];
  title: string;
  journal?: string;
  year: number;
  doi?: string;
  url?: string;
  abstract?: string;
  relevanceScore: number;
}

export interface ResearchSession {
  id: string;
  topic: string;
  researchQuestion: string;
  domain: string;
  objectives: string[];
  constraints: string[];
  startTime: Date;
  endTime?: Date;
  phase: ResearchPhase;
  agents: Map<AgentRole, AgentState>;
  findings: ResearchFinding[];
  citations: Citation[];
  paper?: ResearchPaper;
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  totalTokens: number;
  totalThinkingTokens: number;
  totalAgentCalls: number;
  estimatedCost: number;
  qualityScore: number;
}

export interface ResearchPaper {
  title: string;
  abstract: string;
  keywords: string[];
  sections: PaperSection[];
  references: Citation[];
  authors: string[];
  generatedAt: Date;
  wordCount: number;
  doi?: string;
}

export interface PaperSection {
  id: string;
  title: string;
  content: string;
  subsections?: PaperSection[];
  order: number;
}

export interface ResearchTask {
  id: string;
  assignedTo: AgentRole;
  description: string;
  context: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dependencies: string[];
  deadline?: Date;
  result?: TaskResult;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface TaskResult {
  taskId: string;
  agentRole: AgentRole;
  success: boolean;
  findings: ResearchFinding[];
  data: Record<string, unknown>;
  tokensUsed: number;
  thinkingTokens: number;
  duration: number;
  timestamp: Date;
}

export interface StreamEvent {
  type:
    | 'agent_update'
    | 'finding'
    | 'phase_change'
    | 'thinking'
    | 'text_delta'
    | 'paper_ready'
    | 'error'
    | 'session_complete'
    | 'progress';
  sessionId: string;
  agentRole?: AgentRole;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface ResearchConfig {
  topic: string;
  researchQuestion: string;
  domain: string;
  objectives: string[];
  constraints?: string[];
  depth: 'quick' | 'standard' | 'comprehensive' | 'exhaustive';
  outputFormat: 'summary' | 'report' | 'full_paper';
  language: string;
}
