// ============================================================
// ACADEMIC SEARCH TOOL — Real Database Integration
// Semantic Scholar + arXiv + CrossRef (all free, no API key required)
// ============================================================

import type Anthropic from '@anthropic-ai/sdk';
import type { AcademicSearchResult, Citation } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

const SEMANTIC_SCHOLAR_BASE = 'https://api.semanticscholar.org/graph/v1';
const ARXIV_BASE = 'https://export.arxiv.org/api/query';
const CROSSREF_BASE = 'https://api.crossref.org/works';

const SEARCH_FIELDS =
  'title,authors,year,abstract,citationCount,externalIds,publicationVenue,openAccessPdf';

// ─── Semantic Scholar ──────────────────────────────────────
export async function searchSemanticScholar(
  query: string,
  limit = 10,
  yearFrom?: number,
  yearTo?: number
): Promise<AcademicSearchResult[]> {
  try {
    const url = new URL(`${SEMANTIC_SCHOLAR_BASE}/paper/search`);
    url.searchParams.set('query', query);
    url.searchParams.set('fields', SEARCH_FIELDS);
    url.searchParams.set('limit', String(Math.min(limit, 100)));

    // Semantic Scholar supports year range filtering via ?year=YYYY-YYYY
    if (yearFrom || yearTo) {
      const from = yearFrom ?? 1900;
      const to = yearTo ?? new Date().getFullYear();
      url.searchParams.set('year', `${from}-${to}`);
    }

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'MultiAgentResearchSystem/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[SemanticScholar] HTTP ${res.status} for query: ${query}`);
      return [];
    }

    const data = (await res.json()) as {
      data?: Array<{
        paperId?: string;
        title?: string;
        authors?: Array<{ name: string }>;
        year?: number;
        abstract?: string;
        citationCount?: number;
        externalIds?: { DOI?: string; ArXiv?: string };
        publicationVenue?: { name?: string };
      }>;
    };

    if (!data.data) return [];

    return data.data
      .filter((p) => p.title && p.year)
      .map((p) => ({
        title: p.title!,
        authors: (p.authors || []).map((a) => a.name),
        year: p.year!,
        abstract: p.abstract || '',
        doi: p.externalIds?.DOI,
        url: p.externalIds?.DOI
          ? `https://doi.org/${p.externalIds.DOI}`
          : p.externalIds?.ArXiv
          ? `https://arxiv.org/abs/${p.externalIds.ArXiv}`
          : undefined,
        citationCount: p.citationCount,
        venue: p.publicationVenue?.name,
        source: 'semantic_scholar' as const,
        paperId: p.paperId,
      }));
  } catch (err) {
    console.warn('[SemanticScholar] Search failed:', (err as Error).message);
    return [];
  }
}

// ─── arXiv ─────────────────────────────────────────────────
export async function searchArxiv(
  query: string,
  limit = 10,
  yearFrom?: number,
  yearTo?: number
): Promise<AcademicSearchResult[]> {
  try {
    const url = new URL(ARXIV_BASE);

    // arXiv supports date filtering via submittedDate:[YYYYMMDD TO YYYYMMDD]
    let fullQuery = `all:${query}`;
    if (yearFrom || yearTo) {
      const from = yearFrom ? `${yearFrom}0101` : '19000101';
      const to = yearTo ? `${yearTo}1231` : `${new Date().getFullYear()}1231`;
      fullQuery += ` AND submittedDate:[${from}000000 TO ${to}235959]`;
    }

    url.searchParams.set('search_query', fullQuery);
    url.searchParams.set('max_results', String(Math.min(limit, 50)));
    url.searchParams.set('sortBy', 'relevance');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'MultiAgentResearchSystem/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];

    const xml = await res.text();
    return parseArxivXml(xml);
  } catch (err) {
    console.warn('[arXiv] Search failed:', (err as Error).message);
    return [];
  }
}

function parseArxivXml(xml: string): AcademicSearchResult[] {
  const results: AcademicSearchResult[] = [];

  // Extract entries using simple regex parsing (no XML dependency needed)
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];

  for (const entry of entries) {
    const title = extractXmlTag(entry, 'title')?.replace(/\s+/g, ' ').trim();
    const abstract = extractXmlTag(entry, 'summary')?.replace(/\s+/g, ' ').trim();
    const published = extractXmlTag(entry, 'published');
    const year = published ? parseInt(published.substring(0, 4)) : new Date().getFullYear();
    const id = extractXmlTag(entry, 'id');
    const arxivId = id?.replace('http://arxiv.org/abs/', '').replace('https://arxiv.org/abs/', '');

    // Extract authors
    const authorMatches = entry.match(/<name>(.*?)<\/name>/g) || [];
    const authors = authorMatches.map((a) => a.replace(/<\/?name>/g, '').trim());

    // Extract DOI if present
    const doiMatch = entry.match(/doi\.org\/(10\.[^"'\s<]+)/);
    const doi = doiMatch ? doiMatch[1] : undefined;

    if (title && authors.length > 0) {
      results.push({
        title,
        authors,
        year,
        abstract: abstract || '',
        doi,
        url: id || (arxivId ? `https://arxiv.org/abs/${arxivId}` : undefined),
        source: 'arxiv',
        paperId: arxivId,
      });
    }
  }

  return results;
}

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].trim() : null;
}

