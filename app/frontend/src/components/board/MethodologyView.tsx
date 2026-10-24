import Markdown from 'markdown-to-jsx';
import type { Metric, Methodology } from '@/lib/board';
import { useI18n } from '@/lib/i18n';

interface Props {
  methodology: Methodology | undefined;
  metrics: Metric[];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel print-avoid p-5 sm:p-6">
      <h3 className="font-serif-display mb-3 text-xl font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Md({ text }: { text: string }) {
  const { t } = useI18n();
  if (!text.trim()) return <p className="text-sm text-muted-foreground">{t('meth.empty')}</p>;
  return (
    <div className="prose-board break-words">
      <Markdown options={{ disableParsingRawHTML: true, forceBlock: true }}>{text}</Markdown>
    </div>
  );
}

export default function MethodologyView({ methodology, metrics }: Props) {
  const { t } = useI18n();
  const fixed = methodology?.held_fixed ?? [];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Section title={t('meth.formula')}>
          <Md text={methodology?.formula ?? ''} />
        </Section>
        <Section title={t('meth.worked')}>
          <Md text={methodology?.worked_example ?? ''} />
        </Section>
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <Section title={t('meth.fixed')}>
          {fixed.length ? (
            <ul className="flex flex-col divide-y text-[15px]">
              {fixed.map((f, i) => (
                <li key={i} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span className="min-w-0 break-words">{f}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('meth.empty')}</p>
          )}
        </Section>
        <Section title={t('meth.metrics')}>
          <dl className="flex flex-col gap-2 text-sm">
            {metrics.map((m) => (
              <div key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <dt className="font-medium">
                  {m.name}
                  {m.unit && <span className="text-muted-foreground"> ({m.unit})</span>}
                </dt>
                <dd className="text-muted-foreground">{m.direction === 'higher' ? t('chart.higher') : t('chart.lower')}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section title={t('meth.interval')}>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{t('meth.intervalText')}</p>
        </Section>
      </div>
    </div>
  );
}
