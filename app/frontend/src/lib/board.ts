export type Direction = 'higher' | 'lower';

export interface Metric {
  id: string;
  name: string;
  unit: string;
  direction: Direction;
  source?: string;
}

export type LiveMetricKey = 'intelligence' | 'coding' | 'math' | 'price' | 'speed' | 'ttft' | 'context';
export type LiveSource = 'artificial_analysis' | 'openrouter';

export interface LiveModelRef {
  query: string | null;
  key: string;
  name: string;
  creator: string;
}

/** Present on boards whose numbers were pulled from a real model-data source. */
export interface LiveSpec {
  source: LiveSource;
  source_label: string;
  source_url: string;
  fetched_at: string;
  stale?: boolean;
  lang: 'en' | 'zh';
  requested: LiveMetricKey[];
  metrics: LiveMetricKey[];
  unavailable: LiveMetricKey[];
  models: LiveModelRef[];
  unmatched: string[];
  selection: string;
  top: number | null;
}

export interface Score {
  value: number;
  low?: number | null;
  high?: number | null;
  runs?: number | null;
}

export interface Item {
  id: string;
  name: string;
  scores: Record<string, Score | undefined>;
}

export interface Methodology {
  formula: string;
  worked_example: string;
  held_fixed: string[];
}

export interface BoardPayload {
  metrics: Metric[];
  items: Item[];
  methodology: Methodology;
  primary_metric_id: string;
  cost_metric_id: string;
  live?: LiveSpec;
}

export interface BoardDoc {
  title: string;
  description: string;
  payload: BoardPayload;
}

const LOWER_IS_BETTER = /(cost|price|time|latency|minute|second|duration|token|费用|成本|价格|时间|耗时|延迟)/i;
const COST_HINT = /(cost|price|cny|usd|rmb|费用|成本|价格)/i;

