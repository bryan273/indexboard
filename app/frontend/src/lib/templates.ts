import type { BoardDoc, Item, Metric } from '@/lib/board';
import type { Lang } from '@/lib/i18n';

export type TemplateId = 'llm' | 'paper' | 'product' | 'team';
export const TEMPLATE_IDS: TemplateId[] = ['llm', 'paper', 'product', 'team'];

type Bi = [string, string];
interface MetricDef {
  id: string;
  name: Bi;
  unit: Bi;
  direction: 'higher' | 'lower';
}
/** [value, half-width of the 95% interval, runs] per metric. */
type Cell = [number, number, number];
interface TemplateDef {
  title: Bi;
  description: Bi;
  metrics: MetricDef[];
  items: [Bi, ...Cell[]][];
  primary: string;
  cost: string;
  formula: Bi;
  worked: Bi;
  fixed: Bi[];
}

const TEMPLATES: Record<TemplateId, TemplateDef> = {
  llm: {
    title: ['LLM leaderboard', '大模型排行榜'],
    description: ['Compare language models on quality, price and speed under one shared evaluation setup.', '在同一评测设置下比较大语言模型的质量、价格与速度。'],
    metrics: [
      { id: 'quality', name: ['Quality index', '质量指数'], unit: ['pts', '分'], direction: 'higher' },
      { id: 'price', name: ['Price per 1M tokens', '每百万 token 价格'], unit: ['USD', 'USD'], direction: 'lower' },
      { id: 'speed', name: ['Output speed', '输出速度'], unit: ['tok/s', 'tok/s'], direction: 'higher' },
      { id: 'latency', name: ['Time to first token', '首 token 延迟'], unit: ['s', '秒'], direction: 'lower' },
    ],
    items: [
      [['Model A', '模型 A'], [71.2, 2.1, 5], [10, 0, 1], [62, 6, 5], [0.62, 0.08, 5]],
      [['Model B', '模型 B'], [69.8, 2.3, 5], [3, 0, 1], [88, 7, 5], [0.45, 0.06, 5]],
      [['Model C', '模型 C'], [64.5, 2.4, 5], [0.6, 0, 1], [140, 11, 5], [0.31, 0.04, 5]],
      [['Model D', '模型 D'], [58.1, 2.6, 5], [0.15, 0, 1], [210, 15, 5], [0.22, 0.03, 5]],
      [['Model E', '模型 E'], [52.7, 2.8, 5], [0.08, 0, 1], [175, 14, 5], [0.27, 0.04, 5]],
    ],
    primary: 'quality',
    cost: 'price',
    formula: [
      '**Quality index** is the mean accuracy across the benchmark suite, scaled 0–100. The 95% interval is a bootstrap over questions.\n\n**Price** is the blended list price per 1M tokens (3:1 input to output). **Output speed** and **time to first token** are medians over 5 runs.',
      '**质量指数**为评测集各项准确率的均值，换算到 0–100。95% 区间为按题目的 bootstrap。\n\n**价格**为每百万 token 的混合标价（输入:输出 = 3:1）。**输出速度**与**首 token 延迟**为 5 次运行的中位数。',
    ],
    worked: [
      'Model A answers 712 of 1,000 questions correctly: `712 / 1000 × 100 = 71.2`.',
      '模型 A 在 1,000 道题中答对 712 道：`712 / 1000 × 100 = 71.2`。',
    ],
    fixed: [
      ['Same prompts and system message', '相同的提示词与系统消息'],
      ['Temperature 0', '温度 0'],
      ['Same region and time window', '相同的区域与时间窗口'],
    ],
  },
  paper: {
    title: ['Paper reproduction', '论文复现'],
    description: ['Check how closely reported results reproduce under the original setup.', '检验论文报告的结果在原始设置下能复现到什么程度。'],
    metrics: [
      { id: 'reproduced', name: ['Reproduced score', '复现分数'], unit: ['%', '%'], direction: 'higher' },
      { id: 'reported', name: ['Reported score', '报告分数'], unit: ['%', '%'], direction: 'higher' },
      { id: 'gap', name: ['Gap to reported', '与报告差距'], unit: ['pts', '分'], direction: 'lower' },
      { id: 'compute', name: ['Compute', '算力'], unit: ['GPU h', 'GPU 小时'], direction: 'lower' },
    ],
    items: [
      [['Method A (2025)', '方法 A（2025）'], [84.1, 1.2, 3], [85.0, 0, 1], [0.9, 1.2, 3], [42, 3, 3]],
      [['Method B (2024)', '方法 B（2024）'], [83.4, 1.4, 3], [86.2, 0, 1], [2.8, 1.4, 3], [18, 2, 3]],
      [['Method C (2024)', '方法 C（2024）'], [79.6, 1.5, 3], [80.1, 0, 1], [0.5, 1.5, 3], [9, 1, 3]],
      [['Baseline', '基线'], [74.2, 1.3, 3], [74.0, 0, 1], [0.2, 1.3, 3], [4, 0.5, 3]],
    ],
    primary: 'reproduced',
    cost: 'compute',
    formula: [
      '**Reproduced score** is the mean test accuracy over 3 seeds using the authors\' released code. The interval is the 95% t-interval over seeds.\n\n**Gap** = reported − reproduced (absolute value, lower is better).',
      '**复现分数**为使用作者公开代码、3 个随机种子的测试准确率均值，区间为按种子计算的 95% t 区间。\n\n**差距** = 报告分数 − 复现分数（取绝对值，越低越好）。',
    ],
    worked: ['Method B: reported 86.2, reproduced 83.4, so gap = `86.2 − 83.4 = 2.8` points.', '方法 B：报告 86.2，复现 83.4，差距 = `86.2 − 83.4 = 2.8` 分。'],
    fixed: [
      ['Authors\' released code and hyperparameters', '作者公开的代码与超参数'],
      ['Same dataset split', '相同的数据划分'],
      ['Same GPU type', '相同的 GPU 型号'],
    ],
  },
  product: {
    title: ['Product comparison', '产品对比'],
    description: ['Compare tools on user satisfaction, task success, price and setup effort.', '从用户满意度、任务成功率、价格与上手成本比较各款工具。'],
    metrics: [
      { id: 'success', name: ['Task success', '任务成功率'], unit: ['%', '%'], direction: 'higher' },
      { id: 'satisfaction', name: ['Satisfaction', '满意度'], unit: ['/10', '/10'], direction: 'higher' },
      { id: 'price', name: ['Price per month', '月费'], unit: ['USD', 'USD'], direction: 'lower' },
      { id: 'setup', name: ['Setup time', '上手时间'], unit: ['min', '分钟'], direction: 'lower' },
    ],
    items: [
      [['Product A', '产品 A'], [88, 4, 20], [8.1, 0.5, 20], [49, 0, 1], [35, 6, 20]],
      [['Product B', '产品 B'], [85, 5, 20], [7.8, 0.6, 20], [19, 0, 1], [20, 4, 20]],
      [['Product C', '产品 C'], [76, 6, 20], [7.0, 0.6, 20], [9, 0, 1], [12, 3, 20]],
      [['Product D', '产品 D'], [70, 6, 20], [6.4, 0.7, 20], [0, 0, 1], [8, 2, 20]],
    ],
    primary: 'success',
    cost: 'price',
    formula: [
      '20 participants each completed the same 10 tasks with every product. **Task success** is the share of tasks completed; **satisfaction** is the mean rating. Intervals are 95% bootstrap intervals over participants.',
      '20 名参与者分别用每款产品完成同样的 10 个任务。**任务成功率**为完成任务的比例，**满意度**为平均评分。区间为按参与者的 95% bootstrap 区间。',
    ],
    worked: ['Product A: 176 of 200 tasks completed, `176 / 200 = 88%`.', '产品 A：200 个任务完成 176 个，`176 / 200 = 88%`。'],
    fixed: [
      ['Same 10 tasks in random order', '相同的 10 个任务，随机顺序'],
      ['Same participants for all products', '所有产品使用相同参与者'],
      ['Paid plan entry tier', '付费入门档套餐'],
    ],
  },
  team: {
    title: ['Class or team ranking', '班级或团队排名'],
    description: ['Rank teams on results and effort, and show where differences are too small to matter.', '按成绩与投入为团队排名，并标出差距太小、没有意义的地方。'],
    metrics: [
      { id: 'score', name: ['Average score', '平均分'], unit: ['pts', '分'], direction: 'higher' },
      { id: 'completion', name: ['Completion rate', '完成率'], unit: ['%', '%'], direction: 'higher' },
      { id: 'peer', name: ['Peer rating', '互评'], unit: ['/5', '/5'], direction: 'higher' },
      { id: 'hours', name: ['Hours spent', '投入时长'], unit: ['h', '小时'], direction: 'lower' },
    ],
    items: [
      [['Team 1', '第 1 组'], [86.5, 3.2, 6], [96, 3, 6], [4.4, 0.3, 6], [31, 4, 6]],
      [['Team 2', '第 2 组'], [84.9, 3.5, 6], [92, 4, 6], [4.2, 0.3, 6], [24, 3, 6]],
      [['Team 3', '第 3 组'], [79.3, 3.8, 6], [88, 5, 6], [3.9, 0.4, 6], [27, 4, 6]],
      [['Team 4', '第 4 组'], [73.0, 4.1, 6], [81, 6, 6], [3.6, 0.4, 6], [19, 3, 6]],
      [['Team 5', '第 5 组'], [70.4, 4.4, 6], [77, 6, 6], [3.5, 0.4, 6], [22, 3, 6]],
    ],
    primary: 'score',
    cost: 'hours',
    formula: [
      '**Average score** is the mean of 6 graded assignments. The interval is the 95% t-interval over assignments. **Hours spent** is self-reported total time.',
      '**平均分**为 6 次作业成绩的均值，区间为按作业计算的 95% t 区间。**投入时长**为自报的总时间。',
    ],
    worked: ['Team 1 scored 84, 90, 82, 88, 87, 88: mean `519 / 6 = 86.5`.', '第 1 组得分 84、90、82、88、87、88：均值 `519 / 6 = 86.5`。'],
    fixed: [
      ['Same assignments and rubric', '相同的作业与评分标准'],
      ['Same grader for each assignment', '每次作业由同一位老师评分'],
      ['Same deadline', '相同的截止时间'],
    ],
  },
};

