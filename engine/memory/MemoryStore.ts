// ============================================================
// MEMORY STORE — Persistent file-based storage
// Atomic JSON writes to data/ directory.
// Works on Railway, local dev, any platform with a filesystem.
// ============================================================

import fs from 'fs';
import path from 'path';
import type {
  ResearchSession,
  KnowledgeSkill,
  ChangeProposal,
  PromptOverride,
  PerformanceSnapshot,
  SessionSummary,
  MemoryIndex,
  AnyAgentRole,
} from '../models/types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const SKILLS_DIR = path.join(DATA_DIR, 'skills');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const PROPOSALS_FILE = path.join(DATA_DIR, 'proposals.json');
const OVERRIDES_FILE = path.join(DATA_DIR, 'overrides.json');
const PERFORMANCE_FILE = path.join(DATA_DIR, 'performance.json');

// ─── Helpers ────────────────────────────────────────────────

function ensureDirs(): void {
  for (const dir of [DATA_DIR, SESSIONS_DIR, SKILLS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function atomicWrite(filePath: string, data: unknown): void {
  ensureDirs();
  const tmp = filePath + '.tmp.' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJSON<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function emptyIndex(): MemoryIndex {
  return {
    sessions: { byDomain: {}, byTopic: {}, all: [] },
    skills: { byDomain: {}, byTag: {}, all: [] },
    proposals: { pending: [], approved: [], rejected: [] },
    lastUpdated: new Date().toISOString(),
  };
}

// ─── MemoryStore ────────────────────────────────────────────

export class MemoryStore {
  private static instance: MemoryStore;

  static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  constructor() {
    ensureDirs();
  }

  // ── Index ─────────────────────────────────────────────────

  private loadIndex(): MemoryIndex {
    return readJSON<MemoryIndex>(INDEX_FILE, emptyIndex());
  }

  private saveIndex(index: MemoryIndex): void {
    index.lastUpdated = new Date().toISOString();
    atomicWrite(INDEX_FILE, index);
  }

  // ── Sessions ──────────────────────────────────────────────

  /**
   * Persist a completed or in-progress research session.
   * Sessions with Maps are serialized to plain objects.
   */
  saveSession(session: ResearchSession): void {
    ensureDirs();
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    // Convert Map to object for JSON serialization
    const serializable = {
      ...session,
      agents: Object.fromEntries(session.agents),
      startTime: session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime,
      endTime: session.endTime instanceof Date ? session.endTime?.toISOString() : session.endTime,
    };
    atomicWrite(filePath, serializable);

    // Update index
    const index = this.loadIndex();
    const summary = this.sessionToSummary(session);

    // Update all list (dedup by id)
    const existing = index.sessions.all.findIndex(s => s.id === session.id);
    if (existing >= 0) {
      index.sessions.all[existing] = summary;
    } else {
      index.sessions.all.unshift(summary);
    }

    // Update domain index
    const domain = (session.domain || 'general').toLowerCase();
    if (!index.sessions.byDomain[domain]) index.sessions.byDomain[domain] = [];
    if (!index.sessions.byDomain[domain].includes(session.id)) {
      index.sessions.byDomain[domain].push(session.id);
    }

    // Update topic keyword index
    const words = session.topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      if (!index.sessions.byTopic[word]) index.sessions.byTopic[word] = [];
      if (!index.sessions.byTopic[word].includes(session.id)) {
        index.sessions.byTopic[word].push(session.id);
      }
    }

    this.saveIndex(index);
  }

  getSession(sessionId: string): ResearchSession | null {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    const data = readJSON<Record<string, unknown> | null>(filePath, null);
    if (!data) return null;

    // Re-hydrate: agents object → Map
    return {
      ...data,
      agents: new Map(Object.entries(data.agents as Record<string, unknown>)),
      startTime: new Date(data.startTime as string),
      endTime: data.endTime ? new Date(data.endTime as string) : undefined,
    } as unknown as ResearchSession;
  }

  listSessions(limit = 50, offset = 0, domain?: string): SessionSummary[] {
    const index = this.loadIndex();
    let all = index.sessions.all;
    if (domain) {
      const ids = index.sessions.byDomain[domain.toLowerCase()] || [];
      all = all.filter(s => ids.includes(s.id));
    }
    return all.slice(offset, offset + limit);
  }

  searchSessions(query: string): SessionSummary[] {
    const index = this.loadIndex();
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const matchIds = new Set<string>();

    for (const word of words) {
      for (const [key, ids] of Object.entries(index.sessions.byTopic)) {
        if (key.includes(word)) ids.forEach(id => matchIds.add(id));
      }
      for (const [domain, ids] of Object.entries(index.sessions.byDomain)) {
        if (domain.includes(word)) ids.forEach(id => matchIds.add(id));
      }
    }

    return index.sessions.all.filter(s => matchIds.has(s.id));
  }

  updateSessionSkillId(sessionId: string, skillId: string): void {
    const index = this.loadIndex();
    const summary = index.sessions.all.find(s => s.id === sessionId);
    if (summary) {
      summary.skillExtracted = true;
      summary.skillId = skillId;
      this.saveIndex(index);
    }
  }

  private sessionToSummary(session: ResearchSession): SessionSummary {
    return {
      id: session.id,
      topic: session.topic,
      domain: session.domain,
      researchQuestion: session.researchQuestion,
      phase: session.phase,
      startTime: session.startTime instanceof Date ? session.startTime.toISOString() : String(session.startTime),
      endTime: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime ? String(session.endTime) : undefined,
      qualityScore: session.metadata.qualityScore,
      totalTokens: session.metadata.totalTokens,
      estimatedCost: session.metadata.estimatedCost,
      findingsCount: session.findings.length,
      citationsCount: session.citations.length,
      hasPaper: !!session.paper,
      skillExtracted: false,
    };
  }

  // ── Knowledge Skills ──────────────────────────────────────

  saveSkill(skill: KnowledgeSkill): void {
    ensureDirs();
    const filePath = path.join(SKILLS_DIR, `${skill.id}.json`);
    atomicWrite(filePath, skill);

    // Update index
    const index = this.loadIndex();

    const existing = index.skills.all.findIndex(s => s.id === skill.id);
    const summary = {
      id: skill.id,
      domain: skill.domain,
      topic: skill.topic,
      title: skill.title,
      qualityScore: skill.qualityScore,
      createdAt: skill.createdAt,
    };

    if (existing >= 0) {
      index.skills.all[existing] = summary;
    } else {
      index.skills.all.unshift(summary);
    }

    // Domain index
    const domain = skill.domain.toLowerCase();
    if (!index.skills.byDomain[domain]) index.skills.byDomain[domain] = [];
    if (!index.skills.byDomain[domain].includes(skill.id)) {
      index.skills.byDomain[domain].push(skill.id);
    }

    // Tag index
    for (const tag of skill.tags) {
      const t = tag.toLowerCase();
      if (!index.skills.byTag[t]) index.skills.byTag[t] = [];
      if (!index.skills.byTag[t].includes(skill.id)) {
        index.skills.byTag[t].push(skill.id);
      }
    }

    this.saveIndex(index);
  }

  getSkill(skillId: string): KnowledgeSkill | null {
    const filePath = path.join(SKILLS_DIR, `${skillId}.json`);
    return readJSON<KnowledgeSkill | null>(filePath, null);
  }

  listSkills(domain?: string, tags?: string[], limit = 50): KnowledgeSkill[] {
    const index = this.loadIndex();
    let candidateIds: string[] = [];

    if (domain) {
      candidateIds = [...(index.skills.byDomain[domain.toLowerCase()] || [])];
    } else if (tags && tags.length > 0) {
      const sets = tags.map(t => new Set(index.skills.byTag[t.toLowerCase()] || []));
      const intersection = [...sets[0]].filter(id => sets.every(s => s.has(id)));
      candidateIds = intersection;
    } else {
      candidateIds = index.skills.all.slice(0, limit).map(s => s.id);
    }

    return candidateIds
      .slice(0, limit)
      .map(id => this.getSkill(id))
      .filter((s): s is KnowledgeSkill => s !== null);
  }

  searchSkills(query: string): KnowledgeSkill[] {
    const index = this.loadIndex();
    const q = query.toLowerCase();
    const matchIds = new Set<string>();

    // Search by domain
    for (const [domain, ids] of Object.entries(index.skills.byDomain)) {
      if (domain.includes(q)) ids.forEach(id => matchIds.add(id));
    }

    // Search by tag
    for (const [tag, ids] of Object.entries(index.skills.byTag)) {
      if (tag.includes(q)) ids.forEach(id => matchIds.add(id));
    }

    // Search by topic/title in index
    for (const s of index.skills.all) {
      if (s.topic.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)) {
        matchIds.add(s.id);
      }
    }

    return [...matchIds]
      .slice(0, 20)
      .map(id => this.getSkill(id))
      .filter((s): s is KnowledgeSkill => s !== null);
  }

  getSkillsByDomain(domain: string): KnowledgeSkill[] {
    const index = this.loadIndex();
    const ids = index.skills.byDomain[domain.toLowerCase()] || [];
    return ids.map(id => this.getSkill(id)).filter((s): s is KnowledgeSkill => s !== null);
  }

  // ── Change Proposals ─────────────────────────────────────

  private loadProposals(): ChangeProposal[] {
    return readJSON<ChangeProposal[]>(PROPOSALS_FILE, []);
  }

  saveProposal(proposal: ChangeProposal): void {
    const proposals = this.loadProposals();
    const existing = proposals.findIndex(p => p.id === proposal.id);
    if (existing >= 0) {
      proposals[existing] = proposal;
    } else {
      proposals.unshift(proposal);
    }
    atomicWrite(PROPOSALS_FILE, proposals);

    // Update index
    const index = this.loadIndex();
    if (!index.proposals.pending.includes(proposal.id) && proposal.status === 'pending') {
      index.proposals.pending.push(proposal.id);
    }
    this.saveIndex(index);
  }

  listProposals(status?: 'pending' | 'approved' | 'rejected' | 'applied'): ChangeProposal[] {
    const proposals = this.loadProposals();
    if (!status) return proposals;
    return proposals.filter(p => p.status === status);
  }

  getProposal(proposalId: string): ChangeProposal | null {
    return this.loadProposals().find(p => p.id === proposalId) ?? null;
  }

  approveProposal(proposalId: string): ChangeProposal | null {
    const proposals = this.loadProposals();
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return null;

    proposal.status = 'approved';
    proposal.reviewedAt = new Date().toISOString();
    atomicWrite(PROPOSALS_FILE, proposals);

    // Update index
    const index = this.loadIndex();
    index.proposals.pending = index.proposals.pending.filter(id => id !== proposalId);
    if (!index.proposals.approved.includes(proposalId)) {
      index.proposals.approved.push(proposalId);
    }
    this.saveIndex(index);

    // If it's a prompt change, create override
    if (proposal.category === 'prompt_improvement' && proposal.affectedAgent && proposal.promptBefore && proposal.promptAfter) {
      this.saveOverride({
        id: `override-${proposalId}`,
        proposalId,
        agentRole: proposal.affectedAgent,
        section: 'task_instructions',
        originalText: proposal.promptBefore,
        improvedText: proposal.promptAfter,
        rationale: proposal.rationale,
        appliedAt: new Date().toISOString(),
        appliedCount: 0,
        avgQualityBefore: 0,
        avgQualityAfter: 0,
        active: true,
      });
    }

    return proposal;
  }

  rejectProposal(proposalId: string, reason?: string): ChangeProposal | null {
    const proposals = this.loadProposals();
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return null;

    proposal.status = 'rejected';
    proposal.reviewedAt = new Date().toISOString();
    proposal.rejectionReason = reason;
    atomicWrite(PROPOSALS_FILE, proposals);

    const index = this.loadIndex();
    index.proposals.pending = index.proposals.pending.filter(id => id !== proposalId);
    if (!index.proposals.rejected.includes(proposalId)) {
      index.proposals.rejected.push(proposalId);
    }
    this.saveIndex(index);

    return proposal;
  }

  // ── Prompt Overrides ─────────────────────────────────────

  private loadOverrides(): PromptOverride[] {
    return readJSON<PromptOverride[]>(OVERRIDES_FILE, []);
  }

  saveOverride(override: PromptOverride): void {
    const overrides = this.loadOverrides();
    const existing = overrides.findIndex(o => o.id === override.id);
    if (existing >= 0) {
      overrides[existing] = override;
    } else {
      overrides.push(override);
    }
    atomicWrite(OVERRIDES_FILE, overrides);
  }

  getApprovedOverrides(agentRole: AnyAgentRole): PromptOverride[] {
    return this.loadOverrides().filter(o => o.agentRole === agentRole && o.active);
  }

  // ── Performance ───────────────────────────────────────────

  savePerformanceSnapshot(snapshot: PerformanceSnapshot): void {
    const snapshots = readJSON<PerformanceSnapshot[]>(PERFORMANCE_FILE, []);
    snapshots.unshift(snapshot);
    // Keep last 500 snapshots
    if (snapshots.length > 500) snapshots.splice(500);
    atomicWrite(PERFORMANCE_FILE, snapshots);
  }

  getPerformanceSnapshots(limit = 50): PerformanceSnapshot[] {
    return readJSON<PerformanceSnapshot[]>(PERFORMANCE_FILE, []).slice(0, limit);
  }

  getSystemStats(): {
    totalSessions: number;
    totalSkills: number;
    totalProposals: number;
    pendingProposals: number;
    avgQualityScore: number;
    totalTokens: number;
    domainsExplored: string[];
  } {
    const index = this.loadIndex();
    const sessions = index.sessions.all;
    const avgQuality = sessions.length > 0
      ? sessions.reduce((s, sess) => s + (sess.qualityScore || 0), 0) / sessions.length
      : 0;
    const totalTokens = sessions.reduce((s, sess) => s + (sess.totalTokens || 0), 0);

    return {
      totalSessions: sessions.length,
      totalSkills: index.skills.all.length,
      totalProposals: (index.proposals.pending.length + index.proposals.approved.length + index.proposals.rejected.length),
      pendingProposals: index.proposals.pending.length,
      avgQualityScore: Math.round(avgQuality),
      totalTokens,
      domainsExplored: Object.keys(index.sessions.byDomain),
    };
  }
}

export const memoryStore = MemoryStore.getInstance();
