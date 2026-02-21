// ============================================================
// PAPER EXPORTER — Export research papers in multiple formats
// Supports: LaTeX, Markdown, HTML, JSON
// ============================================================

import type { ResearchPaper, Citation, ExportFormat, ExportResult, CodeAnalysisReport } from '../models/types';

// ─── LaTeX Export ──────────────────────────────────────────
export function toLatex(paper: ResearchPaper, citations: Citation[]): string {
  const authorList = paper.authors.length > 0
    ? paper.authors.join(' \\and ')
    : 'Multi-Agent Research System';

  const keywordStr = paper.keywords.join(', ');
  const abstract = escapeLatex(paper.abstract);

  const sectionsLatex = paper.sections
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const title = escapeLatex(section.title);
      const content = escapeLatex(section.content);

      const subsections = section.subsections
        ? section.subsections
            .map(sub => `\\subsection{${escapeLatex(sub.title)}}\n${escapeLatex(sub.content)}`)
            .join('\n\n')
        : '';

      return `\\section{${title}}\n${content}\n${subsections}`;
    })
    .join('\n\n');

  const bibliography = citations
    .filter(c => c.doi || c.url)
    .map((c, i) => {
      const key = `ref${i + 1}`;
      const authors = c.authors.join(' and ');
      const year = c.year;
      const title = escapeLatex(c.title);
      const journal = c.journal ? escapeLatex(c.journal) : '';
      const doi = c.doi || '';

      return `@article{${key},
  author    = {${authors}},
  title     = {{${title}}},
  journal   = {${journal}},
  year      = {${year}},
  doi       = {${doi}}
}`;
    })
    .join('\n\n');

  return `\\documentclass[12pt,a4paper]{article}

% Packages
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{natbib}
\\usepackage{booktabs}
\\usepackage{geometry}
\\usepackage{setspace}
\\usepackage{authblk}

\\geometry{margin=2.5cm}
\\doublespacing

% Metadata
\\title{${escapeLatex(paper.title)}}
\\author{${authorList}}
\\date{${new Date(paper.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}}

\\begin{document}

\\maketitle

\\begin{abstract}
${abstract}
\\end{abstract}

\\textbf{Keywords:} ${keywordStr}

\\newpage
\\tableofcontents
\\newpage

${sectionsLatex}

% Bibliography
\\newpage
\\bibliographystyle{apa}
\\bibliography{references}

% Inline bibliography (fallback)
\\begin{thebibliography}{99}
${citations.map((c, i) => {
  const authorStr = c.authors.length > 0
    ? (c.authors.length === 1 ? c.authors[0] : c.authors.slice(0, -1).join(', ') + ' \\& ' + c.authors[c.authors.length - 1])
    : 'Unknown';
  return `\\bibitem{ref${i + 1}} ${escapeLatex(authorStr)} (${c.year}). ${escapeLatex(c.title)}. ${c.journal ? `\\textit{${escapeLatex(c.journal)}}.` : ''} ${c.doi ? `\\url{https://doi.org/${c.doi}}` : ''}`;
}).join('\n')}
\\end{thebibliography}

\\end{document}

% ─── references.bib ─────────────────────────────────────────
% Save the following as references.bib in the same directory:
%
${bibliography}
`;
}

