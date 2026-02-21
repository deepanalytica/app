// ============================================================
// GITHUB FETCHER — Fetch Repository Contents for Code Analysis
// Uses GitHub REST API (works without token, with rate limits)
// ============================================================

import type { CodeFile } from '../models/types';

const GITHUB_API = 'https://api.github.com';

// File extensions considered as code (not binary/config/lock)
const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'pyw', 'pyx',
  'java', 'kt', 'kts',
  'go',
  'rs',
  'cpp', 'cc', 'cxx', 'c', 'h', 'hpp',
  'cs',
  'rb', 'rake',
  'php',
  'swift',
  'scala',
  'r', 'R',
  'sh', 'bash', 'zsh',
  'sql',
  'vue', 'svelte',
  'html', 'htm',
  'css', 'scss', 'sass', 'less',
  'json', 'yaml', 'yml', 'toml',
  'md', 'mdx',
  'dockerfile',
]);

// Files/dirs to skip
const SKIP_PATTERNS = [
  'node_modules', 'vendor', '.git', 'dist', 'build', '__pycache__',
  '.next', '.nuxt', 'coverage', '.cache', 'venv', 'env',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock',
  'Gemfile.lock', 'composer.lock', 'poetry.lock',
];

const MAX_FILE_SIZE_BYTES = 100_000; // 100 KB per file
const MAX_FILES = 60;

export interface GitHubRepo {
  owner: string;
  name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  files: CodeFile[];
  fileTree: string; // ASCII representation
  defaultBranch: string;
  url: string;
}

export interface GitHubFetchOptions {
  token?: string;         // Personal access token (optional, increases rate limit)
  maxFiles?: number;      // Maximum files to fetch (default 60)
  branch?: string;        // Branch to fetch (default: default branch)
  pathFilter?: string;    // Only fetch files under this path (e.g., 'src/')
}

// ─── Main Entry Point ──────────────────────────────────────
export async function fetchGitHubRepo(
  githubUrl: string,
  options: GitHubFetchOptions = {}
): Promise<GitHubRepo> {
  const { owner, repo } = parseGitHubUrl(githubUrl);
  const token = options.token || process.env.GITHUB_TOKEN;
  const maxFiles = options.maxFiles || MAX_FILES;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'MultiAgentResearchSystem/1.0',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 1. Get repo metadata
  const repoData = await fetchJson<GitHubRepoResponse>(
    `${GITHUB_API}/repos/${owner}/${repo}`,
    headers
  );

  const defaultBranch = options.branch || repoData.default_branch || 'main';

  // 2. Get file tree (recursive)
  const treeData = await fetchJson<GitHubTreeResponse>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    headers
  );

  // 3. Filter to code files
  const codeBlobs = treeData.tree
    .filter((item) => {
      if (item.type !== 'blob') return false;
      if (!item.path) return false;
      // Skip ignored patterns
      if (SKIP_PATTERNS.some((p) => item.path!.includes(p))) return false;
      // Apply path filter if provided
      if (options.pathFilter && !item.path.startsWith(options.pathFilter)) return false;
      // Check extension
      const ext = item.path.split('.').pop()?.toLowerCase() || '';
      const filename = item.path.split('/').pop()?.toLowerCase() || '';
      return CODE_EXTENSIONS.has(ext) || CODE_EXTENSIONS.has(filename);
    })
    .filter((item) => (item.size || 0) <= MAX_FILE_SIZE_BYTES)
    .slice(0, maxFiles);

  // 4. Fetch file contents (in parallel batches of 10)
  const files: CodeFile[] = [];
  for (let i = 0; i < codeBlobs.length; i += 10) {
    const batch = codeBlobs.slice(i, i + 10);
    const batchResults = await Promise.allSettled(
      batch.map((blob) => fetchFileContent(`${GITHUB_API}/repos/${owner}/${repo}/contents/${blob.path ?? ''}`, headers, blob.path ?? ''))
    );
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        files.push(result.value);
      }
    }
  }

  // 5. Build file tree string
  const fileTree = buildFileTree(files.map((f) => f.path));

  return {
    owner,
    name: repo,
    description: repoData.description || '',
    language: repoData.language || 'Unknown',
    stars: repoData.stargazers_count || 0,
    forks: repoData.forks_count || 0,
    files,
    fileTree,
    defaultBranch,
    url: `https://github.com/${owner}/${repo}`,
  };
}

// ─── File Content Fetcher ──────────────────────────────────
async function fetchFileContent(
  url: string,
  headers: Record<string, string>,
  path: string
): Promise<CodeFile | null> {
  try {
    const data = await fetchJson<GitHubContentResponse>(url, headers);

    if (data.type !== 'file' || !data.content) return null;

    // Decode base64 content
    const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');

    const ext = path.split('.').pop()?.toLowerCase() || '';
    const language = detectLanguage(ext, path);

    return {
      name: path.split('/').pop() || path,
      path,
      content,
      language,
      sizeBytes: data.size || 0,
      lineCount: content.split('\n').length,
    };
  } catch {
    return null;
  }
}

