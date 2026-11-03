import { importJson, ImportError, type BoardDoc, type ImportedBoard, type LiveMetricKey } from '@/lib/board';
import { LIVE_METRIC_KEYS, buildLiveDoc, fetchModelData } from '@/lib/liveData';
import type { Lang } from '@/lib/i18n';

const GATEWAY = 'https://wzdkroxbfrlqijbeiwpk.supabase.co/functions/v1/agent-llm';
const VISITOR_KEY = 'indexboard.visitor';
export const AI_MAX_CHARS = 12000;

export type AiErrorKey = 'ai.rate' | 'ai.fail' | 'ai.badJson' | 'ai.network' | 'live.errUnavailable' | 'live.errNone';

export class AiBuildError extends Error {
  constructor(public key: AiErrorKey, public detail = '') {
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

async function callGateway(system: string, user: string, maxTokens: number): Promise<string> {
  let res: Response;
  try {
    res = await fetch(GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'indexboard',
        visitor: visitorId(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        json_mode: true,
        max_tokens: maxTokens,
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
  return raw;
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

/* ---------- Step 1: understand the request ---------- */

interface Intent {
  kind: 'models' | 'other';
  models: string[];
  top: number | null;
  metrics: LiveMetricKey[];
  title: string;
}

function intentPrompt(lang: Lang): string {
  const language = lang === 'zh' ? 'Simplified Chinese' : 'English';
  return [
    'You classify a request for the IndexBoard leaderboard app. Reply with ONE JSON object only:',
    '{"kind": "models" | "other", "models": string[], "top": number | null, "metrics": string[], "title": string}',
    'Rules:',
    '- kind is "models" when the user wants to compare AI language models (for example GPT, Claude, DeepSeek, Gemini, Llama, Qwen, Grok, Mistral, Kimi) or asks for the top / best N AI models, AND does not supply their own measured results. If the text contains the user\'s own scores or numbers for the items, or is not about AI models, kind is "other".',
    '- models: the model names exactly as the user wrote them, e.g. "GPT", "Claude Sonnet", "DeepSeek V3". Empty when the user asks for top N.',
    '- top: N when the user asks for the top or best N models, else null. If kind is "models" and no names are given, use 5.',
    '- metrics: the subset of ["intelligence","coding","math","price","speed","ttft","context"] the user asked for. coding/programming -> coding; intelligence/overall/quality/reasoning/smartest -> intelligence; math -> math; cost/price/cheap -> price; speed/throughput/fast -> speed; latency/response time/first token -> ttft; context/context window -> context. Empty list if none are named.',
    `- title: a short board title in ${language}.`,
  ].join('\n');
}

async function extractIntent(text: string, lang: Lang): Promise<Intent> {
  const raw = await callGateway(intentPrompt(lang), text, 400);
  try {
    const o = JSON.parse(extractJson(raw)) as Record<string, unknown>;
    const models = Array.isArray(o.models) ? o.models.map((m) => String(m).trim()).filter(Boolean).slice(0, 12) : [];
    const topNum = Number(o.top);
    let top = Number.isFinite(topNum) && topNum > 0 ? Math.min(20, Math.round(topNum)) : null;
    const metrics = Array.isArray(o.metrics)
      ? (o.metrics.map((m) => String(m).toLowerCase()).filter((m) => (LIVE_METRIC_KEYS as string[]).includes(m)) as LiveMetricKey[])
      : [];
    const kind = o.kind === 'models' ? 'models' : 'other';
    if (kind === 'models' && !models.length && !top) top = 5;
    return { kind, models, top, metrics, title: typeof o.title === 'string' ? o.title : '' };
  } catch {
    return { kind: 'other', models: [], top: null, metrics: [], title: '' };
  }
}

/* ---------- Step 2b: free-form board (non-model requests) ---------- */

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

function boardPrompt(lang: Lang): string {
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

async function buildFreeBoard(text: string, lang: Lang): Promise<{ result: ImportedBoard; placeholder: boolean }> {
  const raw = await callGateway(boardPrompt(lang), text, 3000);
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

/* ---------- Entry point ---------- */

export type DescribeResult =
  | { kind: 'live'; doc: BoardDoc }
  | { kind: 'ai'; result: ImportedBoard; placeholder: boolean };

interface ApiErr {
  data?: { detail?: unknown };
  response?: { data?: { detail?: unknown } };
  message?: string;
}

export async function describeToBoard(text: string, lang: Lang): Promise<DescribeResult> {
  const intent = await extractIntent(text, lang);
  if (intent.kind === 'models' && (intent.models.length || intent.top)) {
    let res;
    try {
      res = await fetchModelData(intent.models, intent.top);
    } catch (e) {
      const x = e as ApiErr;
      const detail = x?.data?.detail ?? x?.response?.data?.detail ?? x?.message;
      throw new AiBuildError('live.errUnavailable', typeof detail === 'string' ? detail : '');
    }
    if (!res?.rows?.length) throw new AiBuildError('live.errNone', intent.models.join(', '));
    return { kind: 'live', doc: buildLiveDoc(res, intent.metrics, lang, { title: intent.title, top: intent.top }) };
  }
  const free = await buildFreeBoard(text, lang);
  return { kind: 'ai', ...free };
}
