import { useMemo, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { analyzeMetric, formatValue, paretoFrontier, resolveRoles, type BoardDoc, type MetricAnalysis } from '@/lib/board';
import { joinNames, useI18n } from '@/lib/i18n';
import BarChart from './BarChart';
import ScatterChart from './ScatterChart';
import ModelsTable from './ModelsTable';
import MethodologyView from './MethodologyView';

interface Props {
  doc: BoardDoc;
  actions?: ReactNode;
  meta?: ReactNode;
  print?: boolean;
}

export function StatusBanner({ analysis }: { analysis: MetricAnalysis | undefined }) {
  const { t, lang } = useI18n();
  if (!analysis || analysis.status === 'empty') return null;
  const name = analysis.metric.name;
  const tone =
    analysis.status === 'lead'
      ? 'border-primary/25 bg-accent text-accent-foreground'
      : 'border-[hsl(var(--warn-border))] bg-[hsl(var(--warn-bg))] text-[hsl(var(--warn-fg))]';
  const title =
    analysis.status === 'tie' ? t('st.tie.t') : analysis.status === 'lead' ? t('st.lead.t', { metric: name }) : t('st.none.t');
  const body =
    analysis.status === 'tie'
      ? t('st.tie.d', { metric: name, names: joinNames(analysis.tiedNames, lang) })
      : analysis.status === 'lead'
        ? t('st.lead.d', { name: analysis.rows[0].item.name })
        : t('st.none.d', { metric: name });
  return (
    <div role="status" className={`print-avoid rounded-2xl border px-4 py-3.5 sm:px-5 ${tone}`}>
      <p className="font-display text-[17px] font-semibold">{title}</p>
      <p className="mt-1 text-[14px] leading-relaxed opacity-90">{body}</p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel min-w-0 p-4 sm:p-5">
      <p className="text-[12.5px] leading-snug text-muted-foreground">{label}</p>
      <p className={`font-display mt-2 truncate text-2xl leading-tight ${/^[\d.,–\s-]+$/.test(value) ? 'tabular' : ''}`} title={value}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 truncate text-[12.5px] text-muted-foreground" title={sub}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function BoardView({ doc, actions, meta, print = false, footer }: Props & { footer?: ReactNode }) {
  const { t, lang } = useI18n();
  const { metrics, items, methodology } = doc.payload;
  const { primary, cost } = resolveRoles(metrics, doc.payload.primary_metric_id, doc.payload.cost_metric_id);

  const analyses = useMemo(() => metrics.map((m) => analyzeMetric(m, items)), [metrics, items]);
  const primaryA = analyses.find((a) => a.metric.id === primary?.id);
  const highlight = useMemo(
    () => new Set(primaryA?.rows.filter((r) => r.leader || r.tied).map((r) => r.item.id) ?? []),
    [primaryA],
  );

  const runs = items.flatMap((it) => Object.values(it.scores).map((s) => s?.runs).filter((r): r is number => r != null && r > 0));
  const runsValue = runs.length ? (Math.min(...runs) === Math.max(...runs) ? String(runs[0]) : `${Math.min(...runs)}–${Math.max(...runs)}`) : t('b.tile.runsNone');

  let topValue = '—';
  let topSub = '';
  if (primaryA && primaryA.rows.length) {
    if (primaryA.status === 'tie') {
      topValue = t('b.tile.tie', { n: primaryA.tiedNames.length });
      topSub = joinNames(primaryA.tiedNames, lang);
    } else {
      topValue = primaryA.rows[0].item.name;
      topSub = `${formatValue(primaryA.rows[0].score.value)}${primary?.unit ? ` ${primary.unit}` : ''}`;
    }
  }
  const frontierCount = primary && cost ? paretoFrontier(items, primary, cost).length : 0;

  const indexContent = (
    <div className="flex flex-col gap-5">
      <StatusBanner analysis={primaryA} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-primary" aria-hidden />
          {t('chart.legendLead')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-4 rounded-sm bg-[#BCC3D9] dark:bg-[#4A4F66]" aria-hidden />
          {t('chart.legendOther')}
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="18" height="10" aria-hidden className="text-foreground">
            <g stroke="currentColor" strokeWidth="1.5">
              <line x1="1" x2="17" y1="5" y2="5" />
              <line x1="1" x2="1" y1="1" y2="9" />
              <line x1="17" x2="17" y1="1" y2="9" />
            </g>
          </svg>
          {t('chart.legendCi')}
        </span>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {analyses.map((a) => (
          <BarChart key={a.metric.id} analysis={a} forceLight={print} showCopy={!print || true} />
        ))}
      </div>
      {primary && cost ? (
        <ScatterChart items={items} scoreMetric={primary} costMetric={cost} highlight={highlight} forceLight={print} />
      ) : (
        <p className="panel p-5 text-sm text-muted-foreground">{t('chart.noCost')}</p>
      )}
    </div>
  );

  return (
    <article className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <header className="pb-8 pt-10 sm:pt-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            {meta && <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">{meta}</div>}
            <h1 className="font-display break-words text-[34px] font-semibold leading-[1.1] sm:text-[46px]">{doc.title}</h1>
            {doc.description && <p className="mt-4 whitespace-pre-line text-[16px] leading-relaxed text-muted-foreground">{doc.description}</p>}
          </div>
          {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Tile label={t('b.tile.items')} value={String(items.length)} sub={cost && primary ? `${t('b.tile.frontier')}: ${frontierCount}` : undefined} />
          <Tile label={t('b.tile.metrics')} value={String(metrics.length)} sub={metrics.map((m) => m.name).join(' · ')} />
          <Tile label={t('b.tile.top', { metric: primary?.name ?? '' })} value={topValue} sub={topSub} />
          <Tile label={t('b.tile.runs')} value={runsValue} />
        </div>
      </header>

      {print ? (
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold">{t('b.tab.index')}</h2>
            {indexContent}
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold">{t('b.tab.models')}</h2>
            <ModelsTable items={items} metrics={metrics} primary={primary} scrollable={false} />
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-2xl font-semibold">{t('b.tab.method')}</h2>
            <MethodologyView methodology={methodology} metrics={metrics} />
          </section>
        </div>
      ) : (
        <Tabs defaultValue="index" className="w-full">
          <TabsList className="mb-6 h-11 w-full justify-start sm:w-auto">
            <TabsTrigger value="index" className="h-9 flex-1 px-4 sm:flex-none">
              {t('b.tab.index')}
            </TabsTrigger>
            <TabsTrigger value="models" className="h-9 flex-1 px-4 sm:flex-none">
              {t('b.tab.models')}
            </TabsTrigger>
            <TabsTrigger value="method" className="h-9 flex-1 px-4 sm:flex-none">
              {t('b.tab.method')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="index">{indexContent}</TabsContent>
          <TabsContent value="models">
            <ModelsTable items={items} metrics={metrics} primary={primary} />
          </TabsContent>
          <TabsContent value="method">
            <MethodologyView methodology={methodology} metrics={metrics} />
          </TabsContent>
        </Tabs>
      )}
      {footer}
    </article>
  );
}
