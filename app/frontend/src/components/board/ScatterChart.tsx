import { useRef } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  bounds,
  formatTick,
  formatValue,
  hasInterval,
  metricLabel,
  niceDomain,
  paretoFrontier,
  type Item,
  type Metric,
  type Score,
} from '@/lib/board';
import { useI18n } from '@/lib/i18n';
import { SANS, copySvgAsPng, truncate, useElementWidth, usePalette } from './chartKit';

interface Props {
  items: Item[];
  scoreMetric: Metric;
  costMetric: Metric;
  highlight: Set<string>;
  forceLight?: boolean;
  showCopy?: boolean;
}

interface Pt {
  item: Item;
  s: Score;
  c: Score;
}

function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e += 1) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, e);
      if (v >= lo * 0.999 && v <= hi * 1.001) out.push(Number(v.toPrecision(3)));
    }
  }
  return out;
}

export default function ScatterChart({ items, scoreMetric, costMetric, highlight, forceLight = false, showCopy = true }: Props) {
  const { t } = useI18n();
  const pal = usePalette(forceLight);
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const title = t('chart.scatter', { score: scoreMetric.name, cost: costMetric.name });

  const pts: Pt[] = items
    .map((item) => ({ item, s: item.scores[scoreMetric.id] as Score, c: item.scores[costMetric.id] as Score }))
    .filter((p) => p.s && p.c && Number.isFinite(p.s.value) && Number.isFinite(p.c.value));
  const frontier = paretoFrontier(items, scoreMetric, costMetric);
  const frontierIds = new Set(frontier.map((f) => f.id));

  const narrow = width < 480;
  const height = narrow ? 300 : 380;
  const m = { l: 48, r: narrow ? 14 : 24, t: 16, b: 44 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;

  const cs = pts.flatMap((p) => bounds(p.c));
  const ss = pts.flatMap((p) => bounds(p.s));
  const cMin = Math.min(...cs);
  const cMax = Math.max(...cs);
  const useLog = pts.length > 1 && cMin > 0 && cMax / cMin >= 8;

  let xScale: (v: number) => number;
  let xTicks: number[];
  if (useLog) {
    const a = Math.log10(cMin) - 0.08;
    const b = Math.log10(cMax) + 0.08;
    xScale = (v) => m.l + ((Math.log10(Math.max(v, 1e-12)) - a) / (b - a)) * pw;
    xTicks = logTicks(Math.pow(10, a), Math.pow(10, b));
    if (narrow && xTicks.length > 5) xTicks = xTicks.filter((_, i) => i % 2 === 0);
  } else {
    const d = niceDomain(Math.min(0, cMin), cMax, narrow ? 3 : 5);
    xScale = (v) => m.l + ((v - d.lo) / (d.hi - d.lo)) * pw;
    xTicks = d.ticks;
  }
  const yd = niceDomain(Math.min(...ss), Math.max(...ss), 4);
  const yScale = (v: number) => m.t + ph - ((v - yd.lo) / (yd.hi - yd.lo)) * ph;

  const handleCopy = async () => {
    if (!svgRef.current) return;
    try {
      const r = await copySvgAsPng(svgRef.current, 'indexboard-scatter');
      toast.success(r === 'copied' ? t('chart.pngCopied') : t('chart.pngDownloaded'));
    } catch {
      toast.error(t('chart.pngFailed'));
    }
  };

  const frontierPts = pts.filter((p) => frontierIds.has(p.item.id)).sort((a, b) => a.c.value - b.c.value);
  const path = frontierPts.map((p, i) => `${i ? 'L' : 'M'}${xScale(p.c.value).toFixed(1)},${yScale(p.s.value).toFixed(1)}`).join(' ');

  const placed: { x: number; y: number; w: number }[] = [];
  const labelFor = (p: Pt) => {
    const px = xScale(p.c.value);
    const py = yScale(p.s.value);
    const name = truncate(p.item.name, narrow ? 12 : 18);
    const w = name.length * 6.6;
    const right = px + 8 + w < width - 2;
    const lx = right ? px + 8 : px - 8 - w;
    let ly = py - 7;
    for (let k = 0; k < 6; k += 1) {
      const hit = placed.some((q) => Math.abs(q.y - ly) < 13 && lx < q.x + q.w && q.x < lx + w);
      if (!hit) break;
      ly += k % 2 === 0 ? 15 * (k + 1) : -15 * (k + 1);
    }
    ly = Math.max(m.t + 10, Math.min(m.t + ph - 4, ly));
    placed.push({ x: lx, y: ly, w });
    return { lx, ly, name, anchor: 'start' as const };
  };

  const better = scoreMetric.direction === 'higher' ? 'chart.scatterNote' : 'chart.scatterNoteLower';

  return (
    <figure className="panel print-avoid flex min-w-0 flex-col p-4 sm:p-5">
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif-display text-lg font-semibold leading-snug">{title}</h3>
          <p className="text-[13px] text-muted-foreground">
            {metricLabel(costMetric)}
            {useLog ? ` · ${t('chart.log')}` : ''}
          </p>
        </div>
        {showCopy && pts.length > 1 && (
          <Button variant="ghost" size="sm" className="no-print h-9 shrink-0 text-muted-foreground" onClick={handleCopy}>
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {t('chart.copyPng')}
          </Button>
        )}
      </figcaption>
      <div ref={wrapRef} className="w-full min-w-0">
        {pts.length < 2 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('chart.scatterEmpty')}</p>
        ) : (
          <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={title}
            style={{ display: 'block', maxWidth: '100%' }}
          >
            <rect x={0} y={0} width={width} height={height} fill={pal.surface} />
            {yd.ticks.map((tk) => (
              <g key={`y${tk}`}>
                <line x1={m.l} x2={m.l + pw} y1={yScale(tk)} y2={yScale(tk)} stroke={pal.grid} />
                <text x={m.l - 8} y={yScale(tk) + 4} textAnchor="end" fontSize={11} fill={pal.muted} fontFamily={SANS}>
                  {formatTick(tk)}
                </text>
              </g>
            ))}
            {xTicks.map((tk) => (
              <g key={`x${tk}`}>
                <line x1={xScale(tk)} x2={xScale(tk)} y1={m.t} y2={m.t + ph} stroke={pal.grid} />
                <text x={xScale(tk)} y={m.t + ph + 16} textAnchor="middle" fontSize={11} fill={pal.muted} fontFamily={SANS}>
                  {formatTick(tk)}
                </text>
              </g>
            ))}
            <text x={m.l + pw / 2} y={height - 6} textAnchor="middle" fontSize={11.5} fill={pal.muted} fontFamily={SANS}>
              {metricLabel(costMetric)}
            </text>
            <text
              x={12}
              y={m.t + ph / 2}
              textAnchor="middle"
              fontSize={11.5}
              fill={pal.muted}
              fontFamily={SANS}
              transform={`rotate(-90 12 ${m.t + ph / 2})`}
            >
              {truncate(metricLabel(scoreMetric), 28)}
            </text>
            {frontierPts.length > 1 && (
              <g>
                <path d={path} fill="none" stroke={pal.accent} strokeWidth={1.5} strokeDasharray="5 4" />
                <text
                  x={xScale(frontierPts[0].c.value) + 6}
                  y={yScale(frontierPts[0].s.value) + (scoreMetric.direction === 'higher' ? 16 : -10)}
                  fontSize={11}
                  fontStyle="italic"
                  fill={pal.accent}
                  fontFamily={SANS}
                >
                  {t('chart.frontier')}
                </text>
              </g>
            )}
            {pts.map((p) => {
              const px = xScale(p.c.value);
              const py = yScale(p.s.value);
              const strong = highlight.has(p.item.id) || frontierIds.has(p.item.id);
              const col = strong ? pal.accent : pal.barMuted;
              const [slo, shi] = bounds(p.s);
              const [clo, chi] = bounds(p.c);
              const lab = labelFor(p);
              return (
                <g key={p.item.id}>
                  <title>{`${p.item.name}: ${formatValue(p.s.value)} / ${formatValue(p.c.value)}`}</title>
                  {hasInterval(p.s) && <line x1={px} x2={px} y1={yScale(slo)} y2={yScale(shi)} stroke={col} strokeWidth={1.25} opacity={0.7} />}
                  {hasInterval(p.c) && <line x1={xScale(clo)} x2={xScale(chi)} y1={py} y2={py} stroke={col} strokeWidth={1.25} opacity={0.7} />}
                  <circle cx={px} cy={py} r={5} fill={col} stroke={pal.surface} strokeWidth={1.5} />
                  <text x={lab.lx} y={lab.ly} fontSize={12} fontWeight={strong ? 600 : 400} fill={pal.text} fontFamily={SANS}>
                    {lab.name}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <p className="mt-3 border-t pt-3 text-[13px] leading-relaxed text-muted-foreground">
        {t(better, { score: scoreMetric.name, cost: costMetric.name })}
      </p>
    </figure>
  );
}
