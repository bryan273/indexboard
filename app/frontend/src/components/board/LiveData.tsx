import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LiveSource, LiveSpec } from '@/lib/board';
import { liveMetricName } from '@/lib/liveData';
import { joinNames, useI18n } from '@/lib/i18n';

const LINKS: Record<LiveSource, { label: string; url: string }> = {
  artificial_analysis: { label: 'Artificial Analysis', url: 'https://artificialanalysis.ai/' },
  openrouter: { label: 'OpenRouter', url: 'https://openrouter.ai/' },
};

export function SourceAttribution({ source, showUrl = false }: { source: LiveSource; showUrl?: boolean }) {
  const { t } = useI18n();
  const link = LINKS[source];
  return (
    <span>
      {source === 'artificial_analysis' ? t('live.attrData') : t('live.attrPrices')}{' '}
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
        {link.label}
      </a>
      {showUrl && <span className="break-all"> ({link.url})</span>}
    </span>
  );
}

export function useFetchedLabel(iso: string): string {
  const { lang } = useI18n();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  const { t } = useI18n();
  return (
    <Button variant="outline" size="sm" className="no-print h-10 shrink-0 !bg-transparent hover:!bg-muted" onClick={onClick} disabled={busy}>
      <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />
      {busy ? t('live.refreshing') : t('live.refresh')}
    </Button>
  );
}

/** Attribution footer for boards built from real model data. */
export function LiveFooter({ live, action }: { live: LiveSpec; action?: React.ReactNode }) {
  const { t, lang } = useI18n();
  const fetched = useFetchedLabel(live.fetched_at);
  const missing = live.unavailable.map((k) => liveMetricName(k, live.lang));
  return (
    <footer className="print-avoid mt-10 flex flex-col gap-3 border-t pt-5 text-[13px] leading-relaxed text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p>
          <SourceAttribution source={live.source} showUrl /> · {t('live.fetched', { time: fetched })}
        </p>
        {missing.length > 0 && <p className="mt-1">{t('live.unavailable', { source: live.source_label, list: joinNames(missing, lang) })}</p>}
        {live.stale && <p className="mt-1">{t('live.stale')}</p>}
      </div>
      {action}
    </footer>
  );
}

/** Editor note shown after a board was filled with real model data. */
export function LiveEditorNote({ live, onRefresh, busy }: { live: LiveSpec; onRefresh: () => void; busy: boolean }) {
  const { t, lang } = useI18n();
  const fetched = useFetchedLabel(live.fetched_at);
  const missing = live.unavailable.map((k) => liveMetricName(k, live.lang));
  return (
    <div role="note" className="rounded-2xl border border-primary/25 bg-accent px-5 py-4 text-accent-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[17px] font-semibold">{t('live.noteTitle', { source: live.source_label })}</p>
          <p className="mt-1 text-sm opacity-90">{t('live.noteDesc')}</p>
        </div>
        <RefreshButton onClick={onRefresh} busy={busy} />
      </div>
      <dl className="mt-3 grid gap-1.5 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium">{t('live.matched')}:</dt>
          <dd className="min-w-0 break-words">
            {live.models.map((m) => (m.query && m.query !== m.name ? `${m.query} → ${m.name}` : m.name)).join(' · ')}
          </dd>
        </div>
        {live.unmatched.length > 0 && <p className="break-words">{t('live.notFound', { names: joinNames(live.unmatched, lang) })}</p>}
        {missing.length > 0 && <p>{t('live.unavailable', { source: live.source_label, list: joinNames(missing, lang) })}</p>}
        {live.stale && <p>{t('live.stale')}</p>}
        <p className="opacity-90">
          <SourceAttribution source={live.source} /> · {t('live.fetched', { time: fetched })}
        </p>
      </dl>
    </div>
  );
}
