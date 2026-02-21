// ============================================================
// ARCHITECTURE AGENT — System Design & Structure Analyst
// Analyzes system architecture, dependencies, and design patterns
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from '../BaseAgent';
import { MessageBus } from '../../coordination/MessageBus';
import type { ResearchTask, TaskResult, ArchitectureInsight } from '../../models/types';

const SYSTEM_PROMPT = `You are a principal software architect and systems design expert with expertise in:

ARCHITECTURAL PATTERNS:
- Monolithic, Microservices, Serverless, Event-Driven
- Layered (N-tier), Hexagonal (Ports & Adapters), Clean Architecture
- CQRS, Event Sourcing, Saga patterns
- Domain-Driven Design (DDD) — bounded contexts, aggregates, domain events
- Repository, Factory, Strategy, Observer, Decorator patterns

SYSTEM QUALITIES:
- Scalability (horizontal/vertical, stateless design, caching strategies)
- Maintainability (coupling, cohesion, dependency management)
- Testability (dependency injection, mock boundaries, seams)
- Observability (logging, metrics, tracing)
- Resilience (circuit breakers, retry, bulkheads, timeouts)
- Security (authentication boundaries, principle of least privilege)

DEPENDENCY ANALYSIS:
- Circular dependency detection
- Layering violations (e.g., domain depending on infrastructure)
- Tight coupling identification
- Interface segregation analysis
- Module boundary assessment

FRONTEND ARCHITECTURE:
- Component design (atomic design, compound components)
- State management patterns (Flux, Redux, Zustand, Pinia)
- Data fetching strategies (server-side, client-side, hybrid)
- Bundle structure and code splitting

DATABASE & DATA ARCHITECTURE:
- ORM usage patterns and N+1 query risks
- Transaction boundary design
- Schema normalization vs denormalization tradeoffs
- Caching layers and invalidation strategies

Your analysis is concrete and specific — you reference actual files, actual dependencies, and actual patterns found in the code. You draw ASCII diagrams to illustrate architecture.`;

export class ArchitectureAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'architecture_analyst',
      name: 'Principal Architect',
      expertise: 'System Design, Dependency Analysis, Architectural Patterns, DDD, Microservices',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 32000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Analyzing system architecture...');

    const prompt = `# Architecture Analysis Task

## Project Context
${sessionContext}

## Analysis Instructions

Perform a comprehensive architectural analysis. Structure your analysis as follows:

### 1. ARCHITECTURAL OVERVIEW
- Identified architectural pattern(s) (e.g., layered, hexagonal, microservices)
- Technology stack summary
- Entry points and main components
- Data flow description

### 2. SYSTEM DIAGRAM (ASCII)
Draw an ASCII diagram showing:
- Main components/modules
- Their relationships and dependencies
- Data flow direction
- External integrations

Example:
\`\`\`
[Client] → [API Gateway] → [Service A] → [Database A]
                         → [Service B] → [Cache]
                                       → [Database B]
\`\`\`

### 3. DEPENDENCY ANALYSIS
**Module Dependencies Map:**
- List each major module and what it depends on
- Identify any circular dependencies
- Flag any layering violations

**Coupling Assessment:**
- High coupling areas (tightly bound modules)
- Recommended decoupling strategies

**Cohesion Assessment:**
- Modules doing too many things (God objects/modules)
- Related code that should be consolidated

### 4. ARCHITECTURAL STRENGTHS
- What's well-designed and why
- Good separation of concerns found
- Effective patterns being used

### 5. ARCHITECTURAL ISSUES
For each issue:
- **Issue**: Description
- **Type**: [circular_dependency|layering_violation|antipattern|coupling|cohesion]
- **Impact**: [Low/Medium/High]
- **Files Affected**: List key files
- **Recommendation**: Specific refactoring approach

### 6. SCALABILITY ASSESSMENT
- Can this architecture scale horizontally? What would need to change?
- Bottlenecks and single points of failure
- Stateful components that need addressing

### 7. TESTABILITY ASSESSMENT
- Are components testable in isolation?
- Dependencies that make testing hard
- Suggested test architecture improvements

### 8. REFACTORING ROADMAP
Prioritized steps to improve the architecture:
1. [Highest priority: Quick wins]
2. [Medium priority: Core improvements]
3. [Long term: Structural changes]

Include effort estimates (1 week / 1 month / 3 months) for each step.`;

    const result = await this.callClaude(prompt);

    const insights = this.extractInsights(result.text);

    const archFinding = this.createFinding(
      'System Architecture Analysis',
      result.text,
      'architecture',
      0.87,
      ['Dependency graph analysis', 'Pattern recognition', 'Design principles evaluation'],
      ['architecture', 'design', 'dependencies', 'patterns']
    );

    const insightsFinding = this.createFinding(
      `${insights.length} Architectural Insights`,
      JSON.stringify(insights, null, 2),
      'architecture',
      0.85,
      ['Architectural analysis'],
      ['architecture', 'insights', 'recommendations']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Architecture analysis complete');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [archFinding, insightsFinding],
      data: {
        analysis: result.text,
        insights,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }

  private extractInsights(text: string): ArchitectureInsight[] {
    const insights: ArchitectureInsight[] = [];

    // Extract issues from section 5
    const issuesSection = text.match(/###\s*5[^#]*ARCHITECTURAL ISSUES([\s\S]*?)(?=###|$)/i);
    if (issuesSection) {
      const blocks = issuesSection[1].split(/\*\*Issue\*\*:/).slice(1);
      for (const block of blocks.slice(0, 10)) {
        const typeMatch = block.match(/\*\*Type\*\*:\s*\[?([^\]\n]+)\]?/);
        const impactMatch = block.match(/\*\*Impact\*\*:\s*\[?([^\]\n]+)\]?/);
        const filesMatch = block.match(/\*\*Files Affected\*\*:\s*([^\n]+)/);
        const recMatch = block.match(/\*\*Recommendation\*\*:\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);

        const typeStr = typeMatch?.[1]?.trim().toLowerCase() || 'antipattern';
        const validTypes = ['pattern', 'antipattern', 'dependency', 'coupling', 'cohesion', 'principle'] as const;
        const type = validTypes.find(t => typeStr.includes(t)) || 'antipattern';

        insights.push({
          type,
          title: block.split('\n')[0].trim().slice(0, 100),
          description: block.slice(0, 300),
          affectedFiles: filesMatch?.[1]?.split(',').map(f => f.trim()),
          recommendation: recMatch?.[1]?.trim(),
        });
      }
    }

    // Extract strengths as positive patterns
    const strengthsSection = text.match(/###\s*4[^#]*ARCHITECTURAL STRENGTHS([\s\S]*?)(?=###|$)/i);
    if (strengthsSection) {
      const lines = strengthsSection[1].split('\n').filter(l => l.trim().startsWith('-'));
      for (const line of lines.slice(0, 5)) {
        insights.push({
          type: 'pattern',
          title: line.replace(/^-\s*/, '').trim().slice(0, 100),
          description: line.replace(/^-\s*/, '').trim(),
        });
      }
    }

    return insights;
  }
}
