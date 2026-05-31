/**
 * Local storage for SO-KI v2: free conversation + review flow.
 * Everything lives in localStorage under `soki_v2:*` keys.
 */

import { differenceInCalendarDays, format, parseISO } from "date-fns";

const NS = "soki_v2:";
const K_CONVOS = NS + "conversations";
const K_PROFILE = NS + "profile";
const K_MIGRATED = NS + "migrated_v1";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  photo?: string; // dataURL
  created_at: string;
}

export interface Expression {
  en: string;
  jp: string;
  example?: string;
}

export interface Conversation {
  id: string;
  date: string; // yyyy-MM-dd
  started_at: string;
  ended_at: string | null;
  title: string | null;
  messages: ChatMessage[];
  photos: string[]; // dataURLs
  summary_en: string | null;
  summary_sentences: string[] | null;
  summary_jp: string[] | null;
  expressions: Expression[] | null;
  reviewed_at: string | null;
  word_count: number;
}

export interface Profile {
  current_streak: number;
  longest_streak: number;
  total_words: number;
  last_chat_date: string | null;
  // Days marked as "recovery" (filled in later).
  recovery_days: string[];
}

function uuid(): string {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function read<T>(k: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(k) || "null") ?? fallback; } catch { return fallback; }
}
function write<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error("[store] write failed", e); }
}

function emit() {
  try { window.dispatchEvent(new CustomEvent("soki:data-changed")); } catch {}
}

/** Wipe all v1 data on first launch of v2 (per spec: existing data is discarded). */
export function migrateFromV1Once() {
  if (localStorage.getItem(K_MIGRATED)) return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("soki_local_db_v1:")) toRemove.push(k);
    if (k === "soki_local_user_id_v1") toRemove.push(k);
    if (k === "soki_onboarded") toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  localStorage.setItem(K_MIGRATED, "1");
}

export function getProfile(): Profile {
  return read<Profile>(K_PROFILE, {
    current_streak: 0,
    longest_streak: 0,
    total_words: 0,
    last_chat_date: null,
    recovery_days: [],
  });
}

function saveProfile(p: Profile) {
  write(K_PROFILE, p);
  emit();
}

export function getConversations(): Conversation[] {
  const list = read<Conversation[]>(K_CONVOS, []);
  return list.sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export function getConversation(id: string): Conversation | null {
  return getConversations().find((c) => c.id === id) || null;
}

function saveConversations(list: Conversation[]) {
  write(K_CONVOS, list);
  emit();
}

export function createConversation(): Conversation {
  const now = new Date();
  const convo: Conversation = {
    id: uuid(),
    date: format(now, "yyyy-MM-dd"),
    started_at: now.toISOString(),
    ended_at: null,
    title: null,
    messages: [],
    photos: [],
    summary_en: null,
    summary_sentences: null,
    summary_jp: null,
    expressions: null,
    reviewed_at: null,
    word_count: 0,
  };
  const list = getConversations();
  list.unshift(convo);
  saveConversations(list);
  return convo;
}

export function upsertConversation(convo: Conversation) {
  const list = getConversations();
  const idx = list.findIndex((c) => c.id === convo.id);
  if (idx >= 0) list[idx] = convo;
  else list.unshift(convo);
  saveConversations(list);
}

export function appendMessage(convoId: string, msg: Omit<ChatMessage, "id" | "created_at"> & Partial<Pick<ChatMessage, "id" | "created_at">>) {
  const list = getConversations();
  const c = list.find((x) => x.id === convoId);
  if (!c) return;
  const m: ChatMessage = {
    id: msg.id || uuid(),
    created_at: msg.created_at || new Date().toISOString(),
    role: msg.role,
    content: msg.content,
    photo: msg.photo,
  };
  c.messages.push(m);
  if (m.photo && !c.photos.includes(m.photo)) c.photos.push(m.photo);
  saveConversations(list);
  return m;
}

export function deleteConversation(id: string) {
  const list = getConversations().filter((c) => c.id !== id);
  saveConversations(list);
  recomputeStreak();
}

/** Mark conversation finished (and recompute streak / word count). */
export function finishConversation(
  convoId: string,
  patch: { summary_en?: string; summary_sentences?: string[]; summary_jp?: string[]; expressions?: Expression[]; title?: string }
) {
  const list = getConversations();
  const c = list.find((x) => x.id === convoId);
  if (!c) return null;
  c.ended_at = new Date().toISOString();
  if (patch.summary_en !== undefined) c.summary_en = patch.summary_en;
  if (patch.summary_sentences !== undefined) c.summary_sentences = patch.summary_sentences;
  if (patch.summary_jp !== undefined) c.summary_jp = patch.summary_jp;
  if (patch.expressions !== undefined) c.expressions = patch.expressions;
  if (patch.title !== undefined) c.title = patch.title;
  // Count user words spoken
  const words = c.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim().split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
  c.word_count = words;
  saveConversations(list);
  recomputeStreak();
  return c;
}

export function markReviewed(convoId: string) {
  const list = getConversations();
  const c = list.find((x) => x.id === convoId);
  if (!c) return;
  c.reviewed_at = new Date().toISOString();
  saveConversations(list);
}

/** Conversations that have a summary (i.e. finished) and haven't been reviewed yet. */
export function getPendingReviews(): Conversation[] {
  return getConversations()
    .filter((c) => c.ended_at && c.summary_sentences && c.summary_sentences.length > 0 && !c.reviewed_at)
    .sort((a, b) => a.started_at.localeCompare(b.started_at)); // oldest first
}

function uniqueDates(list: Conversation[]): string[] {
  return Array.from(new Set(list.filter((c) => c.ended_at).map((c) => c.date))).sort().reverse();
}

export function recomputeStreak(): Profile {
  const list = getConversations();
  const profile = getProfile();
  const dates = uniqueDates(list);
  const totalWords = list.reduce((sum, c) => sum + (c.word_count || 0), 0);
  profile.total_words = totalWords;
  profile.last_chat_date = dates[0] || null;

  if (dates.length === 0) {
    profile.current_streak = 0;
    saveProfile(profile);
    return profile;
  }

  const today = parseISO(format(new Date(), "yyyy-MM-dd"));
  let current = 0;
  const newest = parseISO(dates[0]);
  const gap = differenceInCalendarDays(today, newest);
  if (gap <= 1) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const d = differenceInCalendarDays(parseISO(dates[i - 1]), parseISO(dates[i]));
      if (d === 1) current++;
      else break;
    }
  }
  profile.current_streak = current;

  let longest = 1, run = 1;
  for (let i = 1; i < dates.length; i++) {
    const d = differenceInCalendarDays(parseISO(dates[i - 1]), parseISO(dates[i]));
    if (d === 1) { run++; longest = Math.max(longest, run); } else { run = 1; }
  }
  profile.longest_streak = Math.max(profile.longest_streak, longest);
  saveProfile(profile);
  return profile;
}

/** Mark a date as recovered (filled in later). Adds to streak calculations as a "silver" day. */
export function markRecovery(date: string) {
  const p = getProfile();
  if (!p.recovery_days.includes(date)) {
    p.recovery_days.push(date);
    saveProfile(p);
  }
}

export function isRecoveryDay(date: string): boolean {
  return getProfile().recovery_days.includes(date);
}

/** Reactive subscription helper for components. */
export function subscribe(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("soki:data-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("soki:data-changed", handler);
    window.removeEventListener("storage", handler);
  };
}