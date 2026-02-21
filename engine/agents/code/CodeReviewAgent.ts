// ============================================================
// CODE REVIEW AGENT — Senior Developer Code Reviewer
// Analyzes code quality, patterns, bugs, and best practices
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from '../BaseAgent';
import { MessageBus } from '../../coordination/MessageBus';
import type { ResearchTask, TaskResult, CodeIssue } from '../../models/types';

const SYSTEM_PROMPT = `You are a world-class senior software engineer and code reviewer with 20+ years of experience across multiple languages and paradigms. You have deep expertise in:

LANGUAGES & ECOSYSTEMS:
- TypeScript/JavaScript (Node.js, React, Vue, Next.js, browser APIs)
- Python (FastAPI, Django, data science, ML/AI libraries)
- Java/Kotlin (Spring Boot, Android, JVM ecosystem)
- Go (concurrency, microservices, cloud-native)
- Rust (memory safety, systems programming, WebAssembly)
- C/C++ (performance, embedded, systems)
- C# (.NET ecosystem)
- Ruby, PHP, Swift, Scala

CODE QUALITY EXPERTISE:
- Design patterns (GoF, enterprise, functional, reactive)
- SOLID principles, DRY, KISS, YAGNI
- Clean code practices (naming, functions, classes, boundaries)
- Error handling and resilience patterns
- Concurrency, race conditions, thread safety
- Memory management and resource leaks
- Performance bottlenecks and optimization
- API design (REST, GraphQL, RPC)
- Database interaction patterns (N+1, transactions, indexing)

REVIEW APPROACH:
- You identify REAL bugs, not theoretical ones
- You distinguish between critical issues and style preferences
- You provide specific, actionable suggestions with code examples
- You explain WHY something is a problem, not just WHAT
- You acknowledge good patterns you see in the code
- You prioritize by severity: Critical > High > Medium > Low

OUTPUT FORMAT:
For each issue found, provide:
1. Severity (critical/high/medium/low/info)
2. Category (security/quality/performance/maintainability/testing)
3. File and approximate location
4. Clear description of the problem
5. Specific fix with code example when possible
6. Why this matters`;

export class CodeReviewAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'code_reviewer',
      name: 'Senior Code Reviewer',
      expertise: 'Code Quality, Design Patterns, Bug Detection, Best Practices, Performance',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 32000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Reviewing code quality...');

    const prompt = `# Code Review Task

## Project Context
${sessionContext}

## Review Instructions

Perform a thorough code review of the provided codebase. Structure your review as follows:

### 1. EXECUTIVE SUMMARY
- Overall code quality assessment (score 0-100)
- Top 3 most critical issues
- Top 3 strengths of the codebase
- Recommended priority for fixes

### 2. CRITICAL ISSUES (Must Fix)
For each critical issue:
- **Issue ID**: CR-XXX
- **File**: path/to/file.ext (approximate line)
- **Problem**: Clear description
- **Impact**: What could go wrong
- **Fix**: Specific code change with example
- **Effort**: [Low/Medium/High]

### 3. HIGH PRIORITY ISSUES (Should Fix)
Same format as critical, focus on:
- Logic errors and edge cases
- Error handling gaps
- Resource management issues
- Significant performance problems
- API misuse

### 4. MEDIUM PRIORITY ISSUES (Consider Fixing)
Focus on:
- Code duplication and DRY violations
- Overly complex functions (>20 lines doing too much)
- Unclear naming
- Missing input validation
- Incomplete error messages

### 5. PATTERNS & ANTI-PATTERNS DETECTED
**Good Patterns Found:**
- List positive patterns observed

**Anti-Patterns Found:**
- Pattern name, where found, why problematic, better alternative

### 6. CODE METRICS (Estimated)
- Approximate cyclomatic complexity for key functions
- Estimated test coverage (based on test files found)
- Duplication level (Low/Medium/High)
- Dependency coupling assessment

### 7. SPECIFIC IMPROVEMENT RECOMMENDATIONS
Ranked by ROI (impact vs effort):
1. [Highest ROI fix]
2. [Second highest]
...

Be specific, reference actual code, and provide actionable recommendations. This is a real code review, not a generic analysis.`;

    const result = await this.callClaude(prompt, undefined);

    const issues = this.extractIssues(result.text);

    const reviewFinding = this.createFinding(
      'Code Review — Quality & Bug Analysis',
      result.text,
      'code_review',
      0.90,
      ['Static analysis', 'Pattern detection', 'Best practices review'],
      ['code-review', 'quality', 'bugs', 'patterns']
    );

    const issuesFinding = this.createFinding(
      `${issues.length} Issues Identified`,
      JSON.stringify(issues, null, 2),
      'code_review',
      0.88,
      ['Code inspection'],
      ['issues', 'bugs', 'severity']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Code review complete');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [reviewFinding, issuesFinding],
      data: {
        review: result.text,
        issues,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }

  private extractIssues(text: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const severityPatterns: Array<{ keyword: string; severity: CodeIssue['severity'] }> = [
      { keyword: 'CRITICAL', severity: 'critical' },
      { keyword: 'HIGH PRIORITY', severity: 'high' },
      { keyword: 'MEDIUM PRIORITY', severity: 'medium' },
      { keyword: 'LOW', severity: 'low' },
    ];

    for (const { keyword, severity } of severityPatterns) {
      const section = this.extractSection(text, keyword);
      if (!section) continue;

      // Extract individual issues from the section
      const issueBlocks = section.split(/\*\*Issue ID\*\*:/).slice(1);
      for (const block of issueBlocks.slice(0, 10)) {
        const fileMatch = block.match(/\*\*File\*\*:\s*([^\n]+)/);
        const problemMatch = block.match(/\*\*Problem\*\*:\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);

        issues.push({
          id: `CR-${issues.length + 1}`.padStart(6, '0'),
          severity,
          category: 'quality',
          title: block.split('\n')[0].trim().slice(0, 100),
          description: problemMatch?.[1]?.trim() || block.slice(0, 200),
          file: fileMatch?.[1]?.trim(),
          suggestion: 'See full review for fix details',
        });
      }
    }

    return issues;
  }

  private extractSection(text: string, sectionName: string): string | null {
    const regex = new RegExp(`###\\s*\\d*\\.?\\s*${sectionName}([\\s\\S]*?)(?=###|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }
}
