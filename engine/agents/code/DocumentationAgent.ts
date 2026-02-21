// ============================================================
// DOCUMENTATION AGENT — Technical Documentation Generator
// Generates READMEs, API docs, architecture guides from code
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from '../BaseAgent';
import { MessageBus } from '../../coordination/MessageBus';
import type { ResearchTask, TaskResult, GeneratedDocumentation } from '../../models/types';

const SYSTEM_PROMPT = `You are an expert technical writer and developer advocate who specializes in creating exceptional documentation for software projects. You combine deep technical knowledge with clear communication skills.

YOUR EXPERTISE:
- README files that make developers want to use the project
- API documentation (REST, GraphQL, SDK docs)
- Architecture decision records (ADRs)
- Setup guides (installation, configuration, deployment)
- Contributing guides that welcome new contributors
- In-line code documentation (JSDoc, Python docstrings, Rustdoc)
- Changelog generation
- Mermaid and ASCII diagrams

DOCUMENTATION PHILOSOPHY:
- Start with WHY (what problem does this solve?)
- Show, don't tell (code examples over prose)
- Structure for scanners, not just readers
- Keep it current and maintainable (not over-documented)
- Different audiences: beginners, advanced users, contributors, ops

WHAT GOOD DOCUMENTATION INCLUDES:
README:
- Project name, description, badges
- What it does (1-2 sentences)
- Quick start (< 5 minutes to get running)
- Installation instructions
- Basic usage with code examples
- Configuration reference
- Links to full documentation

API DOCS:
- Every public endpoint/method documented
- Parameters with types, defaults, constraints
- Request/response examples with realistic data
- Error codes and their meaning
- Authentication requirements
- Rate limits

ARCHITECTURE DOCS:
- Why key decisions were made (not just what)
- Trade-offs acknowledged
- Diagrams showing component relationships
- Data flow documentation
- Sequence diagrams for complex flows

You generate documentation that developers actually want to read — concise, accurate, and full of practical examples.`;

export class DocumentationAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'documentation_generator',
      name: 'Technical Documentation Generator',
      expertise: 'Technical Writing, API Documentation, README, Architecture Docs, Developer Experience',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 40000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Generating documentation...');

    const prompt = `# Documentation Generation Task

## Project Context
${sessionContext}

## Documentation Instructions

Generate comprehensive documentation for this project. Produce the following:

---

# DOCUMENT 1: README.md

Generate a complete, professional README.md following this structure:

\`\`\`markdown
# [Project Name]

> [One-sentence description that captures the essence]

[Badges: build status, license, version, coverage - use placeholder values]

## What is this?
[2-3 sentences explaining WHAT it does and WHO it's for]

## Why use this?
[Key benefits / what problem it solves]

## Quick Start

### Prerequisites
[List exact requirements with minimum versions]

### Installation
[Step-by-step installation commands]

### Basic Usage
[Most common use case with complete working code example]

## Configuration
[Table of all configuration options with: name | type | default | description]

## API Reference
[If applicable: key endpoints or public methods with examples]

## Architecture Overview
[Brief description + ASCII diagram of key components]

## Contributing
[Quick guide for contributors]

## License
[License type]
\`\`\`

---

# DOCUMENT 2: API_DOCS.md (if API endpoints exist)

For each API endpoint or public function found in the code:

\`\`\`markdown
## [Method] /path/to/endpoint

**Description**: What this does

**Authentication**: Required/Optional/None

**Request**:
- Parameters (path/query/body) with types and validation rules
- Example request with realistic data

**Response**:
- Success response with example
- Error responses with codes and messages

**Example**:
\`\`\`curl
curl -X POST ...
\`\`\`
\`\`\`

---

# DOCUMENT 3: ARCHITECTURE.md

\`\`\`markdown
# Architecture Overview

## System Components
[Description of major components and their responsibilities]

## Component Diagram
\`\`\`
[ASCII or Mermaid diagram]
\`\`\`

## Data Flow
[How data moves through the system]

## Key Design Decisions
[ADR-style explanation of why key choices were made]

## Technology Stack
| Layer | Technology | Reason |
|-------|-----------|--------|
\`\`\`

---

# DOCUMENT 4: SETUP_GUIDE.md

Detailed setup for:
- Local development environment
- Environment variables (with a .env.example template)
- Database setup (if applicable)
- Running tests
- Deployment options

---

# DOCUMENT 5: CONTRIBUTING.md

\`\`\`markdown
# Contributing Guide

## Development Setup
## Code Style
## Branch Naming
## Pull Request Process
## Testing Requirements
## Code Review Criteria
\`\`\`

---

Generate all documents based on what you can infer from the codebase. Make them specific to THIS project, not generic templates.`;

    const result = await this.callClaude(prompt);

    const docs = this.extractDocs(result.text);

    const docFinding = this.createFinding(
      'Generated Technical Documentation',
      result.text,
      'documentation',
      0.85,
      ['Code analysis', 'API extraction', 'Pattern inference'],
      ['documentation', 'readme', 'api-docs', 'architecture']
    );

    const summaryFinding = this.createFinding(
      'Documentation Summary',
      `Generated ${Object.keys(docs).filter(k => (docs as Record<string, string | undefined>)[k]).length} documentation files:\n` +
      Object.entries(docs)
        .filter(([, v]) => v)
        .map(([k, v]) => `- ${k}: ${v!.split('\n').length} lines`)
        .join('\n'),
      'documentation',
      0.82,
      ['Documentation generation'],
      ['docs', 'summary']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Documentation generation complete');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [docFinding, summaryFinding],
      data: {
        generatedText: result.text,
        docs,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }

  private extractDocs(text: string): GeneratedDocumentation {
    return {
      readme: this.extractDocument(text, 'DOCUMENT 1', 'DOCUMENT 2'),
      apiDocs: this.extractDocument(text, 'DOCUMENT 2', 'DOCUMENT 3'),
      architectureDiagram: this.extractDocument(text, 'DOCUMENT 3', 'DOCUMENT 4'),
      setupGuide: this.extractDocument(text, 'DOCUMENT 4', 'DOCUMENT 5'),
      contributingGuide: this.extractDocument(text, 'DOCUMENT 5', '$'),
    };
  }

  private extractDocument(text: string, start: string, end: string): string | undefined {
    const pattern = new RegExp(
      `# ${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)(?=# ${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|$)`
    );
    const match = text.match(pattern);
    return match ? match[1].trim() : undefined;
  }
}
