import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Link2, Pencil, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SiteHeader, { SiteFooter } from '@/components/board/SiteHeader';
import BoardView from '@/components/board/BoardView';
import { downloadJson, errorMessage, errorStatus, getBoard, shareUrl, type StoredBoard } from '@/lib/boardApi';
import { useI18n } from '@/lib/i18n';

type LoadState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready'; board: StoredBoard };

export function useBoard(slug: string | undefined) {
  const { t } = useI18n();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const load = useCallback(async () => {
    if (!slug) return setState({ kind: 'missing' });
    setState({ kind: 'loading' });
    try {
      setState({ kind: 'ready', board: await getBoard(slug) });
    } catch (e) {
      if (errorStatus(e) === 404) setState({ kind: 'missing' });
      else setState({ kind: 'error', message: errorMessage(e, t('b.loadError')) });
    }
  }, [slug, t]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  return { state, reload: load };
}

export function BoardStateNotice({ state, onRetry }: { state: LoadState; onRetry: () => void }) {
  const { t } = useI18n();
  if (state.kind === 'loading')
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6" aria-busy="true">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-10 w-3/4 animate-pulse rounded bg-muted" />
        <p className="mt-6 text-sm text-muted-foreground">{t('b.loading')}</p>
      </div>
    );
  if (state.kind === 'missing' || state.kind === 'error')
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-serif-display text-3xl font-semibold">{state.kind === 'missing' ? t('b.notFound') : t('b.loadError')}</h1>
        <p className="mt-3 text-muted-foreground">{state.kind === 'missing' ? t('b.notFoundDesc') : state.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          {state.kind === 'error' && (
            <Button onClick={onRetry} className="h-11">
              {t('b.retry')}
            </Button>
          )}
          <Button asChild variant="outline" className="h-11 !bg-transparent hover:!bg-muted">
            <Link to="/">{t('nav.home')}</Link>
          </Button>
        </div>
      </div>
    );
  return null;
}

export default function BoardPage() {
  const { slug } = useParams();
  const { t, lang } = useI18n();
  const { state, reload } = useBoard(slug);

  const copyLink = async () => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(shareUrl(slug));
      toast.success(t('b.linkCopied'));
    } catch {
      toast.error(t('b.copyFailed'));
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {state.kind !== 'ready' ? (
          <BoardStateNotice state={state} onRetry={reload} />
        ) : (
          <BoardView
            doc={state.board}
            meta={
              <>
                <span className="rounded-full border px-2.5 py-0.5">{t('b.readOnly')}</span>
                {state.board.updated_at && (
                  <span>
                    {t('b.updated', {
                      date: new Date(state.board.updated_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }),
                    })}
                  </span>
                )}
              </>
            }
            actions={
              <>
                <Button variant="outline" className="h-10 !bg-transparent hover:!bg-muted" onClick={copyLink}>
                  <Link2 className="mr-2 h-4 w-4" aria-hidden />
                  {t('b.copyLink')}
                </Button>
                <Button asChild variant="outline" className="h-10 !bg-transparent hover:!bg-muted">
                  <Link to={`/b/${slug}/print`}>
                    <Printer className="mr-2 h-4 w-4" aria-hidden />
                    {t('b.print')}
                  </Link>
                </Button>
                <Button variant="outline" className="h-10 !bg-transparent hover:!bg-muted" onClick={() => downloadJson(state.board, slug)}>
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                  {t('b.downloadJson')}
                </Button>
                <Button asChild variant="ghost" className="h-10">
                  <Link to={`/b/${slug}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" aria-hidden />
                    {t('b.edit')}
                  </Link>
                </Button>
              </>
            }
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
