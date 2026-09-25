import { useEffect, useRef, type Dispatch } from 'react';
import { lookFor, MAX_CAST, randomSeed, type Line, type LookOverrides, type Slide } from '../render';
import { drawCharacter } from '../render/character';
import type { Action } from '../state/project';

const NAMES = ['Rita', 'Moe', 'Dot', 'Gus', 'Ivy', 'Lou', 'Pip', 'Nell'];

/** A small preview of a cast member, drawn by the renderer's own drawCharacter. */
function Face({ seed, look }: { seed: number; look?: LookOverrides }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 60, 80);
    ctx.save();
    ctx.translate(30, 40);
    drawCharacter(ctx, lookFor(seed, look), 56, 76, { mouthOpen: false, gaze: 0 });
    ctx.restore();
  }, [seed, look]);
  return <canvas ref={ref} width={60} height={80} className="face" />;
}

interface Props {
  slide: Slide;
  dispatch: Dispatch<Action>;
}

/** Comic layer controls: up to three characters and the lines they say, in order. */
export function ComicPanel({ slide, dispatch }: Props) {
  const update = (patch: Partial<Slide>) => dispatch({ type: 'update', id: slide.id, patch });
  const setLine = (i: number, patch: Partial<Line>) =>
    update({ lines: slide.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <section>
      <h2>Comic</h2>
      <div className="cast">
        {slide.cast.map((c, i) => (
          <div key={i} className="member">
            <Face seed={c.seed} look={c.look} />
            <input value={c.name} aria-label={`Character ${i + 1} name`}
              onChange={(e) => update({ cast: slide.cast.map((m, j) => (j === i ? { ...m, name: e.target.value } : m)) })} />
            <div className="member-actions">
              <button type="button" title="New look"
                onClick={() => update({ cast: slide.cast.map((m, j) => (j === i ? { ...m, seed: randomSeed(), look: undefined } : m)) })}>
                ↻
              </button>
              <button type="button" title={(c.scale ?? 1) < 1 ? 'Make adult size' : 'Make child size'}
                onClick={() => update({ cast: slide.cast.map((m, j) => (j === i ? { ...m, scale: (m.scale ?? 1) < 1 ? 1 : 0.66 } : m)) })}>
                {(c.scale ?? 1) < 1 ? 'S' : 'L'}
              </button>
              <button type="button" title="Remove character"
                onClick={() =>
                  update({
                    cast: slide.cast.filter((_, j) => j !== i),
                    // drop this character's lines, re-point later speakers
                    lines: slide.lines
                      .filter((l) => l.speaker !== i)
                      .map((l) => (l.speaker > i ? { ...l, speaker: l.speaker - 1 } : l)),
                  })
                }>
                ✕
              </button>
            </div>
          </div>
        ))}
        {slide.cast.length < MAX_CAST && (
          <button type="button" className="add-member" data-testid="add-character"
            onClick={() =>
              update({ cast: [...slide.cast, { seed: randomSeed(), name: NAMES[(slide.cast.length + slide.seed) % NAMES.length] }] })
            }>
            + Character
          </button>
        )}
      </div>
      {slide.cast.length > 0 && (
        <>
          <ol className="lines">
            {slide.lines.map((l, i) => (
              <li key={i}>
                <select value={l.speaker} aria-label="Speaker" onChange={(e) => setLine(i, { speaker: Number(e.target.value) })}>
                  {slide.cast.map((c, j) => (
                    <option key={j} value={j}>{c.name || `Character ${j + 1}`}</option>
                  ))}
                </select>
                <input value={l.text} placeholder="What do they say?" aria-label={`Line ${i + 1}`}
                  onChange={(e) => setLine(i, { text: e.target.value })} />
                <button type="button" title="Remove line"
                  onClick={() => update({ lines: slide.lines.filter((_, j) => j !== i) })}>✕</button>
              </li>
            ))}
          </ol>
          <button type="button" data-testid="add-line"
            onClick={() => {
              // alternate speakers by default
              const last = slide.lines[slide.lines.length - 1];
              const speaker = last ? (last.speaker + 1) % slide.cast.length : 0;
              update({ lines: [...slide.lines, { speaker, text: '' }] });
            }}>
            + Line
          </button>
          <p className="hint">Bubbles type out in order after everything has landed. Longer lines need a longer slide.</p>
        </>
      )}
    </section>
  );
}
