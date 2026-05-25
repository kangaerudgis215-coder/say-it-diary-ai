/**
 * Local-only data layer that mimics a tiny subset of the Supabase JS client
 * surface used by this codebase. All app data (diary entries, expressions,
 * conversations, messages, etc.) lives in `localStorage` under namespaced
 * keys. Edge function invocations are passed through to the real Supabase
 * client so AI features (`chat`, `tag-expressions`, etc.) keep working.
 *
 * This shim is intentionally minimal — only the chainable methods actually
 * exercised by the app are implemented. If a future query uses a new
 * combinator (e.g. `range`, `filter`, complex `or`), add it here.
 */

import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { supabase as realSupabase } from '@/integrations/supabase/client';

type Row = Record<string, any>;

const PREFIX = 'soki_local_db_v1:';
const USER_KEY = 'soki_local_user_id_v1';

function uuid(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readTable(table: string): Row[] {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + table) || '[]');
  } catch {
    return [];
  }
}

function writeTable(table: string, rows: Row[]) {
  try {
    localStorage.setItem(PREFIX + table, JSON.stringify(rows));
  } catch (e) {
    console.error('[localDb] write failed for', table, e);
  }
}

// ---------- Relationship registry ----------
// Only the embeddings actually used by the app are declared.
type Relation = {
  type: 'has_many' | 'belongs_to';
  foreignTable: string;
  foreignKey: string; // column on the foreign table that matches localKey
  localKey: string; // column on this row
};
const RELATIONS: Record<string, Record<string, Relation>> = {
  conversations: {
    messages: {
      type: 'has_many',
      foreignTable: 'messages',
      foreignKey: 'conversation_id',
      localKey: 'id',
    },
  },
  messages: {
    conversations: {
      type: 'belongs_to',
      foreignTable: 'conversations',
      foreignKey: 'id',
      localKey: 'conversation_id',
    },
  },
  expressions: {
    diary_entries: {
      type: 'belongs_to',
      foreignTable: 'diary_entries',
      foreignKey: 'id',
      localKey: 'diary_entry_id',
    },
  },
};

// ---------- Profile virtualization ----------
function ensureProfile(userId: string) {
  const rows = readTable('profiles');
  if (!rows.find((p) => p.user_id === userId)) {
    const now = new Date().toISOString();
    rows.push({
      id: uuid(),
      user_id: userId,
      display_name: null,
      current_streak: 0,
      longest_streak: 0,
      total_diary_entries: 0,
      last_diary_date: null,
      plan: 'free',
      stripe_customer_id: null,
      created_at: now,
      updated_at: now,
    });
    writeTable('profiles', rows);
  }
}

function computeStreak(userId: string): {
  current: number;
  longest: number;
  total: number;
  last: string | null;
} {
  const entries = readTable('diary_entries').filter((e) => e.user_id === userId);
  if (entries.length === 0) return { current: 0, longest: 0, total: 0, last: null };
  const dates = [...new Set(entries.map((e) => e.date as string))].sort().reverse();
  const today = parseISO(format(new Date(), 'yyyy-MM-dd'));

  let current = 0;
  const newest = parseISO(dates[0]);
  const gap = differenceInCalendarDays(today, newest);
  if (gap <= 1) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = differenceInCalendarDays(parseISO(dates[i - 1]), parseISO(dates[i]));
      if (diff === 1) current++;
      else break;
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = differenceInCalendarDays(parseISO(dates[i - 1]), parseISO(dates[i]));
    if (diff === 1) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return { current, longest, total: entries.length, last: dates[0] };
}

function onTableMutated(table: string) {
  if (table === 'diary_entries') {
    const profs = readTable('profiles');
    for (const p of profs) {
      const s = computeStreak(p.user_id);
      p.current_streak = s.current;
      p.longest_streak = Math.max(p.longest_streak || 0, s.longest);
      p.total_diary_entries = s.total;
      p.last_diary_date = s.last;
      p.updated_at = new Date().toISOString();
    }
    writeTable('profiles', profs);
  }
}

// ---------- Public: local identity ----------
export function getLocalUserId(): string {
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(USER_KEY, id);
  }
  ensureProfile(id);
  return id;
}

export function clearLocalData() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem(USER_KEY);
}

// ---------- Query builder ----------
interface Filter {
  op: string;
  col: string;
  val: any;
}

type Projection = {
  fields: string[];
  embeds: { alias: string; relation: string; sub: string }[];
  all: boolean;
};

