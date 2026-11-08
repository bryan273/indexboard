import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './suite-topbar.css';

export type NavLink = { label: string; to?: string; href?: string; onClick?: () => void; active?: boolean };
export type Lang = 'en' | 'zh' | 'vi' | 'id';
/** Every language the page speaks, with the name written in that language. */
export const LANGUAGES: { id: Lang; name: string; short: string }[] = [
  { id: 'en', name: 'English', short: 'EN' },
  { id: 'zh', name: '中文', short: '中文' },
  { id: 'vi', name: 'Tiếng Việt', short: 'VI' },
  { id: 'id', name: 'Bahasa Indonesia', short: 'ID' },
];

type Props = {
  /** current app, one of: lite, companion, indexboard, desk, explainer, hub, agent */
  appId: string;
  brand?: string;
  letter?: string;
  homeTo?: string;
  nav: NavLink[];
  dark?: boolean;
  onToggleDark?: () => void;
  lang: Lang;
  onLang(l: Lang): void;
  /** the languages this app speaks; the suite apps default to English and Chinese */
  languages?: Lang[];
  onSettings?: () => void;
};

const ROOT = 'https://bryan273.github.io/repro-suite';
type Feature = { id: string; href: string; en: string; zh: string; hEn: string; hZh: string; more?: boolean };
/** The features of one product. Every app shows the same list, so moving between them feels like moving between tabs of one site. */
export const FEATURES: Feature[] = [
  { id: 'explainer', href: `${ROOT}/explainer/`, en: 'Explain a paper', zh: '讲解论文', hEn: 'Turn a paper into a short video you can pause, question and quiz yourself on', hZh: '把论文变成可暂停、可提问、可自测的短视频' },
  { id: 'companion', href: `${ROOT}/reading/`, en: 'Read a paper', zh: '阅读论文', hEn: 'Read an arXiv paper with answers that cite the page', hZh: '阅读 arXiv 论文，答案标注原文页码' },
  { id: 'agent', href: `${ROOT}/repro/index.html`, en: 'Reproduce a paper', zh: '复现论文', hEn: 'An AI agent re-runs the paper\'s experiment and tells you if the result really holds', hZh: 'AI 智能体重新运行论文实验，告诉你结果是否真的成立' },
];
export const SUITE = FEATURES.map((f) => ({ id: f.id, label: f.en, href: f.href, en: f.hEn, zh: f.hZh }));
export const EXPLAINER = `${ROOT}/explainer`;

const R = ROOT;
type L4 = { en: string; zh: string; vi: string; id: string };
type Product = { id: string; ids: string[]; href: string; mark: string; n: L4; d: L4 };
/** The suite as three products, not eight apps: make a video, read a paper, check whether its result holds. */
const PRODUCTS: Product[] = [
  { id: 'explain', ids: ['explainer'], href: `${R}/explainer/`, mark: '▶',
    n: { en: 'Learn by video', zh: '看视频学论文', vi: 'Học qua video', id: 'Belajar lewat video' },
    d: { en: 'Drop in a paper or PDF. Get a short video that teaches it.', zh: '丢进论文或 PDF，得到讲解它的短视频。', vi: 'Thả bài báo hoặc PDF vào. Nhận video ngắn giảng giải.', id: 'Masukkan makalah atau PDF. Dapatkan video singkat yang mengajarkannya.' } },
  { id: 'read', ids: ['companion'], href: `${R}/reading/`, mark: '❝',
    n: { en: 'Read and ask', zh: '边读边问', vi: 'Đọc và hỏi', id: 'Baca dan tanya' },
    d: { en: 'Read with an AI that shows the page behind every answer.', zh: '和 AI 一起读，每个答案都标出处页码。', vi: 'Đọc cùng AI chỉ ra trang nguồn của mỗi câu trả lời.', id: 'Baca bersama AI yang menunjukkan halaman di balik setiap jawaban.' } },
  { id: 'repro', ids: ['agent', 'lite', 'desk', 'indexboard', 'hub'], href: `${R}/repro/index.html`, mark: '✓',
    n: { en: 'Check the result', zh: '检验结果', vi: 'Kiểm chứng kết quả', id: 'Periksa hasilnya' },
    d: { en: 'Is the published number true? Our AI re-runs the experiment.', zh: '发表的数字是真的吗？我们的 AI 重新运行实验。', vi: 'Con số được công bố có đúng không? AI của chúng tôi chạy lại thí nghiệm.', id: 'Apakah angka yang dipublikasikan benar? AI kami menjalankan ulang eksperimennya.' } },
];

