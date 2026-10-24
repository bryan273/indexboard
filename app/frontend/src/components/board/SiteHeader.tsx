import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n, type Lang } from '@/lib/i18n';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'zh', label: '中文' },
];

export default function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  return (
    <header className="no-print sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2" aria-label={t('nav.home')}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0 text-primary">
            <rect x="2" y="4" width="14" height="3" rx="1" fill="currentColor" />
            <rect x="2" y="9.5" width="18" height="3" rx="1" fill="currentColor" opacity="0.75" />
            <rect x="2" y="15" width="10" height="3" rx="1" fill="currentColor" opacity="0.5" />
          </svg>
          <span className="font-serif-display text-lg font-semibold">IndexBoard</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="h-10 px-2.5 sm:px-3">
            <Link to="/new">
              <Plus className="h-4 w-4 sm:mr-1.5" aria-hidden />
              <span className="hidden sm:inline">{t('nav.new')}</span>
              <span className="sr-only sm:hidden">{t('nav.new')}</span>
            </Link>
          </Button>
          <div role="group" aria-label={t('lang.label')} className="flex rounded-md border p-0.5">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={lang === l.id}
                onClick={() => setLang(l.id)}
                className={`h-9 min-w-[44px] rounded-[5px] px-2.5 text-[13px] font-medium transition-colors duration-150 ${
                  lang === l.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="no-print mt-16 border-t">
      <div className="mx-auto max-w-6xl px-4 py-8 text-[13px] text-muted-foreground sm:px-6">{t('footer')}</div>
    </footer>
  );
}
