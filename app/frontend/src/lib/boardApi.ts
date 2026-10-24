import { client } from '@/lib/api';
import type { BoardDoc } from '@/lib/board';

export interface StoredBoard extends BoardDoc {
  slug: string;
  created_at: string | null;
  updated_at: string | null;
}

const BASE = '/api/v1/indexboard/boards';
const KEY_STORE = 'indexboard.keys';

export async function createBoard(doc: BoardDoc): Promise<{ slug: string; edit_key: string; board: StoredBoard }> {
  const res = await client.apiCall.invoke({ url: BASE, method: 'POST', data: doc });
  return res.data;
}

export async function getBoard(slug: string): Promise<StoredBoard> {
  const res = await client.apiCall.invoke({ url: `${BASE}/${encodeURIComponent(slug)}`, method: 'GET', data: {} });
  return res.data;
}

export async function updateBoard(slug: string, doc: BoardDoc, editKey: string): Promise<StoredBoard> {
  const res = await client.apiCall.invoke({
    url: `${BASE}/${encodeURIComponent(slug)}`,
    method: 'PUT',
    data: { ...doc, edit_key: editKey },
  });
  return res.data;
}

export async function verifyKey(slug: string, editKey: string): Promise<boolean> {
  const res = await client.apiCall.invoke({
    url: `${BASE}/${encodeURIComponent(slug)}/verify`,
    method: 'POST',
    data: { edit_key: editKey },
  });
  return Boolean(res.data?.valid);
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