let idSeq = 0;
export function makeId(prefix: string): string {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}${idSeq.toString(36)}`;
}

export function guessDirection(name: string): Direction {
  return LOWER_IS_BETTER.test(name) ? 'lower' : 'higher';
}

export function hasInterval(s: Score): boolean {
  return s.low != null && s.high != null && Number.isFinite(s.low) && Number.isFinite(s.high);
}

export function bounds(s: Score): [number, number] {
  if (!hasInterval(s)) return [s.value, s.value];
  return [Math.min(s.low as number, s.value), Math.max(s.high as number, s.value)];
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

export type MetricStatus = 'tie' | 'lead' | 'no_intervals' | 'empty';

export interface RankedRow {
  item: Item;
  score: Score;
  rank: number;
  leader: boolean;
  tied: boolean;
}

export interface MetricAnalysis {
  metric: Metric;
  rows: RankedRow[];
  missing: Item[];
  status: MetricStatus;
  tiedNames: string[];
}

/** Ranks items on one metric and marks every item whose 95% interval overlaps the leader's. */
export function analyzeMetric(metric: Metric, items: Item[]): MetricAnalysis {
  const scored: { item: Item; score: Score }[] = [];
  const missing: Item[] = [];
  for (const item of items) {
    const s = item.scores[metric.id];
    if (s && Number.isFinite(s.value)) scored.push({ item, score: s });
    else missing.push(item);
  }
  scored.sort((a, b) =>
    metric.direction === 'higher' ? b.score.value - a.score.value : a.score.value - b.score.value,
  );
  if (!scored.length) return { metric, rows: [], missing, status: 'empty', tiedNames: [] };

  const leader = scored[0];
  const leaderHasInterval = hasInterval(leader.score);
  const rows: RankedRow[] = scored.map((r, i) => ({
    ...r,
    rank: i + 1,
    leader: i === 0,
    tied: leaderHasInterval && i > 0 && overlaps(bounds(leader.score), bounds(r.score)),
  }));
  const anyTied = rows.some((r) => r.tied);
  if (anyTied) rows[0].tied = true;
  const status: MetricStatus = !leaderHasInterval ? 'no_intervals' : anyTied ? 'tie' : 'lead';
  return { metric, rows, missing, status, tiedNames: rows.filter((r) => r.tied).map((r) => r.item.name) };
}

/** Items that no other item beats on both score and cost (lower cost is better). */
export function paretoFrontier(items: Item[], scoreMetric: Metric, costMetric: Metric): Item[] {
  const sign = scoreMetric.direction === 'higher' ? 1 : -1;
  const points = items
    .map((item) => ({ item, s: item.scores[scoreMetric.id], c: item.scores[costMetric.id] }))
    .filter((p) => p.s && p.c && Number.isFinite(p.s.value) && Number.isFinite(p.c.value))
    .sort((a, b) => (a.c as Score).value - (b.c as Score).value || sign * ((b.s as Score).value - (a.s as Score).value));
  const frontier: Item[] = [];
  let best = -Infinity;
  for (const p of points) {
    const g = sign * (p.s as Score).value;
    if (g > best) {
      frontier.push(p.item);
      best = g;
    }
  }
  return frontier;
}

export function resolveRoles(metrics: Metric[], primaryId: string, costId: string): { primary: Metric | undefined; cost: Metric | undefined } {
  const primary =
    metrics.find((m) => m.id === primaryId) ?? metrics.find((m) => m.direction === 'higher') ?? metrics[0];
  let cost: Metric | undefined;
  if (costId === 'none') cost = undefined;
  else cost = metrics.find((m) => m.id === costId) ?? metrics.find((m) => m.id !== primary?.id && COST_HINT.test(`${m.name} ${m.unit}`));
  if (cost && cost.id === primary?.id) cost = undefined;
  return { primary, cost };
}

function niceStep(range: number, count: number): number {
  if (range <= 0) return 1;
  const raw = range / count;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

export function niceDomain(min: number, max: number, count = 4): { lo: number; hi: number; ticks: number[] } {
  let a = min;
  let b = max;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { lo: 0, hi: 1, ticks: [0, 1] };
  if (a === b) {
    a = a === 0 ? 0 : a - Math.abs(a) * 0.1;
    b = b === 0 ? 1 : b + Math.abs(b) * 0.1;
  }
  const step = niceStep(b - a, count);
  const lo = Math.floor(a / step) * step;
  const hi = Math.ceil(b / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo, hi: hi === lo ? lo + step : hi, ticks };
}

export function formatValue(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const d = a === 0 ? 0 : a < 0.1 ? 3 : a < 10 ? 2 : a < 100 ? 1 : 0;
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function formatTick(v: number): string {
  return String(Number(v.toPrecision(6)));
}

export function metricLabel(m: Metric): string {
  return m.unit ? `${m.name} (${m.unit})` : m.name;
}

/* ---------- Import ---------- */

export class ImportError extends Error {
  constructor(public key: string, public detail = '') {
    super(key);
  }
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function splitUnit(header: string): { name: string; unit: string } {
  const m = header.match(/^(.*?)\s*[(（]([^)）]+)[)）]\s*$/);
  return m ? { name: m[1].trim(), unit: m[2].trim() } : { name: header.trim(), unit: '' };
}

export function parseCsvRows(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

const SUFFIX = /^(.+?)[\s_\-.]+(low|lower|lo|ci_low|high|upper|hi|ci_high|runs|n)$/i;

export function importCsv(text: string): { metrics: Metric[]; items: Item[] } {
  if (!text.trim()) throw new ImportError('imp.empty');
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new ImportError('imp.csvEmpty');
  const header = rows[0];
  const metrics: Metric[] = [];
  const byHeader = new Map<string, Metric>();
  const columns: { metric: Metric; field: 'value' | 'low' | 'high' | 'runs' }[] = [];
  header.slice(1).forEach((h) => {
    const suffix = h.match(SUFFIX);
    const base = suffix ? byHeader.get(suffix[1].trim().toLowerCase()) : undefined;
    if (suffix && base) {
      const s = suffix[2].toLowerCase();
      const field = s.includes('lo') ? 'low' : s.includes('hi') || s === 'upper' ? 'high' : 'runs';
      columns.push({ metric: base, field });
      return;
    }
    const { name, unit } = splitUnit(h);
    const metric: Metric = { id: makeId('m'), name, unit, direction: guessDirection(h) };
    metrics.push(metric);
    byHeader.set(h.trim().toLowerCase(), metric);
    columns.push({ metric, field: 'value' });
  });
  if (!metrics.length) throw new ImportError('imp.csvNoMetric');
  const items: Item[] = rows.slice(1).map((r) => {
    const item: Item = { id: makeId('i'), name: r[0] ?? '', scores: {} };
    columns.forEach((col, ci) => {
      const n = toNum(r[ci + 1]);
      const cur = item.scores[col.metric.id] ?? ({ value: NaN } as Score);
      if (col.field === 'value') cur.value = n ?? NaN;
      else cur[col.field] = n;
      item.scores[col.metric.id] = cur;
    });
    return item;
  });
  return { metrics, items };
}

type Loose = Record<string, unknown>;
const isObj = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);

function scoreFrom(raw: unknown): Score | undefined {
  if (typeof raw === 'number' || typeof raw === 'string') {
    const n = toNum(raw);
    return n == null ? undefined : { value: n };
  }
  if (!isObj(raw)) return undefined;
  const value = toNum(raw.value ?? raw.score ?? raw.mean);
  if (value == null) return undefined;
  return {
    value,
    low: toNum(raw.low ?? raw.ci_low ?? raw.lo ?? raw.lower),
    high: toNum(raw.high ?? raw.ci_high ?? raw.hi ?? raw.upper),
    runs: toNum(raw.runs ?? raw.n),
  };
}

export function importJson(text: string): Partial<BoardDoc> & { payload: Partial<BoardPayload> & { metrics: Metric[]; items: Item[] } } {
  if (!text.trim()) throw new ImportError('imp.empty');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new ImportError('imp.json', e instanceof Error ? e.message : '');
  }
  if (!isObj(data)) throw new ImportError('imp.jsonShape');
  const root: Loose = isObj(data.payload) ? data.payload : data;
  const itemsRaw = (root.items ?? root.models) as unknown;
  if (!Array.isArray(itemsRaw)) throw new ImportError('imp.jsonShape');

  let metricsRaw = root.metrics as unknown;
  if (!Array.isArray(metricsRaw)) {
    const first = itemsRaw.find((it) => isObj(it) && isObj(it.scores)) as Loose | undefined;
    metricsRaw = first ? Object.keys(first.scores as Loose) : null;
  }
  if (!Array.isArray(metricsRaw) || !metricsRaw.length) throw new ImportError('imp.jsonShape');

  const metrics: Metric[] = metricsRaw.map((m) => {
    if (typeof m === 'string') {
      const { name, unit } = splitUnit(m);
      return { id: m, name, unit, direction: guessDirection(m) };
    }
    const o = isObj(m) ? m : {};
    const name = String(o.name ?? o.id ?? 'Metric');
    const dir =
      o.direction === 'lower' || o.higher_is_better === false
        ? 'lower'
        : o.direction === 'higher' || o.higher_is_better === true
          ? 'higher'
          : guessDirection(name);
    const metric: Metric = { id: String(o.id ?? name), name, unit: String(o.unit ?? ''), direction: dir };
    if (typeof o.source === 'string' && o.source) metric.source = o.source;
    return metric;
  });

  const items: Item[] = itemsRaw.map((it, idx) => {
    const o = isObj(it) ? it : {};
    const scoresRaw = isObj(o.scores) ? o.scores : o;
    const scores: Record<string, Score | undefined> = {};
    for (const m of metrics) scores[m.id] = scoreFrom(scoresRaw[m.id] ?? scoresRaw[m.name]);
    return { id: String(o.id ?? `item_${idx + 1}`), name: String(o.name ?? o.model ?? ''), scores };
  });

  const methodRaw = isObj(root.methodology) ? root.methodology : isObj(data.methodology) ? data.methodology : null;
  const methodology: Methodology | undefined = methodRaw
    ? {
        formula: String(methodRaw.formula ?? ''),
        worked_example: String(methodRaw.worked_example ?? ''),
        held_fixed: Array.isArray(methodRaw.held_fixed)
          ? methodRaw.held_fixed.map(String)
          : String(methodRaw.held_fixed ?? '')
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
      }
    : undefined;

  return {
    title: typeof data.title === 'string' ? data.title : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    payload: {
      metrics,
      items,
      methodology,
      primary_metric_id: typeof root.primary_metric_id === 'string' ? root.primary_metric_id : undefined,
      cost_metric_id: typeof root.cost_metric_id === 'string' ? root.cost_metric_id : undefined,
    },
  };
}

export type ImportedBoard = ReturnType<typeof importJson>;

/* ---------- Editor draft ---------- */

export interface DraftCell {
  value: string;
  low: string;
  high: string;
  runs: string;
}

export interface DraftItem {
  id: string;
  name: string;
  cells: Record<string, DraftCell>;
}

export interface Draft {
  title: string;
  description: string;
  metrics: Metric[];
  items: DraftItem[];
  formula: string;
  worked_example: string;
  held_fixed: string;
  primary_metric_id: string;
  cost_metric_id: string;
  live?: LiveSpec;
}

export interface DraftIssue {
  key: string;
  params?: Record<string, string | number>;
}

export const emptyCell = (): DraftCell => ({ value: '', low: '', high: '', runs: '' });
const s = (v?: number | null) => (v == null || !Number.isFinite(v) ? '' : String(v));

export function itemsToDraft(items: Item[], metrics: Metric[]): DraftItem[] {
  return items.map((it) => ({
    id: it.id,
    name: it.name,
    cells: Object.fromEntries(
      metrics.map((m) => {
        const sc = it.scores[m.id];
        return [m.id, sc ? { value: s(sc.value), low: s(sc.low), high: s(sc.high), runs: s(sc.runs) } : emptyCell()];
      }),
    ),
  }));
}

export function docToDraft(doc: BoardDoc): Draft {
  const p = doc.payload;
  return {
    title: doc.title,
    description: doc.description,
    metrics: p.metrics,
    items: itemsToDraft(p.items, p.metrics),
    formula: p.methodology?.formula ?? '',
    worked_example: p.methodology?.worked_example ?? '',
    held_fixed: (p.methodology?.held_fixed ?? []).join('\n'),
    primary_metric_id: p.primary_metric_id ?? '',
    cost_metric_id: p.cost_metric_id ?? '',
    live: p.live,
  };
}

export function emptyDraft(): Draft {
  const metric: Metric = { id: makeId('m'), name: 'Score', unit: '', direction: 'higher' };
  const mk = (): DraftItem => ({ id: makeId('i'), name: '', cells: { [metric.id]: emptyCell() } });
  return {
    title: '',
    description: '',
    metrics: [metric],
    items: [mk(), mk()],
    formula: '',
    worked_example: '',
    held_fixed: '',
    primary_metric_id: metric.id,
    cost_metric_id: '',
  };
}

export function draftToDoc(d: Draft): { doc: BoardDoc | null; issues: DraftIssue[] } {
  const issues: DraftIssue[] = [];
  if (!d.title.trim()) issues.push({ key: 'err.title' });
  if (!d.metrics.length) issues.push({ key: 'err.noMetric' });
  const seen = new Set<string>();
  d.metrics.forEach((m, i) => {
    const n = m.name.trim().toLowerCase();
    if (!n) issues.push({ key: 'err.metricName', params: { n: i + 1 } });
    else if (seen.has(n)) issues.push({ key: 'err.dupMetric', params: { name: m.name } });
    seen.add(n);
  });

  const items: Item[] = [];
  d.items.forEach((row, ri) => {
    const name = row.name.trim();
    const cells = d.metrics.map((m) => row.cells[m.id] ?? emptyCell());
    const anyValue = cells.some((c) => c.value || c.low || c.high || c.runs);
    if (!name) {
      if (anyValue) issues.push({ key: 'err.itemName', params: { n: ri + 1 } });
      return;
    }
    const item: Item = { id: row.id, name, scores: {} };
    d.metrics.forEach((m, mi) => {
      const c = cells[mi];
      if (!c.value.trim() && !c.low.trim() && !c.high.trim() && !c.runs.trim()) return;
      const p = { item: name, metric: m.name || `#${mi + 1}` };
      const value = toNum(c.value);
      const low = toNum(c.low);
      const high = toNum(c.high);
      const runs = toNum(c.runs);
      if (value == null) return issues.push({ key: 'err.number', params: { ...p, value: c.value } });
      if ((c.low.trim() && low == null) || (c.high.trim() && high == null))
        return issues.push({ key: 'err.number', params: { ...p, value: `${c.low} ${c.high}`.trim() } });
      if ((low == null) !== (high == null)) return issues.push({ key: 'err.intervalPair', params: p });
      if (low != null && high != null && (low > value || high < value))
        return issues.push({ key: 'err.intervalOrder', params: p });
      if (c.runs.trim() && (runs == null || runs < 1 || !Number.isInteger(runs)))
        return issues.push({ key: 'err.runs', params: p });
      item.scores[m.id] = { value, low, high, runs };
    });
    items.push(item);
  });
  if (!items.length) issues.push({ key: 'err.noItem' });
  const itemNames = new Set<string>();
  items.forEach((it) => {
    const k = it.name.toLowerCase();
    if (itemNames.has(k)) issues.push({ key: 'err.dupItem', params: { name: it.name } });
    itemNames.add(k);
  });
  if (items.length && !items.some((it) => Object.keys(it.scores).length > 0)) issues.push({ key: 'err.noScore' });
  if (issues.length) return { doc: null, issues };

  const { primary, cost } = resolveRoles(d.metrics, d.primary_metric_id, d.cost_metric_id);
  return {
    doc: {
      title: d.title.trim(),
      description: d.description.trim(),
      payload: {
        metrics: d.metrics.map((m) => ({ ...m, name: m.name.trim(), unit: m.unit.trim() })),
        items,
        methodology: {
          formula: d.formula,
          worked_example: d.worked_example,
          held_fixed: d.held_fixed
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
        },
        primary_metric_id: primary?.id ?? '',
        cost_metric_id: cost?.id ?? 'none',
        ...(d.live ? { live: d.live } : {}),
      },
    },
    issues,
  };
}