// ─── Language Detection ────────────────────────────────────
function detectLanguage(ext: string, path: string): string {
  const filename = path.split('/').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
    mjs: 'JavaScript', cjs: 'JavaScript', py: 'Python', pyw: 'Python',
    pyx: 'Python', java: 'Java', kt: 'Kotlin', kts: 'Kotlin', go: 'Go',
    rs: 'Rust', cpp: 'C++', cc: 'C++', cxx: 'C++', c: 'C', h: 'C/C++',
    hpp: 'C++', cs: 'C#', rb: 'Ruby', rake: 'Ruby', php: 'PHP',
    swift: 'Swift', scala: 'Scala', r: 'R', sh: 'Shell', bash: 'Shell',
    zsh: 'Shell', sql: 'SQL', vue: 'Vue', svelte: 'Svelte', html: 'HTML',
    htm: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', md: 'Markdown',
    mdx: 'MDX',
  };

  if (filename === 'dockerfile') return 'Dockerfile';
  if (filename === 'makefile') return 'Makefile';
  if (filename === 'rakefile') return 'Ruby';

  return map[ext] || ext.toUpperCase() || 'Unknown';
}

// ─── File Tree Builder ─────────────────────────────────────
function buildFileTree(paths: string[]): string {
  const tree: Record<string, unknown> = {};

  for (const path of paths.sort()) {
    const parts = path.split('/');
    let node: Record<string, unknown> = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!node[part]) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = null;
  }

  const lines: string[] = [];
  function render(node: Record<string, unknown>, prefix = '', isLast = false): void {
    const keys = Object.keys(node).sort((a, b) => {
      const aIsDir = node[a] !== null;
      const bIsDir = node[b] !== null;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    keys.forEach((key, i) => {
      const last = i === keys.length - 1;
      const connector = last ? '└── ' : '├── ';
      const isDir = node[key] !== null;
      lines.push(`${prefix}${connector}${key}${isDir ? '/' : ''}`);
      if (isDir) {
        render(
          node[key] as Record<string, unknown>,
          prefix + (last ? '    ' : '│   '),
          last
        );
      }
    });
  }

  render(tree);
  return lines.join('\n');
}

// ─── URL Parser ────────────────────────────────────────────
export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  // Handles:
  // https://github.com/owner/repo
  // https://github.com/owner/repo.git
  // github.com/owner/repo
  // owner/repo
  const cleaned = url
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');

  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Invalid GitHub URL: "${url}". Expected format: https://github.com/owner/repo`
    );
  }

  return { owner: parts[0], repo: parts[1] };
}

// ─── HTTP Helper ───────────────────────────────────────────
async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20000),
  });

  if (res.status === 404) {
    throw new Error(`Repository not found: ${url}`);
  }
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    throw new Error(
      remaining === '0'
        ? 'GitHub API rate limit exceeded. Provide a GitHub token to increase limits.'
        : `GitHub API access forbidden: ${url}`
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub API error: HTTP ${res.status} for ${url}`);
  }

  return res.json() as Promise<T>;
}

// ─── GitHub API Response Types ─────────────────────────────
interface GitHubRepoResponse {
  default_branch: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

interface GitHubTreeResponse {
  tree: Array<{
    path?: string;
    type?: string;
    size?: number;
    sha?: string;
    url?: string;
  }>;
  truncated?: boolean;
}

interface GitHubContentResponse {
  type: string;
  content?: string;
  size?: number;
  encoding?: string;
}

// ─── Code Summarizer (for context injection) ───────────────
export function summarizeCodeFiles(files: CodeFile[], maxChars = 50_000): string {
  const lines: string[] = [];
  let totalChars = 0;

  // Sort: config files first, then by size (smaller first for coverage)
  const sorted = [...files].sort((a, b) => {
    const aConfig = ['package.json', 'tsconfig.json', 'setup.py', 'go.mod', 'Cargo.toml'].includes(a.name);
    const bConfig = ['package.json', 'tsconfig.json', 'setup.py', 'go.mod', 'Cargo.toml'].includes(b.name);
    if (aConfig && !bConfig) return -1;
    if (!aConfig && bConfig) return 1;
    return (a.sizeBytes || 0) - (b.sizeBytes || 0);
  });

  for (const file of sorted) {
    if (totalChars >= maxChars) {
      lines.push(`\n[...${files.length - sorted.indexOf(file)} more files truncated for context]`);
      break;
    }

    const available = maxChars - totalChars;
    const content =
      file.content.length > available
        ? file.content.slice(0, available) + '\n[...truncated]'
        : file.content;

    lines.push(`\n${'='.repeat(60)}`);
    lines.push(`FILE: ${file.path} (${file.language}, ${file.lineCount} lines)`);
    lines.push('='.repeat(60));
    lines.push(content);

    totalChars += content.length + file.path.length + 80;
  }

  return lines.join('\n');
}
