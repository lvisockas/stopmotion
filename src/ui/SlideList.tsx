import { useEffect, useRef, useState, type Dispatch } from 'react';
import { lookupAsset } from '../assets/images';
import { MAX_SLIDES } from '../model/slide';
import { drawFrame, HEIGHT, totalFrames, WIDTH, type Slide } from '../render';
import type { Action } from '../state/project';
import type { ExportState } from './exportState';

let scratch: HTMLCanvasElement | null = null;

/** Final composition, drawn full size by drawFrame then scaled down. */
function Thumb({ slide, assetsVersion }: { slide: Slide; assetsVersion: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      scratch ??= Object.assign(document.createElement('canvas'), { width: WIDTH, height: HEIGHT });
      drawFrame(scratch.getContext('2d')!, slide, totalFrames(slide) - 1, lookupAsset);
      const ctx = ref.current?.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(scratch, 0, 0, ctx.canvas.width, ctx.canvas.height);
    }, 150);
    return () => clearTimeout(id);
  }, [slide, assetsVersion]);
  return <canvas ref={ref} width={96} height={120} className="thumb" />;
}

interface Props {
  slides: Slide[];
  selectedId: string;
  dispatch: Dispatch<Action>;
  assetsVersion: number;
  exports: Record<string, ExportState>;
  busy: boolean;
}

export function SlideList({ slides, selectedId, dispatch, assetsVersion, exports, busy }: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  return (
    <aside className="slides" aria-label="Slides">
      <ol>
        {slides.map((s, i) => {
          const ex = exports[s.id];
          return (
            <li
              key={s.id}
              className={[s.id === selectedId ? 'selected' : '', dropAt === i ? 'drop-target' : ''].join(' ')}
              draggable={!busy}
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDropAt(i);
              }}
              onDragLeave={() => setDropAt(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) dispatch({ type: 'moveSlide', from: dragFrom, to: i });
                setDragFrom(null);
                setDropAt(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDropAt(null);
              }}
              onClick={() => dispatch({ type: 'select', id: s.id })}
            >
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <Thumb slide={s} assetsVersion={assetsVersion} />
              <div className="slide-actions">
                <button type="button" title="Duplicate" disabled={busy || slides.length >= MAX_SLIDES}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'duplicate', id: s.id }); }}>⧉</button>
                <button type="button" title="Delete" disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (s.images.length === 0 && !s.title && !s.subtitle) dispatch({ type: 'delete', id: s.id });
                    else if (confirm(`Delete slide ${i + 1}?`)) dispatch({ type: 'delete', id: s.id });
                  }}>✕</button>
              </div>
              {ex && ex.status !== 'idle' && (
                <div className={`progress ${ex.status}`} title={ex.error ?? ''}>
                  <div style={{ width: `${Math.round(ex.progress * 100)}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" className="add-slide" disabled={busy || slides.length >= MAX_SLIDES}
        onClick={() => dispatch({ type: 'add' })}>
        + Add slide {slides.length >= MAX_SLIDES ? '(max 10)' : ''}
      </button>
    </aside>
  );
}
