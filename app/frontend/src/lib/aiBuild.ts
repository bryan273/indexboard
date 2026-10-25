import { importJson, ImportError, type ImportedBoard } from '@/lib/board';
import type { Lang } from '@/lib/i18n';

const GATEWAY = 'https://vzvyghmtsakixlhzzuol.supabase.co/functions/v1/agent-llm';
const VISITOR_KEY = 'indexboard.visitor';
export const AI_MAX_CHARS = 12000;

export class AiBuildError extends Error {
  constructor(public key: 'ai.rate' | 'ai.fail' | 'ai.badJson' | 'ai.network', public detail = '') {
    super(key);
  }
}

function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `v_${rand}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

const SCHEMA = `{
  "title": string,
  "description": string,
  "placeholder": boolean,
  "metrics": [{ "id": string (short snake_case), "name": string, "unit": string (may be ""), "direction": "higher" | "lower" }],
  "items": [{ "name": string, "scores": { "<metric id>": { "value": number, "low": number | null, "high": number | null, "runs": number | null } } }],
  "methodology": { "formula": string (markdown), "worked_example": string (markdown), "held_fixed": string[] },
  "primary_metric_id": string,
  "cost_metric_id": string ("none" if there is no cost-like metric)
}`;

function systemPrompt(lang: Lang): string {
  const language = lang === 'zh' ? 'Simplified Chinese' : 'English';
  return [
    'You turn evaluation notes into a leaderboard board for the IndexBoard app.',
    `Reply with ONE JSON object only, exactly in this shape:\n${SCHEMA}`,
    'Rules:',
    '- direction is "higher" when bigger is better (accuracy, score, speed in tokens/s) and "lower" when smaller is better (cost, price, latency, time, error).',
    '- Copy every number given in the text exactly. Use low/high only when a 95% interval, ± value or range is given (value ± x gives low = value - x, high = value + x); otherwise null. runs only when stated.',
    '- Every item must have a name and a value for every metric that the text supports. Never invent extra items or metrics beyond what the text implies.',
    '- If the text contains no usable numbers, build a sensible draft: choose fitting metrics and items, fill plausible placeholder values with intervals, and set "placeholder": true. Otherwise "placeholder": false.',
    '- primary_metric_id is the main quality metric (direction higher if possible). cost_metric_id is a cost or price metric, else "none".',
    '- methodology.formula explains how each metric is computed; worked_example walks through one item; held_fixed lists conditions held constant. Say plainly when details were not provided.',
    `- Write all human-readable text (title, description, metric names, methodology) in ${language}. Keep item names as given.`,
  ].join('\n');
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export async function buildBoardWithAi(text: string, lang: Lang): Promise<{ result: ImportedBoard; placeholder: boolean }> {
  let res: Response;
  try {
    res = await fetch(GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'indexboard',
        visitor: visitorId(),
        messages: [
          { role: 'system', content: systemPrompt(lang) },
          { role: 'user', content: text },
        ],
        json_mode: true,
        max_tokens: 3000,
      }),
    });
  } catch {
    throw new AiBuildError('ai.network');
  }
  if (res.status === 429) throw new AiBuildError('ai.rate');
  let data: { message?: { content?: unknown }; error?: unknown } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`;
    throw new AiBuildError('ai.fail', detail);
  }
  const content = data?.message?.content;
  const raw = typeof content === 'string' ? content : content != null ? JSON.stringify(content) : '';
  if (!raw.trim()) throw new AiBuildError('ai.badJson');

  let result: ImportedBoard;
  let flagged = false;
  try {
    const jsonText = extractJson(raw);
    flagged = (JSON.parse(jsonText) as { placeholder?: unknown }).placeholder === true;
    result = importJson(jsonText);
  } catch (e) {
    throw new AiBuildError('ai.badJson', e instanceof ImportError ? e.detail : '');
  }
  if (!result.payload.items.length || !result.payload.metrics.length) throw new AiBuildError('ai.badJson');
  return { result, placeholder: flagged || !/\d/.test(text) };
}
