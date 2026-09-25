import { useRef, useState, type Dispatch, type ReactNode } from 'react';
import { imageUrl } from '../assets/images';
import { ACCEPTED_TYPES } from '../assets/import';
import { MAX_DURATION, MIN_DURATION, MIN_HOLD_SECONDS, STOP_MOTION_RATES, type Slide, type StopMotionRate } from '../render';
import type { Action } from '../state/project';

interface Props {
  slide: Slide;
  dispatch: Dispatch<Action>;
  onFiles: (files: File[]) => void;
  disabled: boolean;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Inspector({ slide, dispatch, onFiles, disabled }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragImage, setDragImage] = useState<number | null>(null);
  const update = (patch: Partial<Slide>) => dispatch({ type: 'update', id: slide.id, patch });
  const effect = (key: keyof Slide['effects'], label: string) => (
    <label className="check">
      <input type="checkbox" checked={slide.effects[key]}
        onChange={(e) => update({ effects: { ...slide.effects, [key]: e.target.checked } })} />
      {label}
    </label>
  );

  return (
    <aside className="inspector" aria-label="Slide settings">
      <fieldset disabled={disabled}>
        <section>
          <h2>Screenshots</h2>
          <div
            className={`dropzone ${dragOver ? 'over' : ''}`}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files')) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onFiles(Array.from(e.dataTransfer.files));
            }}
            onClick={() => fileInput.current?.click()}
          >
            Drop PNG / JPG screenshots here, or click to choose
            <input ref={fileInput} type="file" accept={ACCEPTED_TYPES.join(',')} multiple hidden
              data-testid="file-input"
              onChange={(e) => {
                onFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }} />
          </div>
          {slide.images.length > 0 && (
            <ol className="images">
              {slide.images.map((im, i) => (
                <li key={im.id} draggable
                  onDragStart={() => setDragImage(i)}
                  onDragOver={(e) => dragImage !== null && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragImage !== null) dispatch({ type: 'moveImage', id: slide.id, from: dragImage, to: i });
                    setDragImage(null);
                  }}
                  onDragEnd={() => setDragImage(null)}>
                  <span className="order">{i + 1}</span>
                  {imageUrl(im.id) ? <img src={imageUrl(im.id)} alt="" /> : <span className="missing" />}
                  <span className="name" title={im.name}>{im.name}</span>
                  <button type="button" title="Move up" disabled={i === 0}
                    onClick={() => dispatch({ type: 'moveImage', id: slide.id, from: i, to: i - 1 })}>↑</button>
                  <button type="button" title="Move down" disabled={i === slide.images.length - 1}
                    onClick={() => dispatch({ type: 'moveImage', id: slide.id, from: i, to: i + 1 })}>↓</button>
                  <button type="button" title="Remove"
                    onClick={() => dispatch({ type: 'removeImage', id: slide.id, imageId: im.id })}>✕</button>
                </li>
              ))}
            </ol>
          )}
          <div className="row">
            <Field label="Scaling">
              <select value={slide.fit} onChange={(e) => update({ fit: e.target.value as Slide['fit'] })}>
                <option value="fit">Fit (never crop)</option>
                <option value="fill">Fill (crop to frame)</option>
              </select>
            </Field>
            <label className="check">
              <input type="checkbox" checked={slide.cutoutBorder}
                onChange={(e) => update({ cutoutBorder: e.target.checked })} />
              White cutout border
            </label>
          </div>
        </section>

        <section>
          <h2>Text</h2>
          <Field label="Title">
            <textarea rows={2} value={slide.title} data-testid="title-input"
              onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="Subtitle">
            <textarea rows={2} value={slide.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
          </Field>
          <div className="row">
            <Field label="Style">
              <select value={slide.textStyle} onChange={(e) => update({ textStyle: e.target.value as Slide['textStyle'] })}>
                <option value="label">Paper label</option>
                <option value="plain">Plain</option>
              </select>
            </Field>
            <Field label="Colour">
              <input type="color" value={slide.textColor} onChange={(e) => update({ textColor: e.target.value })} />
            </Field>
          </div>
        </section>

        <section>
          <h2>Motion</h2>
          <Field label={`Duration: ${slide.duration}s`} hint={`The finished slide holds for at least ${MIN_HOLD_SECONDS}s.`}>
            <input type="range" min={MIN_DURATION} max={MAX_DURATION} step={0.5} value={slide.duration}
              onChange={(e) => update({ duration: Number(e.target.value) })} />
          </Field>
          <Field label="Stop-motion rate" hint="Output is always 30 fps; the scene changes this often.">
            <select value={slide.stopMotionFps}
              onChange={(e) => update({ stopMotionFps: Number(e.target.value) as StopMotionRate })}>
              {STOP_MOTION_RATES.map((r) => (
                <option key={r} value={r}>
                  {r} fps{r === 30 ? ' (smooth)' : r === 15 ? ' (on twos)' : r === 12 ? ' (classic)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <div className="row">
            <Field label="Seed">
              <input type="number" min={0} max={4294967295} value={slide.seed}
                onChange={(e) => update({ seed: Number(e.target.value) >>> 0 })} />
            </Field>
            <button type="button" className="reshuffle" onClick={() => dispatch({ type: 'reshuffle', id: slide.id })}>
              Reshuffle
            </button>
          </div>
        </section>

        <section>
          <h2>Look</h2>
          <div className="row">
            <Field label="Background">
              <input type="color" value={slide.background} onChange={(e) => update({ background: e.target.value })} />
            </Field>
            {effect('paper', 'Paper texture')}
          </div>
          <div className="checks">
            {effect('grain', 'Film grain')}
            {effect('vignette', 'Vignette')}
            {effect('flicker', 'Exposure flicker')}
          </div>
        </section>
      </fieldset>
    </aside>
  );
}
