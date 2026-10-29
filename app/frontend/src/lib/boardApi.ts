import { suiteCall } from '@/lib/suiteData';
import { analyzeMetric, resolveRoles, type BoardDoc } from '@/lib/board';

export interface StoredBoard extends BoardDoc {
  slug: string;
  created_at: string | null;
  updated_at: string | null;
}

const KEY_STORE = 'indexboard.keys';

export async function createBoard(doc: BoardDoc): Promise<{ slug: string; edit_key: string; board: StoredBoard }> {
  return suiteCall<{ slug: string; edit_key: string; board: StoredBoard }>({ op: 'board_create', title: doc.title, description: doc.description, payload: doc.payload });
}

export interface BoardSummary {
  slug: string;
  title: string;
  description: string;
  item_count: number;
  metric_count: number;
  primary_metric: { name: string; unit: string } | null;
  top: { name: string; value: number }[];
  created_at: string | null;
}

export async function listRecentBoards(limit = 9): Promise<BoardSummary[]> {
  const res = await suiteCall<{ items: BoardSummary[] }>({ op: 'board_list', limit });
  return Array.isArray(res.items) ? res.items : [];
}

export function summarize(slug: string, doc: BoardDoc): BoardSummary {
  const { metrics, items } = doc.payload;
  const { primary } = resolveRoles(metrics, doc.payload.primary_metric_id, doc.payload.cost_metric_id);
  const top = primary
    ? analyzeMetric(primary, items)
        .rows.slice(0, 3)
        .map((r) => ({ name: r.item.name, value: r.score.value }))
    : [];
  return {
    slug,
    title: doc.title,
    description: doc.description.slice(0, 280),
    item_count: items.length,
    metric_count: metrics.length,
    primary_metric: primary ? { name: primary.name, unit: primary.unit } : null,
    top,
    created_at: null,
  };
}

export async function getBoard(slug: string): Promise<StoredBoard> {
  return suiteCall<StoredBoard>({ op: 'board_get', slug });
}

export async function updateBoard(slug: string, doc: BoardDoc, editKey: string): Promise<StoredBoard> {
  return suiteCall<StoredBoard>({ op: 'board_update', slug, title: doc.title, description: doc.description, payload: doc.payload, edit_key: editKey });
}

export async function verifyKey(slug: string, editKey: string): Promise<boolean> {
  const res = await suiteCall<{ valid: boolean }>({ op: 'board_verify', slug, edit_key: editKey });
  return Boolean(res.valid);
}

interface ApiErrorShape {
  status?: number;
  message?: string;
  data?: { detail?: unknown };
  response?: { status?: number; data?: { detail?: unknown } };
}

export function errorStatus(e: unknown): number | undefined {
  const x = e as ApiErrorShape | null;
  return x?.response?.status ?? x?.status;
}

export function errorMessage(e: unknown, fallback: string): string {
  const x = e as ApiErrorShape | null;
  const detail = x?.data?.detail ?? x?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return x?.message || fallback;
}

function readKeys(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY_STORE) || '{}');
  } catch {
    return {};
  }
}

export function getStoredKey(slug: string): string {
  return readKeys()[slug] ?? '';
}

export function storeKey(slug: string, key: string): void {
  const keys = readKeys();
  keys[slug] = key;
  localStorage.setItem(KEY_STORE, JSON.stringify(keys));
}

export function shareUrl(slug: string): string {
  return `${window.location.origin}/b/${slug}`;
}

export function downloadJson(doc: BoardDoc, slug?: string): void {
  const data = { title: doc.title, description: doc.description, ...doc.payload };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `indexboard-${slug ?? 'board'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