function parseProjection(cols: string): Projection {
  const out: Projection = { fields: [], embeds: [], all: false };
  // Split top-level by commas, respecting parens
  const tokens: string[] = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (c === '(') {
      depth++;
      buf += c;
    } else if (c === ')') {
      depth--;
      buf += c;
    } else if (c === ',' && depth === 0) {
      tokens.push(buf.trim());
      buf = '';
    } else {
      buf += c;
    }
  }
  if (buf.trim()) tokens.push(buf.trim());

  for (const t of tokens) {
    if (t === '*') {
      out.all = true;
      continue;
    }
    // Embedded: name[:fk][!inner](subcols)
    const m = t.match(/^([A-Za-z0-9_]+)(?::([A-Za-z0-9_]+))?\s*(?:!inner)?\s*\(([\s\S]*)\)$/);
    if (m) {
      out.embeds.push({ alias: m[1], relation: m[1], sub: m[3] });
    } else {
      out.fields.push(t);
    }
  }
  return out;
}

function project(row: Row, p: Projection): Row {
  if (p.all || (p.fields.length === 0 && p.embeds.length === 0)) return { ...row };
  const out: Row = {};
  for (const f of p.fields) out[f] = row[f];
  return out;
}

class LocalQuery implements PromiseLike<any> {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private limitN?: number;
  private projection = '*';
  private countMode?: 'exact';
  private headOnly = false;
  private singleMode: 'maybe' | 'one' | null = null;
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: any;
  private upsertOpts?: { onConflict?: string };
  private explicitSelect = false;

  constructor(private table: string) {}

  select(cols?: string, opts?: { count?: 'exact'; head?: boolean }) {
    this.explicitSelect = true;
    if (this.action === 'select') this.projection = cols || '*';
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push({ op: 'eq', col, val });
    return this;
  }
  neq(col: string, val: any) {
    this.filters.push({ op: 'neq', col, val });
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push({ op: 'in', col, val: vals });
    return this;
  }
  gte(col: string, val: any) {
    this.filters.push({ op: 'gte', col, val });
    return this;
  }
  lte(col: string, val: any) {
    this.filters.push({ op: 'lte', col, val });
    return this;
  }
  gt(col: string, val: any) {
    this.filters.push({ op: 'gt', col, val });
    return this;
  }
  lt(col: string, val: any) {
    this.filters.push({ op: 'lt', col, val });
    return this;
  }
  not(col: string, op: string, val: any) {
    this.filters.push({ op: `not_${op}`, col, val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }
  single() {
    this.singleMode = 'one';
    return this;
  }
  insert(payload: any) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }
  update(patch: any) {
    this.action = 'update';
    this.payload = patch;
    return this;
  }
  upsert(payload: any, opts?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = payload;
    this.upsertOpts = opts;
    return this;
  }
  delete() {
    this.action = 'delete';
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onFulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onFulfilled as any, onRejected as any);
  }

  private matches(row: Row): boolean {
    for (const f of this.filters) {
      const v = row[f.col];
      switch (f.op) {
        case 'eq':
          if (v !== f.val) return false;
          break;
        case 'neq':
          if (v === f.val) return false;
          break;
        case 'in':
          if (!Array.isArray(f.val) || !f.val.includes(v)) return false;
          break;
        case 'gte':
          if (!(v >= f.val)) return false;
          break;
        case 'lte':
          if (!(v <= f.val)) return false;
          break;
        case 'gt':
          if (!(v > f.val)) return false;
          break;
        case 'lt':
          if (!(v < f.val)) return false;
          break;
        case 'not_is':
          // .not(col, 'is', null) → keep rows where v is NOT null/undefined
          if (f.val === null && (v === null || v === undefined)) return false;
          break;
        default:
          break;
      }
    }
    return true;
  }

  private applyEmbeds(rows: Row[], embeds: Projection['embeds']): Row[] {
    if (embeds.length === 0) return rows;
    const rels = RELATIONS[this.table] || {};
    return rows.map((row) => {
      const out = { ...row };
      for (const emb of embeds) {
        const rel = rels[emb.relation];
        if (!rel) {
          out[emb.alias] = null;
          continue;
        }
        const all = readTable(rel.foreignTable);
        const subProj = parseProjection(emb.sub);
        if (rel.type === 'has_many') {
          const kids = all.filter((r) => r[rel.foreignKey] === row[rel.localKey]);
          out[emb.alias] = kids.map((k) => project(k, subProj));
        } else {
          const parent = all.find((r) => r[rel.foreignKey] === row[rel.localKey]);
          out[emb.alias] = parent ? project(parent, subProj) : null;
        }
      }
      return out;
    });
  }

  private execute(): any {
    const all = readTable(this.table);

    if (this.action === 'select') {
      let rows = all.filter((r) => this.matches(r));
      for (let i = this.orders.length - 1; i >= 0; i--) {
        const o = this.orders[i];
        rows.sort((a, b) => {
          const av = a[o.col];
          const bv = b[o.col];
          if (av === bv) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av > bv ? 1 : -1) * (o.asc ? 1 : -1);
        });
      }
      const count = rows.length;
      if (this.limitN != null) rows = rows.slice(0, this.limitN);
      if (this.headOnly) {
        return { data: null, error: null, count };
      }
      const proj = parseProjection(this.projection);
      let out = rows.map((r) => project(r, proj));
      out = this.applyEmbeds(out, proj.embeds);
      if (this.singleMode === 'maybe') {
        return { data: out[0] ?? null, error: null };
      }
      if (this.singleMode === 'one') {
        if (out.length === 0) {
          return { data: null, error: { message: 'No rows', code: 'PGRST116' } };
        }
        return { data: out[0], error: null };
      }
      return { data: out, error: null, count };
    }

