import { FeatureBento, GradLast, type Feature } from '@/components/SuiteUI';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import BoardCard from '@/components/board/BoardCard';
import { getBoard, listRecentBoards, summarize, type BoardSummary } from '@/lib/boardApi';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppShell from '@/components/board/AppShell';
import BarChart from '@/components/board/BarChart';
import { StatusBanner } from '@/components/board/BoardView';
import { analyzeMetric, exampleDoc } from '@/lib/board';
import { useI18n } from '@/lib/i18n';
import { SuiteFaq, SuiteCta } from '@/components/SuiteFooter';

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


const FAQ = {
  en: [
    { q: 'What is a statistical tie?', a: 'When the 95% intervals of two models overlap, the data cannot say which one is better. IndexBoard says so at the top of the board instead of printing a fake first place.' },
    { q: 'What data can I paste?', a: 'JSON or CSV, or fill a table by hand. Each row is a model and each column is a metric, with an interval or enough runs to compute one.' },
    { q: 'Do I need an account?', a: 'No. Each board gets a read-only public link and a private edit key. Keep the key to change the board later.' },
    { q: 'What is the score against cost chart?', a: 'A scatter plot with a dashed frontier through the models that nobody beats on both score and cost.' },
    { q: 'Who is responsible for the numbers?', a: 'The author of each board. IndexBoard is a free template: it draws and explains the results, it does not verify them.' },
  ],
  zh: [
    { q: '什么是统计意义上的并列？', a: '当两个模型的 95% 区间重叠时，数据无法说明谁更好。IndexBoard 会在榜单顶部直接说明，而不是给出虚假的第一名。' },
    { q: '可以粘贴什么数据？', a: 'JSON 或 CSV，也可以手动填表。每行是一个模型，每列是一个指标，需带区间或足够的多次运行结果以便计算区间。' },
    { q: '需要账号吗？', a: '不需要。每个榜单有只读公开链接和私有编辑密钥，保留密钥即可日后修改。' },
    { q: '“得分对成本”图是什么？', a: '一张散点图，虚线前沿穿过在得分和成本上都无人能超越的模型。' },
    { q: '数字由谁负责？', a: '由每个榜单的作者负责。IndexBoard 是免费模板：它负责绘制和解释结果，不负责核实结果。' },
  ],
};

const BOARD_POINTS: Record<'en' | 'zh', Feature[]> = {
  en: [
    { t: 'Ties are shown', p: 'When two scores overlap within their intervals, the board says so instead of forcing an order.', d: 'M4 8h16M4 16h16M8 4v16M16 4v16' },
    { t: 'Intervals on every score', p: 'Each score can carry a 95% range and a run count, so a small gap is not mistaken for a win.', d: 'M5 12h14M5 8v8M19 8v8M12 9v6' },
    { t: 'The method is written down', p: 'Formula, a worked example and what was held fixed sit next to the numbers.', d: 'M7 4h10a2 2 0 012 2v14l-4-3H7a2 2 0 01-2-2V6a2 2 0 012-2zM9 9h6M9 13h4' },
    { t: 'Share a link, edit with a key', p: 'Publishing gives a read-only link and a private edit key. Describe it in words to start from a draft.', d: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0010 18.7l1-1' },
  ],
  zh: [
    { t: '平局会显示', p: '两个分数的区间重叠时，榜单会如实标明，而不是硬排出名次。', d: 'M4 8h16M4 16h16M8 4v16M16 4v16' },
    { t: '每个分数都有区间', p: '每个分数可附带 95% 区间和运行次数，避免把微小差距当成胜负。', d: 'M5 12h14M5 8v8M19 8v8M12 9v6' },
    { t: '方法写在旁边', p: '计分公式、一个演算示例和固定条件都与数字放在一起。', d: 'M7 4h10a2 2 0 012 2v14l-4-3H7a2 2 0 01-2-2V6a2 2 0 012-2zM9 9h6M9 13h4' },
    { t: '分享链接，凭密钥编辑', p: '发布后得到只读链接和私有编辑密钥。也可以用文字描述，从草稿开始。', d: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0010 18.7l1-1' },
  ],
};

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
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid gap-10 pb-14 pt-12 sm:pt-16 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="min-w-0 lg:col-span-7">
            <span className="su-pill"><i />{t('home.eyebrow')}</span>
            <h1 className="font-display mt-4 text-[38px] font-semibold leading-[1.08] sm:text-[52px]"><GradLast text={t('home.title')} words={3} /></h1>
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

        <section id="featured" className="scroll-mt-20 border-t py-12" aria-labelledby="featured-title">
          <h2 id="featured-title" className="font-display text-[28px] font-semibold leading-tight">
            {t('home.featured.t')}
          </h2>
          <p className="mt-1 text-[15px] text-muted-foreground">{t('home.featured.d')}</p>
          <div className="mt-6 grid gap-5">
            {featured ? featured.map((s) => <BoardCard key={s.slug} summary={s} featured />) : <CardSkeleton />}
          </div>
        </section>

        <section id="recent" className="scroll-mt-20 pb-12" aria-labelledby="recent-title">
          <h2 id="recent-title" className="font-display text-[28px] font-semibold leading-tight">
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
              <p className="font-display tabular text-sm text-primary">0{i + 1}</p>
              <h2 className="font-display mt-2 text-xl font-semibold">{t(`home.${f}.t`)}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t(`home.${f}.d`)}</p>
            </div>
          ))}
        </section>

        <section className="panel flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">{t('home.open.t')}</h2>
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

        <FeatureBento
          id="why"
          eyebrow={lang === 'zh' ? '为什么用它' : 'Why IndexBoard'}
          title={lang === 'zh' ? '排名要诚实，平局也要显示。' : 'Honest rankings show the ties.'}
          lead={lang === 'zh' ? '每个榜单都写明评分方法，并带置信区间。' : 'Every board states how it scores and carries confidence intervals.'}
          items={BOARD_POINTS[lang]}
        />

        <SuiteFaq lang={lang} id="faq" items={FAQ[lang]} />
        <SuiteCta
          title={lang === 'zh' ? '准备好发布你的评测结果了吗？' : 'Ready to publish your results?'}
          body={lang === 'zh' ? '粘贴数据，几秒钟内得到一个诚实的榜单。' : 'Paste your data and get an honest board in seconds.'}
          label={lang === 'zh' ? '创建榜单' : 'Create a board'}
          to="/new"
        />
      </div>
    </AppShell>
  );
}
