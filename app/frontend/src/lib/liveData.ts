import { suiteCall } from '@/lib/suiteData';
import type { BoardDoc, Item, LiveMetricKey, LiveModelRef, LiveSource, LiveSpec, Metric, Score } from '@/lib/board';

type L = 'en' | 'zh';
type Bi = [string, string];

export interface ModelRow {
  key: string;
  name: string;
  creator: string;
  released: string;
  intelligence: number | null;
  coding: number | null;
  math: number | null;
  price_blended: number | null;
  price_input: number | null;
  price_output: number | null;
  speed: number | null;
  ttft: number | null;
  context_length: number | null;
}

export interface ModelDataResponse {
  source: LiveSource;
  source_label: string;
  source_url: string;
  fetched_at: string;
  stale: boolean;
  from_cache: boolean;
  metrics_available: LiveMetricKey[];
  selection: string;
  matches: { query: string; key: string | null; name: string | null; creator: string | null }[];
  rows: ModelRow[];
}

interface Def {
  name: Bi;
  unit: Bi;
  direction: 'higher' | 'lower';
  field: keyof ModelRow;
  scale?: number;
  desc: Bi;
}

export const LIVE_METRIC_KEYS: LiveMetricKey[] = ['intelligence', 'coding', 'math', 'price', 'speed', 'ttft', 'context'];

const DEFS: Record<LiveMetricKey, Def> = {
  intelligence: {
    name: ['Intelligence Index', '智能指数'],
    unit: ['', ''],
    direction: 'higher',
    field: 'intelligence',
    desc: ['composite index across the source\'s reasoning, knowledge and problem-solving evaluations', '数据源基于推理、知识与解题类评测汇总的综合指数'],
  },
  coding: {
    name: ['Coding Index', '编程指数'],
    unit: ['', ''],
    direction: 'higher',
    field: 'coding',
    desc: ['composite of the source\'s coding evaluations', '数据源编程类评测的综合指数'],
  },
  math: {
    name: ['Math Index', '数学指数'],
    unit: ['', ''],
    direction: 'higher',
    field: 'math',
    desc: ['composite of the source\'s math evaluations', '数据源数学类评测的综合指数'],
  },
  price: {
    name: ['Price per 1M tokens (blended 3:1)', '每百万 token 价格（3:1 混合）'],
    unit: ['USD', 'USD'],
    direction: 'lower',
    field: 'price_blended',
    desc: ['list price in USD per 1M tokens, blended 3 input : 1 output', '每百万 token 的标价（美元），按输入:输出 = 3:1 混合'],
  },
  speed: {
    name: ['Output speed', '输出速度'],
    unit: ['tok/s', 'tok/s'],
    direction: 'higher',
    field: 'speed',
    desc: ['median output tokens per second measured by the source', '数据源测得的每秒输出 token 数中位数'],
  },
  ttft: {
    name: ['Time to first token', '首 token 延迟'],
    unit: ['s', '秒'],
    direction: 'lower',
    field: 'ttft',
    desc: ['median seconds until the first token arrives', '收到第一个 token 所需秒数的中位数'],
  },
  context: {
    name: ['Context window', '上下文窗口'],
    unit: ['K tokens', 'K tokens'],
    direction: 'higher',
    field: 'context_length',
    scale: 0.001,
    desc: ['maximum context length listed by the source, in thousands of tokens', '数据源列出的最大上下文长度（千 token）'],
  },
};

const DEFAULTS: Record<LiveSource, LiveMetricKey[]> = {
  artificial_analysis: ['intelligence', 'coding', 'price', 'speed'],
  openrouter: ['price', 'context'],
};
const PRIMARY_ORDER: LiveMetricKey[] = ['coding', 'intelligence', 'math', 'speed', 'context', 'ttft', 'price'];

export function liveMetricName(key: LiveMetricKey, lang: L): string {
  return DEFS[key].name[lang === 'zh' ? 1 : 0];
}

