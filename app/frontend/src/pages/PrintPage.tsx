import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BoardView from '@/components/board/BoardView';
import { downloadJson, shareUrl } from '@/lib/boardApi';
import { useI18n } from '@/lib/i18n';
import { BoardStateNotice, useBoard } from './BoardPage';

export default function PrintPage() {
  const { slug } = useParams();
  const { t } = useI18n();
  const { state, reload } = useBoard(slug);

  return (
    <div className="min-h-screen bg-white text-[#14202E]">
      <div className="no-print sticky top-0 z-30 border-b border-[#DCE2EA] bg-[#F6F8FB]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button asChild variant="ghost" className="h-10 text-[#14202E] hover:bg-[#EDF1F6]">
            <Link to={`/b/${slug}`}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              {t('pr.back')}
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            {state.kind === 'ready' && (
              <Button
                variant="outline"
                className="h-10 border-[#DCE2EA] !bg-transparent text-[#14202E] hover:!bg-[#EDF1F6]"
                onClick={() => downloadJson(state.board, slug)}
              >
                <Download className="mr-2 h-4 w-4" aria-hidden />
                {t('b.downloadJson')}
              </Button>
            )}
            <Button className="h-10 bg-[#1F4E8C] text-white hover:bg-[#1A4378]" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              {t('pr.print')}
            </Button>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-3 text-[13px] text-[#5B6878] sm:px-6">{t('pr.hint')}</p>
      </div>
      {state.kind !== 'ready' ? (
        <BoardStateNotice state={state} onRetry={reload} />
      ) : (
        <>
          <BoardView doc={state.board} print />
          <p className="mx-auto max-w-6xl px-4 py-8 text-[12.5px] text-[#5B6878] sm:px-6">
            {t('pr.source', { url: shareUrl(slug ?? '') })} · IndexBoard
          </p>
        </>
      )}
    </div>
  );
}
