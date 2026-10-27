import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n, type Lang, type MsgKey } from '@/lib/i18n';
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

const SUITE_LINKS: { href: string; key: MsgKey }[] = [
  { href: 'https://paperexplainer-aiid.pub.atoms.world', key: 'nav.explainer' },
  { href: 'https://paperrepro-aiid.atoms.world/repro/index.html', key: 'nav.reproAgent' },
  { href: 'https://paperrepro-aiid.atoms.world/repro/bench.html', key: 'nav.bench' },
  { href: 'https://reprosuite-aiid.atoms.world', key: 'nav.allApps' },
];

const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'zh', label: '中文' },
];

const itemBase = 'flex min-h-[40px] items-center gap-2 rounded-full px-3 text-[14px] font-medium transition-colors duration-150';

function Logo() {
  const { t } = useI18n();
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#111113] text-[17px] font-extrabold text-white dark:ring-1 dark:ring-white/15"
      >
        I
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[15px] font-extrabold tracking-[-0.02em]">IndexBoard</span>
        <span className="block truncate text-[12px] text-muted-foreground">{t('nav.partOf')}</span>
      </span>
    </span>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</p>;
}

function SidebarBody() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const { pathname, search, hash } = useLocation();
  const tab = new URLSearchParams(search).get('tab');

  return (
    <div className="flex min-h-full flex-col gap-7 px-3 py-5">
      <Link to="/" className="rounded-xl px-2 py-1" aria-label={t('nav.home')}>
        <Logo />
      </Link>

      <nav aria-label="IndexBoard">
        <GroupLabel>IndexBoard</GroupLabel>
        <ul className="flex flex-col gap-0.5">
          {APP_LINKS.map((l) => {
            const active = l.active(pathname, tab, hash);
            return (
              <li key={l.to}>
                <Link
                  to={l.to}
                  aria-current={active ? 'page' : undefined}
                  className={`${itemBase} ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                  {t(l.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav aria-label={t('nav.suite')}>
        <GroupLabel>{t('nav.suite')}</GroupLabel>
        <ul className="flex flex-col gap-0.5">
          {SUITE_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${itemBase} justify-between text-muted-foreground hover:bg-muted hover:text-foreground`}
              >
                <span className="truncate">{t(l.key)}</span>
                <span aria-hidden className="text-[12px] opacity-70">
                  ↗
                </span>
                <span className="sr-only">{t('nav.newTab')}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t px-1 pt-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
          title={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card text-[17px] transition-colors duration-150 hover:bg-muted"
        >
          <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
        <div role="group" aria-label={t('lang.label')} className="flex rounded-full border bg-card p-0.5">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={lang === l.id}
              onClick={() => setLang(l.id)}
              className={`h-9 min-w-[48px] rounded-full px-3 text-[13px] font-semibold transition-colors duration-150 ${
                lang === l.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const { t } = useI18n();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useHashScroll();

  useEffect(() => {
    setOpen(false);
  }, [location.key]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="min-h-screen min-[900px]:flex">
      <aside
        aria-label={t('nav.main')}
        className="no-print sticky top-0 hidden h-screen w-[248px] shrink-0 overflow-y-auto border-r bg-card min-[900px]:block"
      >
        <SidebarBody />
      </aside>

      <div className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-md min-[900px]:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('nav.menu')}
          aria-expanded={open}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card text-[18px] hover:bg-muted"
        >
          <span aria-hidden>☰</span>
        </button>
        <Link to="/" className="min-w-0" aria-label={t('nav.home')}>
          <Logo />
        </Link>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 min-[900px]:hidden" role="dialog" aria-modal="true" aria-label={t('nav.main')}>
          <button type="button" aria-label={t('nav.closeMenu')} className="absolute inset-0 h-full w-full bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[248px] max-w-[85vw] overflow-y-auto border-r bg-card shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('nav.closeMenu')}
              className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[20px] text-muted-foreground hover:bg-muted"
            >
              <span aria-hidden>×</span>
            </button>
            <SidebarBody />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">{children}</main>
        <footer className="no-print mt-16 border-t">
          <div className="mx-auto max-w-6xl px-4 py-8 text-[13px] text-muted-foreground sm:px-6">{t('footer')}</div>
        </footer>
      </div>
    </div>
  );
}
