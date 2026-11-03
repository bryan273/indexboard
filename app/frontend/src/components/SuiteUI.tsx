import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import './suite-ui.css';

/** Fades and lifts its children in once they scroll into view. Without IntersectionObserver or with reduced motion it shows at once. */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: ElementType }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) {
          el.classList.add('in');
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={`su-reveal ${className}`} style={{ '--d': `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** A bento card whose glow follows the pointer. */
export function SpotCard({ children, className = '', href, as }: { children: ReactNode; className?: string; href?: string; as?: ElementType }) {
  const Tag: ElementType = as ?? (href ? 'a' : 'div');
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  const ext = href && /^https?:/.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <Tag className={`su-card ${className}`} href={href} onPointerMove={move} {...ext}>
      {children}
    </Tag>
  );
}

/** A real screenshot inside a browser frame. Pass `chips` to float small result cards over it. */
export function BrowserFrame({ src, alt, url, chips, width, height }: { src: string; alt: string; url: string; chips?: ReactNode; width?: number; height?: number }) {
  return (
    <div className="su-stage">
      <div className="su-frame">
        <div className="su-bar" aria-hidden>
          <b />
          <b />
          <b />
          <span>{url}</span>
        </div>
        <img src={src} alt={alt} width={width} height={height} loading="eager" decoding="async" />
      </div>
      {chips}
    </div>
  );
}

export function Chip({ pos, label, value, tag }: { pos: 'a' | 'b'; label: string; value: string; tag?: string }) {
  return (
    <div className={`su-chip ${pos}`} aria-hidden>
      <small>{label}</small>
      <strong>{value}</strong>
      {tag && <em>{tag}</em>}
    </div>
  );
}

export function Marquee({ items }: { items: string[] }) {
  const twice = [...items, ...items];
  return (
    <div className="su-marquee" role="img" aria-label={items.join(", ")}>
      <div className="su-track" aria-hidden>
        {twice.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export function SectionHead({ eyebrow, title, lead, center = false }: { eyebrow: string; title: string; lead?: string; center?: boolean }) {
  return (
    <div className={center ? 'su-center' : ''}>
      <p className="su-eyebrow">{eyebrow}</p>
      <h2 className="su-h2">{title}</h2>
      {lead && <p className="su-lead">{lead}</p>}
    </div>
  );
}

export function Icon({ d }: { d: string }) {
  return (
    <span className="su-ico" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

/** Puts the last few words of a title in the accent gradient. Chinese titles use characters instead of words. */
export function GradLast({ text, words = 3, chars = 5 }: { text: string; words?: number; chars?: number }) {
  const cjk = /[一-鿿]/.test(text);
  const trimmed = text.replace(/[.。]\s*$/, '');
  const tail = /[.。]\s*$/.test(text) ? text.slice(trimmed.length) : '';
  if (cjk) {
    const cut = Math.max(2, trimmed.length - chars);
    return (
      <>
        {trimmed.slice(0, cut)}
        <span className="su-grad">{trimmed.slice(cut)}{tail}</span>
      </>
    );
  }
  const parts = trimmed.split(' ');
  if (parts.length <= words + 1) return <>{text}</>;
  return (
    <>
      {parts.slice(0, -words).join(' ')} <span className="su-grad">{parts.slice(-words).join(' ')}{tail}</span>
    </>
  );
}

export type Feature = { t: string; p: string; d: string; w?: 'w3' | 'w4' | 'w6' };

/** A titled bento grid of icon cards, revealed on scroll. */
export function FeatureBento({ id, eyebrow, title, lead, items }: { id?: string; eyebrow: string; title: string; lead?: string; items: Feature[] }) {
  return (
    <section className="su-section" id={id}>
      <Reveal>
        <SectionHead center eyebrow={eyebrow} title={title} lead={lead} />
      </Reveal>
      <div className="su-bento">
        {items.map((f, i) => (
          <Reveal key={f.t} delay={i * 70} className={`su-cell ${f.w ?? (items.length % 3 === 1 || items.length === 4 ? 'w3' : '')}`}>
            <SpotCard>
              <Icon d={f.d} />
              <h3>{f.t}</h3>
              <p>{f.p}</p>
            </SpotCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export type Slide = { key: string; label: string; url: string; src: string; alt: string };

/** Browser frame that cycles through several products. Pauses when hidden, off screen, hovered, or when the visitor picks a tab. */
export function ShowcaseFrame({ slides, interval = 4500, chips }: { slides: Slide[]; interval?: number; chips?: (key: string) => ReactNode }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [seen, setSeen] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => setSeen(es[0].isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (hold || !seen) return; // slides swap by a plain fade, so this runs even with reduced motion (CSS drops the fade itself)
    const t = setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % slides.length);
    }, interval);
    return () => clearInterval(t);
  }, [hold, seen, slides.length, interval]);
  const cur = slides[i];
  return (
    <div className="su-stage" ref={box} onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}>
      <div className="su-frame">
        <div className="su-bar" aria-hidden>
          <b />
          <b />
          <b />
          <span>{cur.url}</span>
        </div>
        <div className="su-slides">
          {slides.map((s, k) => (
            <img key={s.key} src={s.src} alt={k === i ? s.alt : ''} aria-hidden={k !== i} className={k === i ? 'on' : ''} width={1424} height={900} loading={k === 0 ? 'eager' : 'lazy'} decoding="async" />
          ))}
        </div>
      </div>
      {chips?.(cur.key)}
      <div className="su-tabs" role="tablist" aria-label="Apps">
        {slides.map((s, k) => (
          <button key={s.key} type="button" role="tab" aria-selected={k === i} className={k === i ? 'on' : ''} onClick={() => { setI(k); setHold(true); window.setTimeout(() => setHold(false), 12000); }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Labelled groups of plain chips: each group says what kind of thing the chips are. */
export function ChipGroups({ groups }: { groups: { title: string; items: string[] }[] }) {
  return (
    <div className="su-groups">
      {groups.map((g) => (
        <div key={g.title}>
          <p>{g.title}</p>
          <ul>
            {g.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
