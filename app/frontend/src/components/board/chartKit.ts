import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTheme } from '@/lib/theme';

export interface ChartPalette {
  text: string;
  muted: string;
  grid: string;
  accent: string;
  barMuted: string;
  surface: string;
}

const LIGHT: ChartPalette = {
  text: '#1D1D1F',
  muted: '#5C5C66',
  grid: '#ECECF1',
  accent: '#2B59FF',
  barMuted: '#BCC3D9',
  surface: '#FFFFFF',
};

const DARK: ChartPalette = {
  text: '#F4F4F6',
  muted: '#ADADB8',
  grid: '#24242B',
  accent: '#7B96FF',
  barMuted: '#4A4F66',
  surface: '#151519',
};

export const SANS = "Inter, 'Noto Sans SC', system-ui, -apple-system, sans-serif";
export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

export function usePalette(forceLight = false): ChartPalette {
  const { theme } = useTheme();
  return theme === 'dark' && !forceLight ? DARK : LIGHT;
}

export function useElementWidth<T extends HTMLElement>(fallback = 640): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(260, Math.floor(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
}

/** Rasterises an inline SVG at 2x and copies it to the clipboard, falling back to a download. */
export async function copySvgAsPng(svg: SVGSVGElement, filename: string): Promise<'copied' | 'downloaded'> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const width = Number(svg.getAttribute('width')) || svg.clientWidth;
  const height = Number(svg.getAttribute('height')) || svg.clientHeight;
  const source = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('svg load failed'));
      el.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png failed'))), 'image/png'),
    );
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('no clipboard');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    } catch {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return 'downloaded';
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