/* ---------- Example ---------- */

type Row = [string, [number, number, number, number], [number, number, number, number], [number, number, number, number], [number, number, number, number]];

const EXAMPLE_ROWS: Row[] = [
  ['Lumen Pro', [78.4, 75.9, 80.8, 5], [92.1, 90.4, 93.6, 5], [1.84, 1.71, 1.98, 5], [6.2, 5.6, 7.1, 5]],
  ['Orion 70B', [77.1, 74.5, 79.6, 5], [89.7, 87.8, 91.5, 5], [0.62, 0.57, 0.68, 5], [9.8, 8.9, 11.0, 5]],
  ['Sable 32B', [72.6, 69.8, 75.3, 5], [86.2, 84.0, 88.3, 5], [0.31, 0.28, 0.34, 5], [7.4, 6.8, 8.3, 5]],
  ['Vega Mini', [69.8, 67.0, 72.5, 5], [84.5, 82.2, 86.7, 5], [0.18, 0.16, 0.2, 5], [3.1, 2.8, 3.6, 5]],
  ['Tern Flash', [64.3, 61.2, 67.3, 5], [80.9, 78.4, 83.3, 5], [0.07, 0.06, 0.08, 5], [1.9, 1.7, 2.2, 5]],
  ['Kestrel 8B', [58.7, 55.5, 61.8, 3], [76.4, 73.6, 79.1, 3], [0.09, 0.08, 0.1, 3], [2.6, 2.3, 3.1, 3]],
];

