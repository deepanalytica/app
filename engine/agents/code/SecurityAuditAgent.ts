// ============================================================
// SECURITY AUDIT AGENT — Application Security Expert
// Identifies vulnerabilities following OWASP and industry standards
// ============================================================

import { BaseAgent, type AgentConfig, type EventEmitFn } from '../BaseAgent';
import { MessageBus } from '../../coordination/MessageBus';
import type { ResearchTask, TaskResult, CodeIssue } from '../../models/types';

const SYSTEM_PROMPT = `You are an expert application security engineer and penetration tester with deep knowledge of:

VULNERABILITY FRAMEWORKS:
- OWASP Top 10 (2021): Injection, Broken Auth, Sensitive Data Exposure, XXE, Broken Access Control, Security Misconfig, XSS, Insecure Deserialization, Vulnerable Components, Insufficient Logging
- OWASP Top 10 for APIs (2023)
- SANS/CWE Top 25 Most Dangerous Software Errors
- CVE database and common vulnerability patterns

VULNERABILITY CATEGORIES:
- **Injection**: SQL injection, NoSQL injection, LDAP injection, Command injection, XSS, SSTI
- **Authentication & Authorization**: Broken auth, JWT vulnerabilities, session management, IDOR, privilege escalation, RBAC flaws
- **Cryptography**: Weak algorithms (MD5, SHA1, DES), hardcoded secrets, key management, insecure RNG
- **Input Validation**: Missing validation, regex DoS, path traversal, file upload risks
- **Sensitive Data**: Logging PII, insecure storage, missing encryption at rest/transit
- **Dependencies**: Known vulnerable packages, outdated versions, supply chain risks
- **Configuration**: Debug mode in production, exposed admin interfaces, CORS misconfiguration, CSP issues
- **Business Logic**: Race conditions, TOCTOU, mass assignment, excessive data exposure

ANALYSIS APPROACH:
- You look for REAL, exploitable vulnerabilities, not theoretical risks
- You assign CVSS scores where applicable
- You provide proof-of-concept attack scenarios
- You reference specific CVEs and CWEs
- You distinguish between high-confidence findings and potential issues
- You never generate actual exploit code, only describe the vulnerability and fix

OUTPUT FORMAT:
For critical/high findings:
- Vulnerability name and CWE/OWASP reference
- Affected file and location
- Proof-of-concept scenario (without actual exploit)
- Impact assessment
- Specific remediation with secure code example`;

export class SecurityAuditAgent extends BaseAgent {
  constructor(messageBus: MessageBus, emitEvent: EventEmitFn) {
    const config: AgentConfig = {
      role: 'security_auditor',
      name: 'Security Auditor',
      expertise: 'OWASP Top 10, Penetration Testing, Cryptography, Authentication, Input Validation',
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 28000,
    };
    super(config, messageBus, emitEvent);
  }

  async executeTask(task: ResearchTask, sessionContext: string): Promise<TaskResult> {
    const start = Date.now();
    this.updateStatus('working', 'Conducting security audit...');

    const prompt = `# Security Audit Task

## Project Context
${sessionContext}

## Security Audit Instructions

Perform a thorough security audit following OWASP guidelines. Structure your report as:

### 1. SECURITY SUMMARY
- Overall security posture (score 0-100, where 100 = excellent)
- Risk level: [Critical/High/Medium/Low]
- Number of issues by severity
- Most critical finding (one sentence)
- Compliance notes (GDPR, SOC2, HIPAA relevance if applicable)

### 2. CRITICAL VULNERABILITIES (CVSS ≥ 9.0)
For each finding:
- **[VULN-XXX] Vulnerability Name**
- **CWE**: CWE-XXX / OWASP: AXX:2021
- **File**: path/to/file:line (if identifiable)
- **Description**: What the vulnerability is
- **Attack Scenario**: How an attacker could exploit this (conceptual, no working exploits)
- **Impact**: Confidentiality/Integrity/Availability impact
- **CVSS Score**: X.X (Critical)
- **Fix**: Specific secure code example or configuration change

### 3. HIGH SEVERITY (CVSS 7.0-8.9)
Same format, focus on:
- Injection vulnerabilities (SQL, NoSQL, command, SSTI)
- Broken authentication/authorization
- Sensitive data exposure
- Insecure direct object references

### 4. MEDIUM SEVERITY (CVSS 4.0-6.9)
- Security misconfigurations
- Missing security headers
- Insufficient input validation
- Weak cryptography usage
- Session management issues

### 5. LOW / INFORMATIONAL
- Verbose error messages revealing stack traces
- Missing security documentation
- Deprecated API usage
- Minor configuration improvements

### 6. DEPENDENCY AUDIT
- Identify any imported packages/libraries
- Flag any known patterns of vulnerable dependencies
- Recommend dependency audit tools (npm audit, pip-audit, etc.)
- Note: Without access to a live database, flag any packages that have commonly known CVE history

### 7. SECRETS & CREDENTIALS SCAN
- Any hardcoded credentials, API keys, tokens, or secrets found in code
- Insecure environment variable handling
- Recommendations for secrets management (vault, env files, secrets manager)

### 8. SECURITY RECOMMENDATIONS (PRIORITIZED)
Quick wins (< 1 day to implement):
1. [Fix]

Short-term (< 1 week):
2. [Fix]

Long-term (architectural):
3. [Fix]

### 9. SECURITY HEADERS CHECKLIST (if web application)
- [ ] Content-Security-Policy
- [ ] X-Frame-Options
- [ ] X-Content-Type-Options
- [ ] Strict-Transport-Security
- [ ] Referrer-Policy
- [ ] Permissions-Policy

Status each as: ✓ Present | ✗ Missing | ? Not determinable from code

Be specific and reference actual code. This is a professional security audit.`;

    const result = await this.callClaude(prompt);

    const vulnerabilities = this.extractVulnerabilities(result.text);
    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'high').length;