const round = (v: number) => Number(v.toFixed(3));

export function templateDoc(id: TemplateId, lang: Lang): BoardDoc {
  const def = TEMPLATES[id];
  const L = lang === 'zh' ? 1 : 0;
  const metrics: Metric[] = def.metrics.map((m) => ({ id: m.id, name: m.name[L], unit: m.unit[L], direction: m.direction }));
  const items: Item[] = def.items.map(([name, ...cells], idx) => ({
    id: `${id}_${idx + 1}`,
    name: name[L],
    scores: Object.fromEntries(
      cells.map(([value, half, runs], i) => [
        def.metrics[i].id,
        half > 0 ? { value, low: round(Math.max(0, value - half)), high: round(value + half), runs } : { value, low: null, high: null, runs: null },
      ]),
    ),
  }));
  return {
    title: def.title[L],
    description: def.description[L],
    payload: {
      metrics,
      items,
      methodology: { formula: def.formula[L], worked_example: def.worked[L], held_fixed: def.fixed.map((f) => f[L]) },
      primary_metric_id: def.primary,
      cost_metric_id: def.cost,
    },
  };
}

export function templateMeta(id: TemplateId, lang: Lang): { title: string; description: string; metrics: string[] } {
  const def = TEMPLATES[id];
  const L = lang === 'zh' ? 1 : 0;
  return { title: def.title[L], description: def.description[L], metrics: def.metrics.map((m) => m.name[L]) };
}