const T = {
  en: { menu: 'Menu', more: 'More', apps: 'Apps', tools: 'Apps', settings: 'Settings', suiteName: 'What you can do with a paper', toLight: 'Switch to light mode', toDark: 'Switch to dark mode', here: 'this page', onPage: 'On this page' },
  zh: { menu: '菜单', more: '更多', apps: '应用', tools: '应用', settings: '设置', suiteName: '你可以用论文做什么', toLight: '切换到浅色模式', toDark: '切换到深色模式', here: '当前页面', onPage: '本页' },
  vi: { menu: 'Menu', more: 'Thêm', apps: 'Ứng dụng', tools: 'Ứng dụng', settings: 'Cài đặt', suiteName: 'Bạn có thể làm gì với một bài báo', toLight: 'Chuyển sang giao diện sáng', toDark: 'Chuyển sang giao diện tối', here: 'trang này', onPage: 'Trên trang này' },
  id: { menu: 'Menu', more: 'Lainnya', apps: 'Aplikasi', tools: 'Aplikasi', settings: 'Pengaturan', suiteName: 'Yang bisa Anda lakukan dengan makalah', toLight: 'Beralih ke tema terang', toDark: 'Beralih ke tema gelap', here: 'halaman ini', onPage: 'Di halaman ini' },
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

export default function SuiteTopBar({ appId, brand, letter, nav, lang, onLang, onSettings, languages }: Props) {
  const t = T[lang];
  const zh = lang === 'zh';
  const [langOpen, setLangOpen] = useState(false);
  const hereFeature = FEATURES.find((f) => f.id === appId);
  const prodHere = PRODUCTS.find((x) => x.ids.includes(appId));
  const hereName = appId === 'hub' ? '' : prodHere ? prodHere.n[lang] : brand ?? '';
  const [nudge, setNudge] = useState(() => { try { return localStorage.getItem('stb-tools-seen') !== '1'; } catch { return false; } });
  const seen = () => { setNudge(false); try { localStorage.setItem('stb-tools-seen', '1'); } catch { /* private mode */ } };
  const langRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = appId === 'companion' || appId === 'explainer' || appId === 'agent' ? appId : appId;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        setLangOpen(false);
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

  const hasSub = nav.length > 0;

  return (
    <>
      <header className="stb" data-open={open} data-sub={hasSub}>
        <div className="stb-row">
          <a href={`${ROOT}/hub/`} className="stb-brand" aria-label="Paperlit" onClick={() => setOpen(false)}>
            <span className="stb-logo" aria-hidden>P</span>
            <b>Paperlit</b>
          </a>
          {hereName && <span className="stb-here" aria-current="page">{hereName}</span>}

          {hasSub && (
            <nav className="stb-own" aria-label={t.onPage}>
              {nav.map((l) => (
                <NavItem key={l.label} l={l} onDone={() => undefined} />
              ))}
            </nav>
          )}

          <div className="stb-act">
            <div className="stb-suite stb-apps-wrap" ref={ref}>
              <button type="button" className={`stb-apps${nudge ? ' nudge' : ''}`} aria-expanded={menu} aria-haspopup="menu" aria-label={t.suiteName} onClick={() => { setMenu((v) => !v); setLangOpen(false); seen(); }}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><g fill="currentColor"><circle cx="6" cy="6" r="1.9" /><circle cx="12" cy="6" r="1.9" /><circle cx="18" cy="6" r="1.9" /><circle cx="6" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="18" cy="12" r="1.9" /><circle cx="6" cy="18" r="1.9" /><circle cx="12" cy="18" r="1.9" /><circle cx="18" cy="18" r="1.9" /></g></svg>
                <span>{t.tools}</span>
                {nudge && <i className="stb-dot" aria-hidden />}
              </button>
              {menu && (
                <div className="stb-menu stb-products" role="menu">
                  <p className="stb-menu-h">{t.suiteName}</p>
                  {PRODUCTS.map((pr) => (
                    <div key={pr.id} className={`stb-prod${pr.ids.includes(active) ? ' on' : ''}`}>
                      <a href={pr.href} role="menuitem" aria-current={pr.ids.includes(active) ? 'page' : undefined}>
                        <span className="stb-tile" aria-hidden>{pr.mark}</span>
                        <span className="stb-mt"><b>{pr.n[lang]}{pr.ids.includes(active) ? <i> · {t.here}</i> : null}</b><span>{pr.d[lang]}</span></span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="stb-suite" ref={langRef}>
              <button type="button" className="stb-lang" aria-expanded={langOpen} aria-haspopup="listbox" aria-label="Language" onClick={() => { setLangOpen((v) => !v); setMenu(false); }}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><g fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></g></svg>
                <span>{LANGUAGES.find((x) => x.id === lang)?.short}</span>
              </button>
              {langOpen && (
                <div className="stb-menu stb-langmenu" role="listbox" aria-label="Language">
                  {LANGUAGES.filter((x) => (languages ?? ['en', 'zh']).includes(x.id)).map((x) => (
                    <button key={x.id} type="button" role="option" aria-selected={x.id === lang} className={x.id === lang ? 'on' : ''} onClick={() => { onLang(x.id); setLangOpen(false); }}>
                      <span>{x.name}</span>
                      {x.id === lang && <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {onSettings && (
              <button type="button" className="stb-ic stb-gear" onClick={onSettings} aria-label={t.settings} title={t.settings}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5h0a1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z" /></g></svg>
              </button>
            )}
            <button type="button" className="stb-ic stb-burger" onClick={() => setOpen((v) => !v)} aria-label={t.menu} aria-expanded={open}>
              {open ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="stb-sheet" data-sub={hasSub}>
          {hasSub && <div className="stb-h">{t.onPage}</div>}
          {nav.map((l) => (
            <NavItem key={l.label} l={l} onDone={() => setOpen(false)} />
          ))}
          <div className="stb-sheet-langs">{LANGUAGES.filter((x) => (languages ?? ['en', 'zh']).includes(x.id)).map((x) => <button key={x.id} type="button" className={x.id === lang ? 'on' : ''} onClick={() => onLang(x.id)}>{x.name}</button>)}</div>
          {onSettings && <button type="button" className="stb-sheet-btn" onClick={() => { setOpen(false); onSettings(); }}>{t.settings}</button>}
          <div className="stb-h">{t.suiteName}</div>
          {FEATURES.map((f) => (
            <a key={f.id} href={f.href} className={f.id === active ? 'on' : ''} aria-current={f.id === active ? 'page' : undefined}>
              {f[zh ? 'zh' : 'en']}
              <em>{zh ? f.hZh : f.hEn}</em>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
