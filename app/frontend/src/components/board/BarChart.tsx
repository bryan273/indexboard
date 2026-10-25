import { useRef } from 'react';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bounds, formatTick, formatValue, hasInterval, metricLabel, niceDomain, type MetricAnalysis } from '@/lib/board';
import { joinNames, useI18n } from '@/lib/i18n';
import { SANS, copySvgAsPng, truncate, useElementWidth, usePalette } from './chartKit';

interface Props {
  analysis: MetricAnalysis;
  forceLight?: boolean;
  compact?: boolean;
  showCopy?: boolean;
}

const ROW = 30;
const TOP = 8;
const AXIS = 26;

export default function BarChart({ analysis, forceLight = false, compact = false, showCopy = true }: Props) {
  const { t, lang } = useI18n();
  const pal = usePalette(forceLight);
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const { metric, rows, missing, status, tiedNames } = analysis;

  const labelW = Math.round(Math.min(170, Math.max(92, width * 0.3)));
  const valueW = width < 420 ? 50 : 64;
  const plotX = labelW + 8;
  const plotW = Math.max(60, width - plotX - valueW - 6);
  const height = TOP + rows.length * ROW + AXIS;

  let lo = 0;
  let hi = 0;
  rows.forEach((r) => {
    const [a, b] = bounds(r.score);
    lo = Math.min(lo, a, r.score.value);
    hi = Math.max(hi, b, r.score.value);
  });
  const dom = niceDomain(lo, hi, width < 420 ? 3 : 5);
  const x = (v: number) => plotX + ((v - dom.lo) / (dom.hi - dom.lo)) * plotW;
  const charW = width < 420 ? 6.4 : 7;

  const handleCopy = async () => {
    if (!svgRef.current) return;
    try {
      const r = await copySvgAsPng(svgRef.current, `indexboard-${metric.name}`);
      toast.success(r === 'copied' ? t('chart.pngCopied') : t('chart.pngDownloaded'));
    } catch {
      toast.error(t('chart.pngFailed'));
    }
  };

  const note =
    status === 'tie'
      ? t('note.tie', { names: joinNames(tiedNames, lang) })
      : status === 'lead'
        ? t('note.lead')
        : status === 'no_intervals'
          ? t('note.none')
          : '';

  return (
    <figure className="panel print-avoid flex min-w-0 flex-col p-4 sm:p-5">
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif-display text-lg font-semibold leading-snug">{metricLabel(metric)}</h3>
          <p className="text-[13px] text-muted-foreground">
            {metric.direction === 'higher' ? t('chart.higher') : t('chart.lower')}
            {metric.source ? ` · ${t('live.source', { source: metric.source })}` : ''}
          </p>
        </div>
        {showCopy && (
          <Button variant="ghost" size="sm" className="no-print h-9 shrink-0 text-muted-foreground" onClick={handleCopy}>
            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {t('chart.copyPng')}
          </Button>
        )}
      </figcaption>
      <div ref={wrapRef} className="w-full min-w-0">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={metricLabel(metric)}
          style={{ display: 'block', maxWidth: '100%' }}
        >
          <rect x={0} y={0} width={width} height={height} fill={pal.surface} />
          {dom.ticks.map((tk) => (
            <g key={tk}>
              <line x1={x(tk)} x2={x(tk)} y1={TOP - 4} y2={TOP + rows.length * ROW} stroke={pal.grid} strokeWidth={1} />
              <text x={x(tk)} y={height - 8} textAnchor="middle" fontSize={11} fill={pal.muted} fontFamily={SANS}>
                {formatTick(tk)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = TOP + i * ROW;
            const cy = y + ROW / 2;
            const strong = r.leader || r.tied;
            const fill = strong ? pal.accent : pal.barMuted;
            const x0 = x(Math.max(dom.lo, 0));
            const xv = x(r.score.value);
            const [blo, bhi] = bounds(r.score);
            const maxChars = Math.floor((labelW - 4) / charW);
            const interval = hasInterval(r.score) ? ` [${formatValue(r.score.low)}, ${formatValue(r.score.high)}]` : '';
            return (
              <g key={r.item.id}>
                <title>{`${r.item.name}: ${formatValue(r.score.value)}${interval}${r.score.runs ? `, n=${r.score.runs}` : ''}`}</title>
                <text
                  x={labelW}
                  y={cy + 4}
                  textAnchor="end"
                  fontSize={compact ? 12 : 13}
                  fontWeight={strong ? 600 : 400}
                  fill={pal.text}
                  fontFamily={SANS}
                >
                  {truncate(r.item.name, maxChars)}
                </text>
                <rect x={Math.min(x0, xv)} y={cy - 7} width={Math.max(1, Math.abs(xv - x0))} height={14} rx={2} fill={fill} />
                {hasInterval(r.score) && (
                  <g stroke={pal.text} strokeWidth={1.5} opacity={0.85}>
                    <line x1={x(blo)} x2={x(bhi)} y1={cy} y2={cy} />
                    <line x1={x(blo)} x2={x(blo)} y1={cy - 4} y2={cy + 4} />
                    <line x1={x(bhi)} x2={x(bhi)} y1={cy - 4} y2={cy + 4} />
                  </g>
                )}
                <text
                  x={width - 2}
                  y={cy + 4}
                  textAnchor="end"
                  fontSize={12.5}
                  fontWeight={strong ? 600 : 400}
                  fill={pal.text}
                  fontFamily={SANS}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatValue(r.score.value)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {!compact && (note || missing.length > 0) && (
        <p className="mt-3 border-t pt-3 text-[13px] leading-relaxed text-muted-foreground">
          {note}
          {missing.length > 0 && ` ${t('note.missing', { names: joinNames(missing.map((m) => m.name), lang) })}`}
        </p>
      )}
    </figure>
  );
}
