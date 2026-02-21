// ============================================================
// MULTI-AGENT RESEARCH SYSTEM — Core Types
// Elite Scientific Research Team Architecture
// ============================================================

// ─── Research Agent Roles ──────────────────────────────────
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

// ─── Code Analysis Agent Roles ─────────────────────────────
export type CodeAgentRole =
  | 'code_reviewer'
  | 'architecture_analyst'
  | 'security_auditor'
  | 'documentation_generator';

export type AnyAgentRole = AgentRole | CodeAgentRole;

export type AgentStatus =
  | 'idle'
  | 'initializing'
  | 'thinking'
  | 'working'
  | 'reviewing'
  | 'completed'
  | 'error'
  | 'waiting'
  | 'paused';

// ─── Research Phases ───────────────────────────────────────
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

// ─── Code Analysis Phases ──────────────────────────────────
export type CodeAnalysisPhase =
  | 'parsing'
  | 'code_review'
  | 'architecture'
  | 'security'
  | 'documentation'
  | 'synthesis'
  | 'report'
  | 'completed';

// ─── Message Bus Types ─────────────────────────────────────
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
  | 'progress_update'
  | 'user_feedback'
  | 'pipeline_pause'
  | 'pipeline_resume';

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

// ─── Agent State & Metrics ─────────────────────────────────
export interface AgentState {
  role: AnyAgentRole;
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

// ─── Research Findings ─────────────────────────────────────
export interface ResearchFinding {
  id: string;
  agentRole: AnyAgentRole;
  phase: ResearchPhase | CodeAnalysisPhase;
  title: string;
  content: string;
  confidence: number; // 0-1
  evidence: string[];
  timestamp: Date;
  tags: string[];
  citations?: Citation[];
}

// ─── Citations ─────────────────────────────────────────────
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
  citationCount?: number;
  verified?: boolean;        // true if verified via CrossRef/Semantic Scholar
  source?: 'semantic_scholar' | 'arxiv' | 'crossref' | 'generated';
}

// ─── Research Session ──────────────────────────────────────
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
  // Interactive control
  paused?: boolean;
  feedbackQueue?: InteractiveFeedback[];
}

export interface SessionMetadata {
  totalTokens: number;
  totalThinkingTokens: number;
  totalAgentCalls: number;
  estimatedCost: number;
  qualityScore: number;
}

// ─── Research Paper ────────────────────────────────────────
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

// ─── Tasks ─────────────────────────────────────────────────
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
  agentRole: AnyAgentRole;
  success: boolean;
  findings: ResearchFinding[];
  data: Record<string, unknown>;
  tokensUsed: number;
  thinkingTokens: number;
  duration: number;
  timestamp: Date;
}

// ─── Stream Events ─────────────────────────────────────────
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
    | 'progress'
    | 'pipeline_paused'
    | 'pipeline_resumed'
    | 'user_feedback_received'
    | 'agent_chat_response'
    | 'tool_call'
    | 'tool_result'
    | 'code_analysis_ready';
  sessionId: string;
  agentRole?: AnyAgentRole;
  data: Record<string, unknown>;
  timestamp: Date;
}

// ─── Research Config ───────────────────────────────────────
export interface ResearchConfig {
  topic: string;
  researchQuestion: string;
  domain: string;
  objectives: string[];
  constraints?: string[];
  depth: 'quick' | 'standard' | 'comprehensive' | 'exhaustive';
  outputFormat: 'summary' | 'report' | 'full_paper';
  language: string;
  enableRealSearch?: boolean;   // Use Semantic Scholar + arXiv APIs
  interactiveMode?: boolean;    // Enable pause/resume/feedback
}

// ─── Interactive Pipeline Control ──────────────────────────
export interface InteractiveFeedback {
  id: string;
  timestamp: Date;
  phase: ResearchPhase;
  type: 'correction' | 'expansion' | 'redirect' | 'approval' | 'rejection';
  targetAgent?: AgentRole;
  message: string;
  injectedAt?: ResearchPhase; // Which phase it was injected into
}

export interface AgentChatMessage {
  sessionId: string;
  agentRole: AgentRole;
  userMessage: string;
  agentResponse?: string;
  timestamp: Date;
}

// ─── Code Analysis Types ───────────────────────────────────
export type CodeInputType = 'paste' | 'files' | 'github_url';

export interface CodeFile {
  name: string;
  path: string;
  content: string;
  language: string;
  sizeBytes?: number;
  lineCount?: number;
}

export interface CodeAnalysisConfig {
  inputType: CodeInputType;
  // For 'paste'
  code?: string;
  language?: string;
  fileName?: string;
  // For 'files'
  files?: CodeFile[];
  // For 'github_url'
  githubUrl?: string;
  githubToken?: string;
  // Analysis options
  projectName?: string;
  projectDescription?: string;
  analysisDepth: 'quick' | 'standard' | 'comprehensive';
  focusAreas: CodeFocusArea[];
  outputFormat: 'summary' | 'full_report';
}

export type CodeFocusArea =
  | 'security'
  | 'architecture'
  | 'quality'
  | 'documentation'
  | 'performance'
  | 'testing';

export interface CodeIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'security' | 'quality' | 'architecture' | 'performance' | 'maintainability' | 'documentation';
  title: string;
  description: string;
  file?: string;
  lineNumber?: number;
  codeSnippet?: string;
  suggestion: string;
  references?: string[];
}

export interface ArchitectureInsight {
  type: 'pattern' | 'antipattern' | 'dependency' | 'coupling' | 'cohesion' | 'principle';
  title: string;
  description: string;
  affectedFiles?: string[];
  recommendation?: string;
}

export interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>; // language -> line count
  issuesBySeverity: Record<string, number>;
  overallScore: number; // 0-100
  securityScore: number;
  maintainabilityScore: number;
  documentationScore: number;
}

export interface CodeAnalysisReport {
  projectName: string;
  summary: string;
  metrics: CodeMetrics;
  issues: CodeIssue[];
  architectureInsights: ArchitectureInsight[];
  generatedDocs: GeneratedDocumentation;
  recommendations: string[];
  sections: PaperSection[];
  generatedAt: Date;
}

export interface GeneratedDocumentation {
  readme?: string;
  apiDocs?: string;
  architectureDiagram?: string; // ASCII/Mermaid
  setupGuide?: string;
  contributingGuide?: string;
}

export interface CodeAnalysisSession {
  id: string;
  config: CodeAnalysisConfig;
  startTime: Date;
  endTime?: Date;
  phase: CodeAnalysisPhase;
  files: CodeFile[];
  findings: ResearchFinding[];
  report?: CodeAnalysisReport;
  metadata: SessionMetadata;
  agents: Map<CodeAgentRole, AgentState>;
}

// ─── Export Types ──────────────────────────────────────────
export type ExportFormat = 'latex' | 'markdown' | 'html' | 'json';

export interface ExportResult {
  format: ExportFormat;
  content: string;
  filename: string;
  mimeType: string;
}

// ─── Academic Search Types ─────────────────────────────────
export interface AcademicSearchResult {
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  doi?: string;
  url?: string;
  citationCount?: number;
  venue?: string;
  source: 'semantic_scholar' | 'arxiv' | 'crossref';
  paperId?: string; // Semantic Scholar ID
}