const EXAMPLE_TEXT = {
  en: {
    title: 'Contract clause extraction, October 2026',
    description:
      'Six models extract typed clauses from 240 commercial contracts. Illustrative example data that shows how IndexBoard reports intervals, ties and the cost frontier.',
    metrics: [
      ['Accuracy', '%'],
      ['Coverage', '%'],
      ['Cost per run', 'CNY'],
      ['Median time', 'min'],
    ],
    formula: `**Accuracy** is the share of gold clauses a model extracts with the correct type and span.

\`Accuracy = correct clauses / gold clauses × 100\`

**Coverage** is the share of the 240 contracts for which the model returned a parseable answer.

Each model ran the full set **5 times** (Kestrel 8B: 3). We report the mean; the 95% interval is a percentile bootstrap over contracts with 2,000 resamples.

**Cost per run** is the API bill in CNY for one pass over all 240 contracts. **Median time** is wall-clock minutes per pass.`,
    worked: `Lumen Pro, run 3: 1,882 of 2,400 gold clauses correct.

\`1882 / 2400 × 100 = 78.4%\`

Across 5 runs the mean is 78.4% with interval [75.9, 80.8]. Orion 70B scores 77.1% with interval [74.5, 79.6]. The intervals overlap between 75.9 and 79.6, so the page reports a tie, not a winner.`,
    fixed: [
      'Same 240 contracts and 2,400 gold clauses',
      'Same prompt template and JSON output schema',
      'Temperature 0, maximum output 4,096 tokens',
      'Same scoring script (v1.3)',
      'All runs between 1 and 14 October 2026',
    ],
  },
  zh: {
    title: '合同条款抽取评测，2026 年 10 月',
    description: '六个模型从 240 份商业合同中抽取带类型的条款。示例数据仅用于展示 IndexBoard 如何呈现置信区间、并列与成本前沿。',
    metrics: [
      ['准确率', '%'],
      ['覆盖率', '%'],
      ['单次运行成本', 'CNY'],
      ['中位耗时', '分钟'],
    ],
    formula: `**准确率**：模型以正确类型和范围抽取出的标准条款占全部标准条款的比例。

\`准确率 = 正确条款数 / 标准条款数 × 100\`

**覆盖率**：模型返回可解析答案的合同占 240 份合同的比例。

每个模型完整运行 **5 次**（Kestrel 8B 为 3 次）。报告均值；95% 区间为按合同重采样 2,000 次的百分位 bootstrap。

**单次运行成本**：完整跑一遍 240 份合同的 API 费用（人民币）。**中位耗时**：每遍的实际分钟数。`,
    worked: `Lumen Pro 第 3 次运行：2,400 个标准条款中正确 1,882 个。

\`1882 / 2400 × 100 = 78.4%\`

5 次运行均值为 78.4%，区间 [75.9, 80.8]。Orion 70B 为 77.1%，区间 [74.5, 79.6]。两个区间在 75.9 到 79.6 之间重叠，因此页面报告并列，而不是宣布胜者。`,
    fixed: [
      '相同的 240 份合同与 2,400 个标准条款',
      '相同的提示词模板与 JSON 输出格式',
      '温度 0，最大输出 4,096 tokens',
      '相同的评分脚本（v1.3）',
      '所有运行均在 2026 年 10 月 1 日至 14 日之间',
    ],
  },
};

export function exampleDoc(lang: 'en' | 'zh'): BoardDoc {
  const tx = EXAMPLE_TEXT[lang];
  const ids = ['accuracy', 'coverage', 'cost', 'time'];
  const metrics: Metric[] = tx.metrics.map(([name, unit], i) => ({
    id: ids[i],
    name,
    unit,
    direction: i < 2 ? 'higher' : 'lower',
  }));
  const items: Item[] = EXAMPLE_ROWS.map(([name, ...vals], idx) => ({
    id: `item_${idx + 1}`,
    name,
    scores: Object.fromEntries(vals.map(([value, low, high, runs], i) => [ids[i], { value, low, high, runs }])),
  }));
  return {
    title: tx.title,
    description: tx.description,
    payload: {
      metrics,
      items,
      methodology: { formula: tx.formula, worked_example: tx.worked, held_fixed: tx.fixed },
      primary_metric_id: 'accuracy',
      cost_metric_id: 'cost',
    },
  };
}