    const securityFinding = this.createFinding(
      'Security Audit Report',
      result.text,
      'security',
      criticalCount > 0 ? 0.95 : 0.85,
      ['OWASP Top 10 analysis', 'CWE mapping', 'CVSS scoring'],
      ['security', 'vulnerabilities', 'owasp', 'audit']
    );

    const vulnFinding = this.createFinding(
      `Security Vulnerabilities: ${criticalCount} Critical, ${highCount} High`,
      JSON.stringify(vulnerabilities, null, 2),
      'security',
      0.90,
      ['Security scan'],
      ['vulnerabilities', 'cve', 'owasp']
    );

    this.state.metrics.tasksCompleted++;
    this.updateStatus('completed', 'Security audit complete');

    return {
      taskId: task.id,
      agentRole: this.config.role,
      success: true,
      findings: [securityFinding, vulnFinding],
      data: {
        audit: result.text,
        vulnerabilities,
        criticalCount,
        highCount,
        thinking: result.thinking,
      },
      tokensUsed: result.tokensUsed,
      thinkingTokens: result.thinkingTokens,
      duration: Date.now() - start,
      timestamp: new Date(),
    };
  }

  private extractVulnerabilities(text: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    const sections: Array<{ pattern: RegExp; severity: CodeIssue['severity'] }> = [
      { pattern: /###\s*2[^#]*CRITICAL VULNERABILITIES([\s\S]*?)(?=###|$)/i, severity: 'critical' },
      { pattern: /###\s*3[^#]*HIGH SEVERITY([\s\S]*?)(?=###|$)/i, severity: 'high' },
      { pattern: /###\s*4[^#]*MEDIUM SEVERITY([\s\S]*?)(?=###|$)/i, severity: 'medium' },
      { pattern: /###\s*5[^#]*LOW([\s\S]*?)(?=###|$)/i, severity: 'low' },
    ];

    for (const { pattern, severity } of sections) {
      const sectionMatch = text.match(pattern);
      if (!sectionMatch) continue;

      const blocks = sectionMatch[1].split(/\*\*\[VULN-/).slice(1);
      for (const block of blocks.slice(0, 10)) {
        const titleMatch = block.match(/^(\w+)\]\s*([^\n]+)/);
        const fileMatch = block.match(/\*\*File\*\*:\s*([^\n]+)/);
        const descMatch = block.match(/\*\*Description\*\*:\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);
        const cweMatch = block.match(/\*\*CWE\*\*:\s*([^\n]+)/);
        const fixMatch = block.match(/\*\*Fix\*\*:\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/);

        issues.push({
          id: `VULN-${String(issues.length + 1).padStart(3, '0')}`,
          severity,
          category: 'security',
          title: titleMatch?.[2]?.trim() || block.split('\n')[0].slice(0, 80),
          description: descMatch?.[1]?.trim() || block.slice(0, 200),
          file: fileMatch?.[1]?.trim(),
          suggestion: fixMatch?.[1]?.trim() || 'See full security audit for remediation details',
          references: cweMatch?.[1] ? [cweMatch[1].trim()] : undefined,
        });
      }
    }

    return issues;
  }
}