export function attributionLine(source: LiveSource): string {
  return source === 'artificial_analysis' ? 'Data: Artificial Analysis (https://artificialanalysis.ai/)' : 'Prices: OpenRouter';
}

export async function fetchModelData(models: string[], top: number | null): Promise<ModelDataResponse> {
  return suiteCall<ModelDataResponse>({ op: 'model_data', models, top: models.length ? null : top });
}

function joinList(names: string[], lang: L): string {
  if (lang === 'zh') return names.join('、');
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function valueOf(row: ModelRow, key: LiveMetricKey): number | null {
  const def = DEFS[key];
  const raw = row[def.field];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return def.scale ? Number((raw * def.scale).toFixed(1)) : raw;
}

const itemId = (key: string) => `live_${key.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

interface BuildOptions {
  title?: string;
  description?: string;
  queryMap?: Record<string, string>;
  top: number | null;
}

/** Turns a model-data response into a board. Only real values are used; missing ones stay empty. */
export function buildLiveDoc(res: ModelDataResponse, requested: LiveMetricKey[], lang: L, opts: BuildOptions): BoardDoc {
  const zh = lang === 'zh';
  const I = zh ? 1 : 0;
  const wanted = (requested.length ? requested : DEFAULTS[res.source]).filter((k, i, a) => a.indexOf(k) === i);
  const hasData = (k: LiveMetricKey) => res.metrics_available.includes(k) && res.rows.some((r) => valueOf(r, k) != null);
  let shown = wanted.filter(hasData);
  const unavailable = wanted.filter((k) => !hasData(k));
  if (!shown.length) shown = DEFAULTS[res.source].filter(hasData);

  const metrics: Metric[] = shown.map((k) => ({
    id: k,
    name: DEFS[k].name[I],
    unit: DEFS[k].unit[I],
    direction: DEFS[k].direction,
    source: res.source_label,
  }));
  const items: Item[] = res.rows.map((row) => ({
    id: itemId(row.key),
    name: row.name,
    scores: Object.fromEntries(
      shown.map((k) => {
        const v = valueOf(row, k);
        return [k, v == null ? undefined : ({ value: v, low: null, high: null, runs: null } as Score)];
      }),
    ),
  }));

  const mapQuery = (q: string) => opts.queryMap?.[q] ?? q;
  const models: LiveModelRef[] = res.matches.length
    ? res.matches
        .filter((m) => m.key && m.name)
        .map((m) => ({ query: mapQuery(m.query), key: m.key as string, name: m.name as string, creator: m.creator ?? '' }))
    : res.rows.map((r) => ({ query: null, key: r.key, name: r.name, creator: r.creator }));
  const unmatched = res.matches.filter((m) => !m.key).map((m) => mapQuery(m.query));
  const names = res.rows.map((r) => r.name);
  const fetched = res.fetched_at;
  const label = res.source_label;
  const unavailableNames = unavailable.map((k) => DEFS[k].name[I]);

  const formula = [
    zh ? `**数据来源：** ${label}（${res.source_url}），获取时间 ${fetched}（UTC）。` : `**Source:** ${label} (${res.source_url}), fetched ${fetched} (UTC).`,
    '',
    ...shown.map((k) => `- **${DEFS[k].name[I]}**${DEFS[k].unit[I] ? ` (${DEFS[k].unit[I]})` : ''}: ${DEFS[k].desc[I]}.`),
    '',
    ...(unavailableNames.length
      ? [
          zh
            ? `**${label} 未提供：** ${joinList(unavailableNames, lang)}。这些指标已省略，没有编造任何数值。`
            : `**Not available from ${label}:** ${joinList(unavailableNames, lang)}. These metrics are left out; no values were invented.`,
          '',
        ]
      : []),
    ...(res.stale
      ? [zh ? '数据源暂时无法访问，以下为最近一次缓存的数值。' : 'The source could not be reached; these are the last cached numbers.', '']
      : []),
    zh ? '本榜单未报告置信区间，数据源只给出单个数值，因此排序应视为暂定。' : 'The source reports single values without intervals, so the order should be treated as provisional.',
    '',
    attributionLine(res.source),
  ].join('\n');

  const matchLines = models.map((m) =>
    m.query && m.query !== m.name ? `- ${m.query} → **${m.name}**${m.creator ? ` (${m.creator})` : ''}` : `- **${m.name}**${m.creator ? ` (${m.creator})` : ''}`,
  );
  const selectionLine =
    res.selection === 'top_intelligence'
      ? zh
        ? `按 ${label} 智能指数选出前 ${names.length} 名模型：`
        : `Top ${names.length} models by ${label} Intelligence Index:`
      : res.selection === 'top_newest'
        ? zh
          ? `${label} 上最新上线的 ${names.length} 个主流旗舰模型：`
          : `The ${names.length} newest flagship models from major labs listed on ${label}:`
        : zh
          ? '名称匹配（宽松匹配；多个候选时取智能指数最高者，否则取最新者）：'
          : 'How names were matched (loose matching; with several candidates the highest Intelligence Index wins, else the newest):';
  const worked = [
    selectionLine,
    '',
    ...matchLines,
    ...(unmatched.length ? ['', zh ? `未找到：${joinList(unmatched, lang)}，已省略。` : `No match found for ${joinList(unmatched, lang)}; left out.`] : []),
  ].join('\n');

  const held = [
    zh ? `所有数值来自同一份 ${label} 快照（${fetched} UTC）` : `All numbers from one ${label} snapshot (${fetched} UTC)`,
    zh ? '价格为美元标价，每百万 token，输入:输出 = 3:1 混合' : 'Prices are USD list prices per 1M tokens, blended 3 input : 1 output',
    res.source === 'artificial_analysis'
      ? zh
        ? '指数与速度均由 Artificial Analysis 测得，本榜单未重新运行'
        : 'Index scores and speeds as measured by Artificial Analysis, not re-run here'
      : zh
        ? 'OpenRouter 只列出价格与上下文长度，不提供评测分数'
        : 'OpenRouter lists prices and context length only, no benchmark scores',
  ];

  const primary = PRIMARY_ORDER.filter((k) => shown.includes(k) && DEFS[k].direction === 'higher').sort(
    (a, b) => (wanted.indexOf(a) + 99) % 99 - ((wanted.indexOf(b) + 99) % 99),
  )[0] ?? shown[0];
  const cost: string = shown.includes('price') && primary !== 'price' ? 'price' : 'none';

  const live: LiveSpec = {
    source: res.source,
    source_label: label,
    source_url: res.source_url,
    fetched_at: fetched,
    stale: res.stale,
    lang,
    requested: wanted,
    metrics: shown,
    unavailable,
    models,
    unmatched,
    selection: res.selection,
    top: opts.top,
  };

  return {
    title: opts.title?.trim() || (zh ? `AI 模型对比：${joinList(names.slice(0, 4), lang)}` : `AI model comparison: ${joinList(names.slice(0, 4), lang)}`),
    description:
      opts.description ??
      (zh
        ? `${joinList(names, lang)} 的真实公开数据，来自 ${label}。引用前请核对数据源。`
        : `Real public numbers for ${joinList(names, lang)} from ${label}. Check the source before citing.`),
    payload: {
      metrics,
      items,
      methodology: { formula, worked_example: worked, held_fixed: held },
      primary_metric_id: primary,
      cost_metric_id: cost,
      live,
    },
  };
}

/** Re-pulls the same models from the (cached) source and rebuilds values and methodology. */
export async function refreshLive(live: LiveSpec, keep: { title: string; description: string }): Promise<BoardDoc> {
  const queries = live.models.map((m) => m.name);
  const queryMap = Object.fromEntries(live.models.map((m) => [m.name, m.query ?? m.name]));
  const res = await fetchModelData(queries, live.top);
  if (!res.rows.length) throw new Error('no models found');
  return buildLiveDoc(res, live.requested, live.lang, { title: keep.title, description: keep.description, queryMap, top: live.top });
}
