import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatValue } from '@/lib/board';
import type { BoardSummary } from '@/lib/boardApi';
import { useI18n } from '@/lib/i18n';

interface Props {
  summary: BoardSummary;
  featured?: boolean;
}

export default function BoardCard({ summary, featured = false }: Props) {
  const { t } = useI18n();
  const href = `/b/${summary.slug}`;
  const metric = summary.primary_metric;
  return (
    <article className={`panel flex h-full min-w-0 flex-col p-5 sm:p-6 ${featured ? 'lg:flex-row lg:gap-10' : ''}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        {featured && (
          <span className="mb-3 w-fit rounded-full bg-accent px-2.5 py-0.5 text-[12px] font-medium text-accent-foreground">
            {t('home.featuredBadge')}
          </span>
        )}
        <h3 className={`font-display line-clamp-2 break-words font-semibold leading-snug ${featured ? 'text-2xl' : 'text-xl'}`}>
          <Link to={href} className="hover:text-primary">
            {summary.title}
          </Link>
        </h3>
        {summary.description && (
          <p className="mt-2 line-clamp-3 break-words text-[14px] leading-relaxed text-muted-foreground">{summary.description}</p>
        )}
        {summary.item_count > 0 && (
          <p className="tabular mt-3 text-[13px] text-muted-foreground">
            {t('card.counts', { items: summary.item_count, metrics: summary.metric_count })}
          </p>
        )}
      </div>
      <div className={`mt-4 flex min-w-0 flex-1 flex-col ${featured ? 'lg:mt-0 lg:max-w-[360px]' : ''}`}>
        {summary.top.length > 0 && metric && (
          <div className="rounded-md border bg-muted/40 px-3 py-2.5">
            <p className="truncate text-[12.5px] text-muted-foreground">{t('card.top', { metric: metric.name })}</p>
            <ol className="mt-1.5 flex flex-col gap-1">
              {summary.top.map((row, i) => (
                <li key={`${row.name}-${i}`} className="flex items-baseline gap-2 text-[14px]">
                  <span className="tabular w-4 shrink-0 text-muted-foreground">{i + 1}</span>
                  <span className={`min-w-0 flex-1 truncate ${i === 0 ? 'font-semibold' : ''}`} title={row.name}>
                    {row.name}
                  </span>
                  <span className="tabular shrink-0 whitespace-nowrap">
                    {formatValue(row.value)}
                    {metric.unit && <span className="text-muted-foreground"> {metric.unit}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <Button asChild className="mt-auto h-10 w-fit self-start" variant={featured ? 'default' : 'outline'}>
          <Link to={href} className={featured ? 'mt-4' : 'mt-4 !bg-transparent hover:!bg-muted'}>
            {t('card.open')}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}