// ─── CrossRef DOI Verification ─────────────────────────────
export async function verifyDoi(doi: string): Promise<AcademicSearchResult | null> {
  try {
    // Normalize DOI
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '').trim();
    const url = `${CROSSREF_BASE}/${encodeURIComponent(cleanDoi)}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MultiAgentResearchSystem/1.0 (mailto:research@system.ai)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      message?: {
        title?: string[];
        author?: Array<{ given?: string; family?: string }>;
        'published-print'?: { 'date-parts'?: number[][] };
        'published-online'?: { 'date-parts'?: number[][] };
        abstract?: string;
        DOI?: string;
        'container-title'?: string[];
        'is-referenced-by-count'?: number;
      };
    };

    const msg = data.message;
    if (!msg) return null;

    const dateparts =
      msg['published-print']?.['date-parts']?.[0] ||
      msg['published-online']?.['date-parts']?.[0];
    const year = dateparts?.[0] ?? new Date().getFullYear();

    const authors = (msg.author || []).map((a) =>
      [a.given, a.family].filter(Boolean).join(' ')
    );

    return {
      title: msg.title?.[0] || 'Unknown title',
      authors,
      year,
      abstract: msg.abstract?.replace(/<[^>]+>/g, '') || '',
      doi: msg.DOI || cleanDoi,
      url: `https://doi.org/${msg.DOI || cleanDoi}`,
      citationCount: msg['is-referenced-by-count'],
      venue: msg['container-title']?.[0],
      source: 'crossref',
    };
  } catch (err) {
    console.warn('[CrossRef] DOI verification failed:', (err as Error).message);
    return null;
  }
}

// ─── Combined Search ───────────────────────────────────────
export async function searchAllDatabases(
  query: string,
  limit = 10,
  yearFrom?: number,
  yearTo?: number
): Promise<AcademicSearchResult[]> {
  const [ssResults, arxivResults] = await Promise.all([
    searchSemanticScholar(query, limit, yearFrom, yearTo),
    searchArxiv(query, Math.ceil(limit / 2), yearFrom, yearTo),
  ]);

  // Merge and deduplicate by DOI
  const seen = new Set<string>();
  const merged: AcademicSearchResult[] = [];

  for (const r of [...ssResults, ...arxivResults]) {
    const key = r.doi || r.title.toLowerCase().slice(0, 50);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(r);
    }
  }

  // Sort by citation count (descending), then by year
  return merged.sort((a, b) => {
    const cA = a.citationCount ?? 0;
    const cB = b.citationCount ?? 0;
    if (cB !== cA) return cB - cA;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

// ─── Convert to Citation ───────────────────────────────────
export function toCitation(result: AcademicSearchResult, relevanceScore = 0.8): Citation {
  return {
    id: uuidv4(),
    authors: result.authors,
    title: result.title,
    journal: result.venue,
    year: result.year,
    doi: result.doi,
    url: result.url,
    abstract: result.abstract,
    relevanceScore,
    citationCount: result.citationCount,
    verified: true,
    source: result.source,
  };
}

// ─── Claude Tool Definitions ───────────────────────────────
// Used by LiteratureReviewAgent and CitationManagerAgent for tool calling
export const academicSearchTools: Anthropic.Tool[] = [
  {
    name: 'search_academic_papers',
    description:
      'Search real academic databases (Semantic Scholar + arXiv) for peer-reviewed papers. Returns actual papers with verified DOIs and citation counts. Use year_from and year_to to restrict results to a specific publication period.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g. "deep learning image classification")',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default 10, max 20)',
        },
        source: {
          type: 'string',
          enum: ['semantic_scholar', 'arxiv', 'both'],
          description: 'Which database to search (default "both")',
        },
        year_from: {
          type: 'number',
          description: 'Only return papers published from this year onwards (e.g. 2020). Omit for all years.',
        },
        year_to: {
          type: 'number',
          description: 'Only return papers published up to this year inclusive (e.g. 2026). Defaults to current year.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'verify_doi',
    description:
      'Verify that a DOI exists and retrieve full citation details from CrossRef. Use this to validate any DOI before including it in the paper.',
    input_schema: {
      type: 'object' as const,
      properties: {
        doi: {
          type: 'string',
          description: 'DOI to verify (e.g. "10.1038/s41586-020-2649-2")',
        },
      },
      required: ['doi'],
    },
  },
  {
    name: 'search_by_topic',
    description:
      'Search multiple related queries to build a comprehensive literature base. Use when you need to cover different aspects of the research topic. Apply year filters to restrict the timeframe.',
    input_schema: {
      type: 'object' as const,
      properties: {
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of search queries (max 5)',
        },
        results_per_query: {
          type: 'number',
          description: 'Results per query (default 5)',
        },
        year_from: {
          type: 'number',
          description: 'Only return papers published from this year onwards (e.g. 2020).',
        },
        year_to: {
          type: 'number',
          description: 'Only return papers published up to this year inclusive (e.g. 2026).',
        },
      },
      required: ['queries'],
    },
  },
];

