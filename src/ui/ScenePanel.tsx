import type { Dispatch } from 'react';
import { PROP_KINDS, SCENES, type Prop, type PropKind, type SceneKind, type Slide } from '../render';
import type { Action } from '../state/project';

const SCENE_NAMES: Record<SceneKind, string> = {
  none: 'None (plain background)',
  sky: 'Sky and clouds',
  icefjord: 'Icefjord',
  town: 'Coastal town',
  'mountain-town': 'Town under a mountain',
  snowfield: 'Snowfield',
  aurora: 'Aurora night',
  room: 'Room with a view',
  canal: 'Canal houses',
  shopfront: 'Vintage shop',
};

interface Props {
  slide: Slide;
  dispatch: Dispatch<Action>;
}

/** Backdrop, how the slide opens, and the story props. */
export function ScenePanel({ slide, dispatch }: Props) {
  const update = (patch: Partial<Slide>) => dispatch({ type: 'update', id: slide.id, patch });
  const setProp = (i: number, patch: Partial<Prop>) =>
    update({ props: slide.props.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  return (
    <section>
      <h2>Scene</h2>
      <div className="row">
        <label className="field">
          <span className="label">Backdrop</span>
          <select value={slide.scene} data-testid="scene-select" onChange={(e) => update({ scene: e.target.value as SceneKind })}>
            {SCENES.map((s) => <option key={s} value={s}>{SCENE_NAMES[s]}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">Opening</span>
          <select value={slide.intro} onChange={(e) => update({ intro: e.target.value as Slide['intro'] })}>
            <option value="drop">Toss everything in</option>
            <option value="settled">Start settled</option>
          </select>
        </label>
      </div>
      <p className="hint">“Start settled” opens on the finished scene (for slides that continue a story); only props drop in.</p>
      <ol className="props">
        {slide.props.map((p, i) => (
          <li key={i}>
            <div className="prop-head">
              <select value={p.kind} aria-label="Prop" onChange={(e) => setProp(i, { kind: e.target.value as PropKind })}>
                {PROP_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <select value={p.layer} aria-label="Layer" onChange={(e) => setProp(i, { layer: e.target.value as Prop['layer'] })}>
                <option value="back">behind</option>
                <option value="front">in front</option>
              </select>
              <button type="button" title="Remove prop" onClick={() => update({ props: slide.props.filter((_, j) => j !== i) })}>✕</button>
            </div>
            {p.kind !== 'snow' && (
              <div className="prop-sliders">
                <label>x<input type="range" min={0} max={1} step={0.01} value={p.x} onChange={(e) => setProp(i, { x: Number(e.target.value) })} /></label>
                <label>y<input type="range" min={0} max={1} step={0.01} value={p.y} onChange={(e) => setProp(i, { y: Number(e.target.value) })} /></label>
                <label>size<input type="range" min={0.2} max={2} step={0.05} value={p.scale} onChange={(e) => setProp(i, { scale: Number(e.target.value) })} /></label>
                <label className="check"><input type="checkbox" checked={!!p.flip} onChange={(e) => setProp(i, { flip: e.target.checked })} />mirror</label>
                <label className="check"><input type="checkbox" checked={!!p.still} onChange={(e) => setProp(i, { still: e.target.checked })} />part of the set</label>
              </div>
            )}
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => update({ props: [...slide.props, { kind: 'iceberg', x: 0.5, y: 0.6, scale: 1, layer: 'back' }] })}>
        + Prop
      </button>
    </section>
  );
}