    if (this.action === 'insert') {
      const rows = [...all];
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
      const now = new Date().toISOString();
      const inserted: Row[] = [];
      for (const p of payloads) {
        const row: Row = { ...p };
        if (!row.id) row.id = uuid();
        if (!row.created_at) row.created_at = now;
        if ('updated_at' in row && !row.updated_at) row.updated_at = now;
        // For tables that conventionally have updated_at, set it.
        if (
          ['diary_entries', 'conversations', 'diary_sentences', 'profiles', 'spoken_vocabulary_logs'].includes(
            this.table,
          )
        ) {
          row.updated_at = row.updated_at || now;
        }
        rows.push(row);
        inserted.push(row);
      }
      writeTable(this.table, rows);
      onTableMutated(this.table);
      if (this.singleMode === 'one') return { data: inserted[0], error: null };
      if (this.singleMode === 'maybe') return { data: inserted[0] ?? null, error: null };
      return { data: this.explicitSelect ? inserted : null, error: null };
    }

    if (this.action === 'update') {
      const rows = [...all];
      const updated: Row[] = [];
      const now = new Date().toISOString();
      for (let i = 0; i < rows.length; i++) {
        if (this.matches(rows[i])) {
          rows[i] = { ...rows[i], ...this.payload, updated_at: now };
          updated.push(rows[i]);
        }
      }
      writeTable(this.table, rows);
      onTableMutated(this.table);
      if (this.singleMode === 'one') return { data: updated[0] ?? null, error: null };
      if (this.singleMode === 'maybe') return { data: updated[0] ?? null, error: null };
      return { data: this.explicitSelect ? updated : null, error: null };
    }

    if (this.action === 'upsert') {
      const rows = [...all];
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
      const conflictCols = (this.upsertOpts?.onConflict || 'id')
        .split(',')
        .map((s) => s.trim());
      const now = new Date().toISOString();
      const results: Row[] = [];
      for (const p of payloads) {
        const idx = rows.findIndex((r) => conflictCols.every((c) => r[c] === (p as any)[c]));
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], ...p, updated_at: now };
          results.push(rows[idx]);
        } else {
          const row: Row = { ...p };
          if (!row.id) row.id = uuid();
          if (!row.created_at) row.created_at = now;
          row.updated_at = now;
          rows.push(row);
          results.push(row);
        }
      }
      writeTable(this.table, rows);
      onTableMutated(this.table);
      if (this.singleMode === 'one') return { data: results[0], error: null };
      return { data: this.explicitSelect ? results : null, error: null };
    }

    if (this.action === 'delete') {
      const kept: Row[] = [];
      let count = 0;
      for (const r of all) {
        if (this.matches(r)) count++;
        else kept.push(r);
      }
      writeTable(this.table, kept);
      onTableMutated(this.table);
      return { data: null, error: null, count };
    }

    return { data: null, error: null };
  }
}

// ---------- Auth shim ----------
type AuthCallback = (event: string, session: any) => void;
const authListeners = new Set<AuthCallback>();

function fakeSession(): { user: { id: string; email: null; user_metadata: any } } | null {
  const id = localStorage.getItem(USER_KEY);
  if (!id) return null;
  return { user: { id, email: null, user_metadata: {} } } as any;
}

const authShim = {
  onAuthStateChange(cb: AuthCallback) {
    authListeners.add(cb);
    // Fire once asynchronously, like supabase does.
    Promise.resolve().then(() => cb('SIGNED_IN', fakeSession()));
    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(cb);
          },
        },
      },
    };
  },
  async getSession() {
    return { data: { session: fakeSession() }, error: null };
  },
  async getUser() {
    const s = fakeSession();
    return { data: { user: s?.user ?? null }, error: null };
  },
  async signUp() {
    return { data: { user: fakeSession()?.user ?? null, session: fakeSession() }, error: null };
  },
  async signInWithPassword() {
    return { data: { user: fakeSession()?.user ?? null, session: fakeSession() }, error: null };
  },
  async signOut() {
    // No-op: local data persists; we don't actually log out.
    return { error: null };
  },
  async setSession() {
    return { data: { session: fakeSession() }, error: null };
  },
};

// ---------- Public client ----------
export const localSupabase: any = {
  from(table: string) {
    return new LocalQuery(table);
  },
  functions: realSupabase.functions,
  auth: authShim,
  channel(_name: string) {
    const ch: any = {
      on() {
        return ch;
      },
      subscribe() {
        return ch;
      },
    };
    return ch;
  },
  removeChannel() {},
  rpc: async () => ({ data: null, error: { message: 'rpc not supported in local mode' } }),
};