// ─── Markdown Export ───────────────────────────────────────
export function toMarkdown(paper: ResearchPaper, citations: Citation[]): string {
  const header = `---
title: "${paper.title.replace(/"/g, '\\"')}"
authors: ${JSON.stringify(paper.authors)}
keywords: ${JSON.stringify(paper.keywords)}
generated: "${paper.generatedAt.toISOString()}"
word_count: ${paper.wordCount}
---

`;

  const title = `# ${paper.title}\n\n`;

  const authorsLine = paper.authors.length > 0
    ? `**Authors:** ${paper.authors.join(', ')}\n\n`
    : '';

  const keywordsLine = paper.keywords.length > 0
    ? `**Keywords:** ${paper.keywords.join(', ')}\n\n`
    : '';

  const abstractSection = `## Abstract\n\n${paper.abstract}\n\n`;

  const sections = paper.sections
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const subsections = section.subsections
        ? section.subsections.map(sub => `### ${sub.title}\n\n${sub.content}`).join('\n\n')
        : '';
      return `## ${section.title}\n\n${section.content}\n\n${subsections}`;
    })
    .join('\n\n---\n\n');

  const references = citations.length > 0
    ? `## References\n\n${citations.map((c, i) => {
        const authors = c.authors.length > 0
          ? c.authors.join(', ')
          : 'Unknown';
        const doi = c.doi ? ` https://doi.org/${c.doi}` : c.url ? ` ${c.url}` : '';
        const venue = c.journal ? ` *${c.journal}*.` : '';
        const verified = c.verified ? ' ✓' : '';
        return `${i + 1}. ${authors} (${c.year}). ${c.title}.${venue}${doi}${verified}`;
      }).join('\n')}`
    : '';

  return header + title + authorsLine + keywordsLine + abstractSection + sections + '\n\n---\n\n' + references;
}

// ─── HTML Export ───────────────────────────────────────────
export function toHTML(paper: ResearchPaper, citations: Citation[]): string {
  const escapeHtml = (text: string): string =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const markdownToHtml = (text: string): string =>
    text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[h|p|u|o|l])/gm, '');

  const sectionsHtml = paper.sections
    .sort((a, b) => a.order - b.order)
    .map(section => `
      <section id="section-${section.id}">
        <h2>${escapeHtml(section.title)}</h2>
        <p>${markdownToHtml(escapeHtml(section.content))}</p>
        ${section.subsections ? section.subsections.map(sub => `
          <h3>${escapeHtml(sub.title)}</h3>
          <p>${markdownToHtml(escapeHtml(sub.content))}</p>
        `).join('') : ''}
      </section>
    `)
    .join('\n');

  const referencesHtml = citations.length > 0
    ? `<section id="references">
        <h2>References</h2>
        <ol class="references-list">
          ${citations.map(c => {
            const authors = c.authors.join(', ');
            const doi = c.doi
              ? `<a href="https://doi.org/${c.doi}" target="_blank">https://doi.org/${c.doi}</a>`
              : c.url ? `<a href="${c.url}" target="_blank">${c.url}</a>` : '';
            const venue = c.journal ? `<em>${escapeHtml(c.journal)}</em>. ` : '';
            const verified = c.verified ? ' <span class="badge verified">✓ Verified</span>' : '';
            return `<li>${escapeHtml(authors)} (${c.year}). ${escapeHtml(c.title)}. ${venue}${doi}${verified}</li>`;
          }).join('\n')}
        </ol>
      </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(paper.title)}</title>
  <style>
    :root {
      --primary: #1a1a2e;
      --accent: #4f46e5;
      --text: #1f2937;
      --muted: #6b7280;
      --bg: #ffffff;
      --border: #e5e7eb;
    }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 16px;
      line-height: 1.8;
      color: var(--text);
      background: var(--bg);
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px 80px;
    }
    h1 { font-size: 2rem; line-height: 1.3; color: var(--primary); margin-bottom: 0.5rem; }
    h2 { font-size: 1.4rem; color: var(--primary); border-bottom: 2px solid var(--accent); padding-bottom: 0.3rem; margin-top: 2.5rem; }
    h3 { font-size: 1.15rem; color: var(--primary); margin-top: 1.5rem; }
    .meta { color: var(--muted); font-size: 0.9rem; margin-bottom: 2rem; }
    .abstract { background: #f9fafb; border-left: 4px solid var(--accent); padding: 1.5rem; margin: 2rem 0; border-radius: 0 8px 8px 0; }
    .abstract h2 { border: none; margin-top: 0; }
    .keywords { margin-top: 1rem; font-size: 0.9rem; }
    .keywords span { background: #ede9fe; color: var(--accent); padding: 2px 8px; border-radius: 4px; margin-right: 4px; display: inline-block; }
    section { margin-bottom: 2rem; }
    p { margin: 1rem 0; text-align: justify; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
    .references-list { padding-left: 1.5rem; }
    .references-list li { margin: 0.8rem 0; font-size: 0.9rem; }
    .badge { font-size: 0.75rem; padding: 1px 6px; border-radius: 4px; }
    .badge.verified { background: #d1fae5; color: #065f46; }
    a { color: var(--accent); }
    @media print {
      body { max-width: 100%; padding: 0; }
      h2 { page-break-before: always; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(paper.title)}</h1>
    <div class="meta">
      ${paper.authors.length > 0 ? `<p><strong>Authors:</strong> ${escapeHtml(paper.authors.join(', '))}</p>` : ''}
      <p><strong>Generated:</strong> ${new Date(paper.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} | <strong>Word Count:</strong> ${paper.wordCount.toLocaleString()}</p>
    </div>
    ${paper.keywords.length > 0 ? `
    <div class="keywords">
      <strong>Keywords:</strong>
      ${paper.keywords.map(k => `<span>${escapeHtml(k)}</span>`).join(' ')}
    </div>` : ''}
  </header>

  <div class="abstract">
    <h2>Abstract</h2>
    <p>${escapeHtml(paper.abstract)}</p>
  </div>

  <main>
    ${sectionsHtml}
  </main>

  ${referencesHtml}

  <footer style="margin-top: 4rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: 0.8rem; color: var(--muted);">
    <p>Generated by Multi-Agent Research System using Claude Opus 4.6 | ${new Date().toISOString()}</p>
  </footer>
</body>
</html>`;
}

// ─── Code Analysis Report Export ───────────────────────────
export function codeReportToMarkdown(report: CodeAnalysisReport): string {
  const header = `# Code Analysis Report: ${report.projectName}
*Generated: ${new Date(report.generatedAt).toLocaleString()}*

---

## Executive Summary

${report.summary}

---

## Code Quality Metrics

| Metric | Score |
|--------|-------|
| Overall Score | ${report.metrics.overallScore}/100 |
| Security Score | ${report.metrics.securityScore}/100 |
| Maintainability | ${report.metrics.maintainabilityScore}/100 |
| Documentation | ${report.metrics.documentationScore}/100 |

**Codebase Stats:**
- Total Files: ${report.metrics.totalFiles}
- Total Lines: ${report.metrics.totalLines.toLocaleString()}
- Languages: ${Object.entries(report.metrics.languages).map(([l, n]) => `${l} (${n} lines)`).join(', ')}

**Issues by Severity:**
- 🔴 Critical: ${report.metrics.issuesBySeverity['critical'] || 0}
- 🟠 High: ${report.metrics.issuesBySeverity['high'] || 0}
- 🟡 Medium: ${report.metrics.issuesBySeverity['medium'] || 0}
- 🟢 Low: ${report.metrics.issuesBySeverity['low'] || 0}

---

## Top Recommendations

${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---
`;

  const issues = report.issues.length > 0 ? `
## Issues Found

${report.issues.slice(0, 20).map(issue => `
### ${issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : issue.severity === 'medium' ? '🟡' : '🟢'} ${issue.title}

- **Severity:** ${issue.severity.toUpperCase()}
- **Category:** ${issue.category}
${issue.file ? `- **File:** \`${issue.file}\`` : ''}
- **Description:** ${issue.description}
- **Fix:** ${issue.suggestion}
${issue.references ? `- **References:** ${issue.references.join(', ')}` : ''}
`).join('\n')}
` : '';

  const sections = report.sections.map(s => `
## ${s.title}

${s.content.slice(0, 3000)}${s.content.length > 3000 ? '\n\n*[Truncated — see full report]*' : ''}
`).join('\n\n---\n\n');

  const docs = report.generatedDocs.readme ? `
---

## Generated Documentation

### README.md

\`\`\`markdown
${report.generatedDocs.readme.slice(0, 2000)}
\`\`\`
` : '';

  return header + issues + sections + docs;
}

// ─── Main Export Function ──────────────────────────────────
export function exportPaper(
  paper: ResearchPaper,
  citations: Citation[],
  format: ExportFormat
): ExportResult {
  switch (format) {
    case 'latex': {
      const content = toLatex(paper, citations);
      return {
        format,
        content,
        filename: `${sanitizeFilename(paper.title)}.tex`,
        mimeType: 'application/x-latex',
      };
    }
    case 'markdown': {
      const content = toMarkdown(paper, citations);
      return {
        format,
        content,
        filename: `${sanitizeFilename(paper.title)}.md`,
        mimeType: 'text/markdown',
      };
    }
    case 'html': {
      const content = toHTML(paper, citations);
      return {
        format,
        content,
        filename: `${sanitizeFilename(paper.title)}.html`,
        mimeType: 'text/html',
      };
    }
    case 'json': {
      const content = JSON.stringify({ paper, citations }, null, 2);
      return {
        format,
        content,
        filename: `${sanitizeFilename(paper.title)}.json`,
        mimeType: 'application/json',
      };
    }
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// ─── Helpers ───────────────────────────────────────────────
function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}');
}
