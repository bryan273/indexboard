import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './suite-topbar.css';

export type NavLink = { label: string; to?: string; href?: string; onClick?: () => void; active?: boolean };
export type Lang = 'en' | 'zh';

type Props = {
  /** current app, one of: lite, companion, indexboard, desk, explainer, hub, agent */
  appId: string;
  brand?: string;
  letter?: string;
  homeTo?: string;
  nav: NavLink[];
  dark: boolean;
  onToggleDark: () => void;
  lang: Lang;
  onLang: (l: Lang) => void;
};

const ROOT = 'https://bryan273.github.io/repro-suite';
type Feature = { id: string; href: string; en: string; zh: string; hEn: string; hZh: string; more?: boolean };
/** The features of one product. Every app shows the same list, so moving between them feels like moving between tabs of one site. */
export const FEATURES: Feature[] = [
  { id: 'explainer', href: `${ROOT}/explainer/`, en: 'Explain', zh: '解说', hEn: 'Turn a paper into a short video and ask it questions', hZh: '把论文变成短视频，并可随时提问' },
  { id: 'agent', href: `${ROOT}/repro/index.html`, en: 'Check', zh: '复现', hEn: 'Re-run a paper and see whether the number holds', hZh: '重新运行论文，看数字是否成立' },
  { id: 'lite', href: `${ROOT}/lite/`, en: 'Quick check', zh: '快速核验', hEn: 'Check one claim in your browser', hZh: '在浏览器里核验一个结论' },
  { id: 'companion', href: `${ROOT}/reading/`, en: 'Read', zh: '阅读', hEn: 'Read arXiv papers with cited answers', hZh: '阅读 arXiv 论文，答案带引用' },
  { id: 'indexboard', href: `${ROOT}/indexboard/`, en: 'Boards', zh: '榜单', hEn: 'Honest leaderboards with ties', hZh: '如实呈现并列的排行榜' },
  { id: 'desk', href: `${ROOT}/desk/`, en: 'Human check', zh: '人工核对', hEn: 'Ask for a human-checked reproduction', hZh: '申请人工核对的复现', more: true },
  { id: 'bench', href: `${ROOT}/repro/bench.html`, en: 'Benchmark', zh: '基准', hEn: 'Six models, 32 papers', hZh: '6 个模型，32 篇论文', more: true },
  { id: 'hub', href: `${ROOT}/hub/`, en: 'Overview', zh: '总览', hEn: 'The Repro Suite home', hZh: 'Repro Suite 首页', more: true },
];
export const SUITE = FEATURES.map((f) => ({ id: f.id, label: f.en, href: f.href, en: f.hEn, zh: f.hZh }));
export const EXPLAINER = `${ROOT}/explainer`;

const T = {
  en: { menu: 'Menu', more: 'More', toLight: 'Switch to light mode', toDark: 'Switch to dark mode', here: 'this page', onPage: 'On this page' },
  zh: { menu: '菜单', more: '更多', toLight: '切换到浅色模式', toDark: '切换到深色模式', here: '当前页面', onPage: '本页' },
} as const;

function NavItem({ l, onDone }: { l: NavLink; onDone: () => void }) {
  const cls = l.active ? 'on' : '';
  const cur = l.active ? 'page' : undefined;
  if (l.to) {
    return (
      <Link to={l.to} className={cls} aria-current={cur} onClick={() => { l.onClick?.(); onDone(); }}>
        {l.label}
      </Link>
    );
  }
  return (
    <a
      href={l.href ?? '#'}
      className={cls}
      aria-current={cur}
      onClick={(e) => {
        if (l.onClick) { e.preventDefault(); l.onClick(); }
        onDone();
      }}
    >
      {l.label}
    </a>
  );
}

export default function SuiteTopBar({ appId, nav, dark, onToggleDark, lang, onLang }: Props) {
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = appId === 'companion' || appId === 'explainer' || appId === 'agent' ? appId : appId;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        setOpen(false);
      }
    };
    document.addEventListener('click', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('stb-lock', open);
    return () => document.body.classList.remove('stb-lock');
  }, [open]);

  const main = FEATURES.filter((f) => !f.more);
  const more = FEATURES.filter((f) => f.more);
  const moreActive = more.some((f) => f.id === active);
  const hasSub = nav.length > 0;

  return (
    <>
      <header className="stb" data-open={open} data-sub={hasSub}>
        <div className="stb-row">
          <a href={`${ROOT}/hub/`} className="stb-brand" onClick={() => setOpen(false)}>
            <span className="stb-logo" aria-hidden>R</span>
            <b>Repro Suite</b>
          </a>

          <nav className="stb-nav" aria-label="Repro Suite">
            {main.map((f) => (
              <a key={f.id} href={f.href} className={f.id === active ? 'on' : ''} aria-current={f.id === active ? 'page' : undefined}>
                {f[lang]}
              </a>
            ))}
            <div className="stb-suite" ref={ref}>
              <button type="button" className={moreActive ? 'on' : ''} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                {t.more} <span aria-hidden>▾</span>
              </button>
              {menu && (
                <div className="stb-menu" role="menu">
                  {more.map((f) => (
                    <a key={f.id} href={f.href} role="menuitem">
                      <b>{f[lang]}</b>
                      <span>{lang === 'zh' ? f.hZh : f.hEn}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="stb-act">
            <button type="button" className="stb-ic" onClick={onToggleDark} aria-label={dark ? t.toLight : t.toDark} title={dark ? t.toLight : t.toDark}>
              {dark ? '☀' : '☾'}
            </button>
            <button type="button" className="stb-pill" onClick={() => onLang(lang === 'en' ? 'zh' : 'en')} aria-label="Language">
              {lang === 'en' ? '中文' : 'EN'}
            </button>
            <button type="button" className="stb-ic stb-burger" onClick={() => setOpen((v) => !v)} aria-label={t.menu} aria-expanded={open}>
              {open ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {hasSub && (
          <nav className="stb-sub" aria-label={t.onPage}>
            {nav.map((l) => (
              <NavItem key={l.label} l={l} onDone={() => undefined} />
            ))}
          </nav>
        )}
      </header>

      {open && (
        <div className="stb-sheet" data-sub={hasSub}>
          <div className="stb-h">Repro Suite</div>
          {FEATURES.map((f) => (
            <a key={f.id} href={f.href} className={f.id === active ? 'on' : ''} aria-current={f.id === active ? 'page' : undefined}>
              {f[lang]}
              <em>{lang === 'zh' ? f.hZh : f.hEn}</em>
            </a>
          ))}
          {hasSub && <div className="stb-h">{t.onPage}</div>}
          {nav.map((l) => (
            <NavItem key={l.label} l={l} onDone={() => setOpen(false)} />
          ))}
        </div>
      )}
    </>
  );
}