// ─── Tool Execution Handler ────────────────────────────────
export async function executeAcademicSearchTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case 'search_academic_papers': {
        const query = toolInput.query as string;
        const limit = (toolInput.max_results as number) || 10;
        const source = (toolInput.source as string) || 'both';
        const yearFrom = toolInput.year_from as number | undefined;
        const yearTo = toolInput.year_to as number | undefined;

        let results: AcademicSearchResult[] = [];
        if (source === 'semantic_scholar') {
          results = await searchSemanticScholar(query, limit, yearFrom, yearTo);
        } else if (source === 'arxiv') {
          results = await searchArxiv(query, limit, yearFrom, yearTo);
        } else {
          results = await searchAllDatabases(query, limit, yearFrom, yearTo);
        }

        // Post-filter as safety net in case the API ignored the year params
        if (yearFrom) results = results.filter((r) => r.year >= yearFrom);
        if (yearTo) results = results.filter((r) => r.year <= yearTo);

        if (results.length === 0) {
          return JSON.stringify({ status: 'no_results', query, message: 'No papers found for this query. Try different search terms.' });
        }

        return JSON.stringify({
          status: 'success',
          query,
          total: results.length,
          papers: results.map((r) => ({
            title: r.title,
            authors: r.authors.slice(0, 3).join(', ') + (r.authors.length > 3 ? ' et al.' : ''),
            year: r.year,
            abstract: r.abstract.slice(0, 300) + (r.abstract.length > 300 ? '...' : ''),
            doi: r.doi,
            url: r.url,
            citationCount: r.citationCount,
            venue: r.venue,
            source: r.source,
          })),
        });
      }

      case 'verify_doi': {
        const doi = toolInput.doi as string;
        const result = await verifyDoi(doi);
        if (!result) {
          return JSON.stringify({ status: 'not_found', doi, message: 'DOI could not be verified. It may not exist or CrossRef may not have it indexed.' });
        }
        return JSON.stringify({
          status: 'verified',
          doi,
          paper: {
            title: result.title,
            authors: result.authors,
            year: result.year,
            venue: result.venue,
            citationCount: result.citationCount,
            abstract: result.abstract?.slice(0, 200),
          },
        });
      }

      case 'search_by_topic': {
        const queries = (toolInput.queries as string[]).slice(0, 5);
        const limit = (toolInput.results_per_query as number) || 5;
        const yearFrom = toolInput.year_from as number | undefined;
        const yearTo = toolInput.year_to as number | undefined;

        const allResults = await Promise.all(
          queries.map((q) => searchAllDatabases(q, limit, yearFrom, yearTo))
        );

        const seen = new Set<string>();
        const merged: AcademicSearchResult[] = [];
        for (const batch of allResults) {
          for (const r of batch) {
            const key = r.doi || r.title.toLowerCase().slice(0, 50);
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(r);
            }
          }
        }

        // Post-filter as safety net
        const filteredMerged = merged
          .filter((r) => (!yearFrom || r.year >= yearFrom) && (!yearTo || r.year <= yearTo));

        return JSON.stringify({
          status: 'success',
          queries,
          total: filteredMerged.length,
          papers: filteredMerged
            .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
            .slice(0, 30)
            .map((r) => ({
              title: r.title,
              authors: r.authors.slice(0, 3).join(', ') + (r.authors.length > 3 ? ' et al.' : ''),
              year: r.year,
              doi: r.doi,
              citationCount: r.citationCount,
              venue: r.venue,
              source: r.source,
            })),
        });
      }

      default:
        return JSON.stringify({ status: 'error', message: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    return JSON.stringify({
      status: 'error',
      message: `Tool execution failed: ${(err as Error).message}`,
    });
  }
}
