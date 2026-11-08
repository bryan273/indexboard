import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PRODUCTS, type Lang } from './SuiteTopBar';
import './suite-topbar.css';

const T = {
  en: { apps: 'Paperlit', about: 'About', home: 'Home', tag: 'Turn papers into videos, read with citations, check the numbers.', note: 'Results are produced by AI agents. Check the quoted sources before you rely on them.', top: 'Back to top', faq: 'Frequently asked', open: 'opens in the same tab', terms: 'Terms', privacy: 'Privacy' },
  zh: { apps: 'Paperlit', about: '关于', home: '首页', tag: '把论文变成视频，带引用地阅读，核验它的数字。', note: '结果由 AI 智能体生成。引用前请核对原文出处。', top: '回到顶部', faq: '常见问题', open: '在新标签页打开', terms: '条款', privacy: '隐私' },
  vi: { apps: 'Paperlit', about: 'Giới thiệu', home: 'Trang chủ', tag: 'Biến bài báo thành video, đọc kèm trích dẫn, kiểm chứng số liệu.', note: 'Kết quả do tác tử AI tạo ra. Hãy kiểm tra các nguồn được trích dẫn trước khi dựa vào.', top: 'Lên đầu trang', faq: 'Câu hỏi thường gặp', open: 'mở trong cùng tab', terms: 'Điều khoản', privacy: 'Quyền riêng tư' },
  id: { apps: 'Paperlit', about: 'Tentang', home: 'Beranda', tag: 'Ubah makalah menjadi video, baca dengan sitasi, periksa angkanya.', note: 'Hasil dibuat oleh agen AI. Periksa sumber yang dikutip sebelum Anda mengandalkannya.', top: 'Kembali ke atas', faq: 'Pertanyaan yang sering diajukan', open: 'dibuka di tab yang sama', terms: 'Ketentuan', privacy: 'Privasi' },
} as const;

/** Four-column footer shared by every app of the suite. */
export function SuiteFooter({ lang, appId, note }: { lang: Lang; appId: string; note?: string }) {
  const t = T[lang];
  const col = (title: string, items: { label: string; href: string; id: string; ids?: string[] }[]) => (
    <nav className="sft-col" aria-label={title}>
      <h2>{title}</h2>
      {items.map((s) => (
        <a key={s.id} href={s.href} aria-current={s.ids?.includes(appId) ? 'page' : undefined} className={s.ids?.includes(appId) ? 'on' : ''}>
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
          <b>Paperlit</b>
          <p>{t.tag}</p>
        </div>
        {col(t.apps, PRODUCTS.map((pr) => ({ id: pr.id, ids: pr.ids, label: pr.n[lang] ?? pr.n.en, href: pr.href })))}
        {col(t.about, [{ id: 'hub', label: t.home, href: 'https://bryan273.github.io/repro-suite/hub/' }, { id: 'terms', label: t.terms, href: 'https://bryan273.github.io/repro-suite/explainer/terms' }, { id: 'privacy', label: t.privacy, href: 'https://bryan273.github.io/repro-suite/explainer/privacy' }])}
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
