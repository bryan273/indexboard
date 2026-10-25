import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import BoardCard from '@/components/board/BoardCard';
import { getBoard, listRecentBoards, summarize, type BoardSummary } from '@/lib/boardApi';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SiteHeader, { SiteFooter } from '@/components/board/SiteHeader';
import BarChart from '@/components/board/BarChart';
import { StatusBanner } from '@/components/board/BoardView';
import { analyzeMetric, exampleDoc } from '@/lib/board';
import { useI18n } from '@/lib/i18n';

const FEATURES = ['f1', 'f2', 'f3', 'f4'] as const;

const FEATURED: { slug: string; title: string }[] = [{ slug: '5dhum9j5h0', title: 'Paper Repro Index' }];

const fallbackSummary = (f: { slug: string; title: string }): BoardSummary => ({
  slug: f.slug,
  title: f.title,
  description: '',
  item_count: 0,
  metric_count: 0,
  primary_metric: null,
  top: [],
  created_at: null,
});

type RecentState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; items: BoardSummary[] };

function CardSkeleton() {
  return (
    <div className="panel flex flex-col gap-3 p-5 sm:p-6" aria-hidden>
      <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
      <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-20 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

export default function Index() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [featured, setFeatured] = useState<BoardSummary[] | null>(null);
  const [recent, setRecent] = useState<RecentState>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    Promise.all(
      FEATURED.map(async (f) => {
        try {
          return summarize(f.slug, await getBoard(f.slug));
        } catch {
          return fallbackSummary(f);
        }
      }),
    ).then((list) => alive && setFeatured(list));
    return () => {
      alive = false;
    };
  }, []);

  const loadRecent = useCallback(async () => {
    setRecent({ kind: 'loading' });
    try {
      const pinned = new Set(FEATURED.map((f) => f.slug));
      const items = await listRecentBoards(9 + pinned.size);
      setRecent({ kind: 'ready', items: items.filter((b) => !pinned.has(b.slug)).slice(0, 9) });
    } catch {
      setRecent({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);
  const example = useMemo(() => exampleDoc(lang), [lang]);
  const analysis = useMemo(() => analyzeMetric(example.payload.metrics[0], example.payload.items), [example]);

  const open = (e: FormEvent) => {
    e.preventDefault();
    const raw = code.trim();
    if (!raw) return;
    const m = raw.match(/\/b\/([a-z0-9]+)/i);
    const slug = (m ? m[1] : raw).replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (slug) navigate(`/b/${slug}`);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid gap-10 pb-14 pt-12 sm:pt-16 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="min-w-0 lg:col-span-7">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-primary">{t('home.eyebrow')}</p>
            <h1 className="font-serif-display mt-4 text-[38px] font-semibold leading-[1.08] sm:text-[52px]">{t('home.title')}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">{t('home.lead')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11">
                <Link to="/new">
                  {t('home.create')}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 !bg-transparent hover:!bg-muted">
                <Link to="/new?example=1">{t('home.example')}</Link>
              </Button>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
            <StatusBanner analysis={analysis} />
            <BarChart analysis={analysis} compact showCopy={false} />
            <p className="text-[12.5px] text-muted-foreground">{t('home.previewCaption')}</p>
          </div>
        </section>

        <section className="border-t py-12" aria-labelledby="featured-title">
          <h2 id="featured-title" className="font-serif-display text-[28px] font-semibold leading-tight">
            {t('home.featured.t')}
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">{t('home.featured.d')}</p>
          <div className="mt-6 grid gap-5">
            {featured ? featured.map((s) => <BoardCard key={s.slug} summary={s} featured />) : <CardSkeleton />}
          </div>
        </section>

        <section className="pb-12" aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-serif-display text-[28px] font-semibold leading-tight">
            {t('home.recent.t')}
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">{t('home.recent.d')}</p>
          <div className="mt-6">
            {recent.kind === 'loading' && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            )}
            {recent.kind === 'error' && (
              <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
                <p className="text-sm text-muted-foreground">{t('home.recent.error')}</p>
                <Button variant="outline" className="h-10 !bg-transparent hover:!bg-muted" onClick={loadRecent}>
                  {t('b.retry')}
                </Button>
              </div>
            )}
            {recent.kind === 'ready' &&
              (recent.items.length ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {recent.items.map((s) => (
                    <BoardCard key={s.slug} summary={s} />
                  ))}
                </div>
              ) : (
                <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
                  <p className="text-sm text-muted-foreground">{t('home.recent.empty')}</p>
                  <Button asChild className="h-10">
                    <Link to="/new">{t('home.create')}</Link>
                  </Button>
                </div>
              ))}
          </div>
        </section>

        <section className="grid gap-x-8 gap-y-8 border-t py-12 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div key={f} className="min-w-0">
              <p className="font-serif-display tabular text-sm text-primary">0{i + 1}</p>
              <h2 className="font-serif-display mt-2 text-xl font-semibold">{t(`home.${f}.t`)}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t(`home.${f}.d`)}</p>
            </div>
          ))}
        </section>

        <section className="panel flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif-display text-xl font-semibold">{t('home.open.t')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('home.open.d')}</p>
          </div>
          <form onSubmit={open} className="flex w-full gap-2 md:max-w-md">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('home.open.placeholder')}
              aria-label={t('home.open.t')}
              className="h-11"
            />
            <Button type="submit" className="h-11 shrink-0">
              {t('home.open.go')}
            </Button>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
