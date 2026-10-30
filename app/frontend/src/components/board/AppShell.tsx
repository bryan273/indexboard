import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import SuiteTopBar from '@/components/SuiteTopBar';
import { SuiteFooter } from '@/components/SuiteFooter';
import { useI18n, type MsgKey } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

interface AppLink {
  to: string;
  key: MsgKey;
  active: (path: string, tab: string | null, hash: string) => boolean;
}

const APP_LINKS: AppLink[] = [
  { to: '/', key: 'nav.home', active: (p, _t, h) => p === '/' && !h },
  { to: '/#featured', key: 'nav.featured', active: (p, _t, h) => p === '/' && h === '#featured' },
  { to: '/#recent', key: 'nav.recent', active: (p, _t, h) => p === '/' && h === '#recent' },
  { to: '/new', key: 'nav.new', active: (p, t) => p === '/new' && (!t || t === 'editor') },
  { to: '/new?tab=describe', key: 'nav.describe', active: (p, t) => p === '/new' && t === 'describe' },
  { to: '/new?tab=templates', key: 'nav.templates', active: (p, t) => p === '/new' && t === 'templates' },
];

function useHashScroll() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 });
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    let timer = 0;
    const tick = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (tries++ < 30) timer = window.setTimeout(tick, 100);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [pathname, search, hash]);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const { pathname, search, hash } = useLocation();
  useHashScroll();
  const tab = new URLSearchParams(search).get('tab');

  const nav = APP_LINKS.filter((l) => l.to !== '/#recent').map((l) => ({ label: t(l.key), to: l.to, active: l.active(pathname, tab, hash) }));

  return (
    <div className="min-h-screen">
      <div className="no-print">
        <SuiteTopBar appId="indexboard" brand="IndexBoard" letter="I" homeTo="/" nav={nav} dark={theme === 'dark'} onToggleDark={toggle} lang={lang} onLang={setLang} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">{children}</main>
        <div className="no-print">
          <SuiteFooter lang={lang} appId="indexboard" note={t('footer')} />
        </div>
      </div>
    </div>
  );
}
