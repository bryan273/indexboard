import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SUITE, EXPLAINER, type Lang } from './SuiteTopBar';
import './suite-topbar.css';

const T = {
  en: { apps: 'Apps', learn: 'Learn', check: 'Check', about: 'About', tag: 'Read a paper, then check its numbers.', made: 'Made at Tsinghua SIGS, AIID capstone, Group 1.', note: 'Results are produced by AI agents. Check the quoted sources before you rely on them.', top: 'Back to top', faq: 'Frequently asked', open: 'opens in a new tab' },
  zh: { apps: '应用', learn: '理解', check: '核验', about: '关于', tag: '读懂论文，再核验它的数字。', made: '清华深圳国际研究生院 AIID 课程项目，第 1 组。', note: '结果由 AI 智能体生成。引用前请核对原文出处。', top: '回到顶部', faq: '常见问题', open: '在新标签页打开' },
} as const;

/** Four-column footer shared by every app of the suite. */
export function SuiteFooter({ lang, appId, note }: { lang: Lang; appId: string; note?: string }) {
  const t = T[lang];
  const pick = (ids: string[]) => SUITE.filter((s) => ids.includes(s.id));
  const col = (title: string, items: { label: string; href: string; id: string }[]) => (
    <nav className="sft-col" aria-label={title}>
      <h2>{title}</h2>
      {items.map((s) => (
        <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" aria-current={s.id === appId ? 'page' : undefined} className={s.id === appId ? 'on' : ''}>
          {s.label}
          <span className="sr-only"> ({t.open})</span>
        </a>
      ))}
    </nav>
  );
  return (
    <footer className="sft">
      <div className="sft-in">
        <div className="sft-brand">
          <span className="stb-logo" aria-hidden>R</span>
          <b>Repro Suite</b>
          <p>{t.tag}</p>
          <small>{t.made}</small>
        </div>
        {col(t.learn, [{ id: 'explainer', label: 'Paper Explainer', href: EXPLAINER }, ...pick(['companion'])])}
        {col(t.check, pick(['agent', 'lite', 'desk', 'indexboard']))}
        {col(t.about, pick(['bench', 'hub']))}
      </div>
      <div className="sft-bar">
        <span>{note ?? t.note}</span>
        <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{t.top} ↑</a>
      </div>
    </footer>
  );
}

export type FaqItem = { q: string; a: ReactNode };

/** Accordion built on details/summary: keyboard and screen reader friendly, no JS needed to open. */
export function SuiteFaq({ items, title, lang, id }: { items: FaqItem[]; title?: string; lang: Lang; id?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="sff" id={id} aria-labelledby={`${id ?? 'faq'}-h`}>
      <h2 id={`${id ?? 'faq'}-h`}>{title ?? T[lang].faq}</h2>
      <div className="sff-list">
        {items.map((it, i) => (
          <details key={i} open={open === i} onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) setOpen(i); else if (open === i) setOpen(null); }}>
            <summary>{it.q}</summary>
            <div className="sff-a">{it.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Closing call to action band, the last thing before the footer. */
export function SuiteCta({ title, body, label, to, href, onClick }: { title: string; body?: string; label: string; to?: string; href?: string; onClick?: () => void }) {
  const btn = to ? (
    <Link to={to} className="sfc-btn" onClick={onClick}>{label} →</Link>
  ) : (
    <a href={href ?? '#'} className="sfc-btn" onClick={onClick}>{label} →</a>
  );
  return (
    <section className="sfc" aria-label={title}>
      <div>
        <h2>{title}</h2>
        {body && <p>{body}</p>}
      </div>
      {btn}
    </section>
  );
}

/** Row of proof numbers. Only pass real, checkable figures. */
export function SuiteStats({ items }: { items: { v: string; l: string }[] }) {
  return (
    <dl className="sfs">
      {items.map((s) => (
        <div key={s.l}>
          <dt>{s.l}</dt>
          <dd>{s.v}</dd>
        </div>
      ))}
    </dl>
  );
}
