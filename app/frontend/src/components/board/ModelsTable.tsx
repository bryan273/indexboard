import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { analyzeMetric, formatValue, hasInterval, type Item, type Metric } from '@/lib/board';
import { useI18n } from '@/lib/i18n';

interface Props {
  items: Item[];
  metrics: Metric[];
  primary: Metric | undefined;
  scrollable?: boolean;
}

type SortKey = { id: string; asc: boolean };

export default function ModelsTable({ items, metrics, primary, scrollable = true }: Props) {
  const { t } = useI18n();
  const first = primary ?? metrics[0];
  const [sort, setSort] = useState<SortKey>({ id: first?.id ?? 'name', asc: first?.direction === 'lower' });

  const status = useMemo(() => {
    const map = new Map<string, { tied: Set<string>; leader: string | null }>();
    metrics.forEach((m) => {
      const a = analyzeMetric(m, items);
      map.set(m.id, {
        tied: new Set(a.rows.filter((r) => r.tied).map((r) => r.item.id)),
        leader: a.rows[0]?.item.id ?? null,
      });
    });
    return map;
  }, [items, metrics]);

  const sorted = useMemo(() => {
    const rows = [...items];
    if (sort.id === 'name') {
      rows.sort((a, b) => a.name.localeCompare(b.name) * (sort.asc ? 1 : -1));
      return rows;
    }
    rows.sort((a, b) => {
      const av = a.scores[sort.id]?.value;
      const bv = b.scores[sort.id]?.value;
      const am = av == null || !Number.isFinite(av);
      const bm = bv == null || !Number.isFinite(bv);
      if (am || bm) return am === bm ? 0 : am ? 1 : -1;
      return ((av as number) - (bv as number)) * (sort.asc ? 1 : -1);
    });
    return rows;
  }, [items, sort]);

  const sortMetric = metrics.find((m) => m.id === sort.id);

  const toggle = (id: string) => {
    setSort((prev) => {
      if (prev.id === id) return { id, asc: !prev.asc };
      const m = metrics.find((x) => x.id === id);
      return { id, asc: id === 'name' ? true : m?.direction === 'lower' };
    });
  };

  const header = (id: string, label: string, align: 'left' | 'right') => {
    const active = sort.id === id;
    const Icon = !active ? ArrowUpDown : sort.asc ? ArrowUp : ArrowDown;
    return (
      <th
        key={id}
        scope="col"
        aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : 'none'}
        className={`sticky top-0 z-10 border-b bg-muted px-3 py-0 font-medium ${align === 'right' ? 'text-right' : 'text-left'} ${
          id === 'name' ? 'left-0 z-20' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => toggle(id)}
          aria-label={t('m.sortBy', { name: label })}
          className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap ${align === 'right' ? 'flex-row-reverse' : ''} ${
            active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>{label}</span>
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="panel overflow-hidden">
      <div className={`overflow-auto ${scrollable ? 'max-h-[70vh]' : ''}`}>
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 z-10 w-12 border-b bg-muted px-3 text-left font-medium text-muted-foreground">
                {t('m.rank')}
              </th>
              {header('name', t('m.item'), 'left')}
              {metrics.map((m) => header(m.id, m.unit ? `${m.name} (${m.unit})` : m.name, 'right'))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, idx) => (
              <tr key={item.id} className="group">
                <td className="tabular border-b px-3 py-3 text-muted-foreground">{sortMetric ? idx + 1 : '—'}</td>
                <th scope="row" className="sticky left-0 z-[5] border-b bg-card px-3 py-3 text-left font-medium">
                  <span className="block max-w-[150px] truncate sm:max-w-[240px]" title={item.name}>
                    {item.name}
                  </span>
                </th>
                {metrics.map((m) => {
                  const s = item.scores[m.id];
                  const st = status.get(m.id);
                  const tied = st?.tied.has(item.id);
                  const leader = st?.leader === item.id;
                  return (
                    <td key={m.id} className="border-b px-3 py-3 text-right align-top">
                      {s && Number.isFinite(s.value) ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="inline-flex items-center gap-1.5">
                            {tied && (
                              <span className="rounded-full border border-[hsl(var(--warn-border))] bg-[hsl(var(--warn-bg))] px-1.5 py-px text-[11px] font-medium text-[hsl(var(--warn-fg))]">
                                {t('chart.tied')}
                              </span>
                            )}
                            <span className={`tabular whitespace-nowrap ${leader ? 'font-semibold text-primary' : ''}`}>
                              {formatValue(s.value)}
                            </span>
                          </span>
                          {hasInterval(s) && (
                            <span className="tabular whitespace-nowrap text-[12px] text-muted-foreground">
                              [{formatValue(s.low)}, {formatValue(s.high)}]
                            </span>
                          )}
                          {s.runs ? <span className="text-[11px] text-muted-foreground">{t('m.runs', { n: s.runs })}</span> : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        {t('m.note', { metric: sortMetric?.name ?? t('m.item') })}
      </p>
    </div>
  );
}
