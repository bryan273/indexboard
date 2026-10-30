import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './suite-topbar.css';

export type NavLink = { label: string; to?: string; href?: string; onClick?: () => void; active?: boolean };
export type Lang = 'en' | 'zh';

type Props = {
  /** current app, one of: lite, companion, indexboard, desk, explainer, hub, agent */
  appId: string;
  brand: string;
  letter: string;
  homeTo: string;
  nav: NavLink[];
  dark: boolean;
  onToggleDark: () => void;
  lang: Lang;
  onLang: (l: Lang) => void;
};

export const SUITE: { id: string; label: string; href: string; en: string; zh: string }[] = [
  { id: 'agent', label: 'Paper Repro Agent', href: 'https://bryan273.github.io/repro-suite/repro/index.html', en: 'Check whether a paper reproduces', zh: '核验论文能否复现' },
  { id: 'bench', label: 'Benchmark', href: 'https://bryan273.github.io/repro-suite/repro/bench.html', en: 'Six models, 32 papers', zh: '6 个模型，32 篇论文' },
  { id: 'lite', label: 'Repro Lite', href: 'https://bryan273.github.io/repro-suite/lite', en: 'Check one claim in your browser', zh: '在浏览器里核验一个结论' },
  { id: 'companion', label: 'Reading Companion', href: 'https://bryan273.github.io/repro-suite/reading', en: 'Read arXiv papers with cited answers', zh: '阅读 arXiv 论文，答案带引用' },
  { id: 'indexboard', label: 'IndexBoard', href: 'https://bryan273.github.io/repro-suite/indexboard/b/5dhum9j5h0', en: 'Honest leaderboards with ties', zh: '如实呈现并列的排行榜' },
  { id: 'desk', label: 'Repro Desk', href: 'https://bryan273.github.io/repro-suite/desk', en: 'Ask for a human-checked reproduction', zh: '申请人工核对的复现' },
  { id: 'hub', label: 'All apps', href: 'https://bryan273.github.io/repro-suite/hub', en: 'The Repro Suite home', zh: 'Repro Suite 首页' },
];
export const EXPLAINER = 'https://bryan273.github.io/repro-suite/explainer';
const AGENT = 'https://bryan273.github.io/repro-suite/repro/index.html';

const T = {
  en: { menu: 'Menu', suite: 'Paper Repro Suite', newTab: 'opens in a new tab', toLight: 'Switch to light mode', toDark: 'Switch to dark mode', nw: 'New', here: 'you are here' },
  zh: { menu: '菜单', suite: 'Paper Repro Suite', newTab: '在新标签页打开', toLight: '切换到浅色模式', toDark: '切换到深色模式', nw: '新', here: '当前应用' },
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

export default function SuiteTopBar({ appId, brand, letter, homeTo, nav, dark, onToggleDark, lang, onLang }: Props) {
  const t = T[lang];
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const suiteLinks = SUITE.filter((s) => s.id !== appId && s.id !== 'agent');

  return (
    <>
      <header className="stb" data-open={open}>
        <Link to={homeTo} className="stb-brand" onClick={() => setOpen(false)}>
          <span className="stb-logo" aria-hidden>
            {letter}
          </span>
          <b>{brand}</b>
        </Link>

        <nav className={`stb-nav${nav.length >= 5 ? ' stb-dense' : ''}`} aria-label={brand}>
          {nav.map((l) => (
            <NavItem key={l.label} l={l} onDone={() => undefined} />
          ))}
          <span className="stb-sep" aria-hidden />
          {appId !== 'explainer' && (
            <a className="stb-x" href={EXPLAINER} target="_blank" rel="noopener noreferrer">
              Paper Explainer
            </a>
          )}
          {appId !== 'agent' && (
            <a className="stb-x" href={AGENT} target="_blank" rel="noopener noreferrer">
              Paper Repro Agent
            </a>
          )}
          <div className="stb-suite" ref={ref}>
            <button type="button" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              {t.suite} <span aria-hidden>▾</span>
            </button>
            {menu && (
              <div className="stb-menu" role="menu">
                {suiteLinks.map((s) => (
                  <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" role="menuitem">
                    <b>
                      {s.label} <i>↗</i>
                    </b>
                    <span>{s[lang]}</span>
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
      </header>

      {open && (
        <div className="stb-sheet">
          {nav.length > 0 && <div className="stb-h">{brand}</div>}
          {nav.map((l) => (
            <NavItem key={l.label} l={l} onDone={() => setOpen(false)} />
          ))}
          {appId !== 'explainer' && (
            <>
              <div className="stb-h">Learn</div>
              <a className="stb-x" href={EXPLAINER} target="_blank" rel="noopener noreferrer">
                Paper Explainer
                <em>↗</em>
              </a>
            </>
          )}
          {appId !== 'agent' && (
            <>
              <div className="stb-h">Check</div>
              <a className="stb-x" href={AGENT} target="_blank" rel="noopener noreferrer">
                Paper Repro Agent
                <em>↗</em>
              </a>
            </>
          )}
          <div className="stb-h">{t.suite}</div>
          {suiteLinks.map((s) => (
            <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label}
              <em>↗</em>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
