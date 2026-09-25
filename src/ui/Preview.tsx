import { useEffect, useRef, useState } from 'react';
import { lookupAsset } from '../assets/images';
import { drawFrame, FPS, HEIGHT, totalFrames, WIDTH, type Slide } from '../render';

interface Props {
  slide: Slide;
  /** Bumped when images finish decoding, so the frame is redrawn. */
  assetsVersion: number;
}

/** The live preview: the same drawFrame the exporter uses, driven by requestAnimationFrame. */
export function Preview({ slide, assetsVersion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const frames = totalFrames(slide);
  const current = Math.min(frame, frames - 1);

  // playback clock
  useEffect(() => {
    if (!playing) return;
    const startFrame = current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setFrame((startFrame + Math.floor(((now - t0) / 1000) * FPS)) % frames);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only on play/length change
  }, [playing, frames]);

  // draw whenever the frame or the slide changes
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawFrame(ctx, slide, current, lookupAsset);
  }, [slide, current, assetsVersion]);

  return (
    <div className="preview">
      <div className="stage">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} data-testid="preview-canvas" />
      </div>
      <div className="transport">
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={frames - 1}
          value={current}
          aria-label="Scrub"
          onChange={(e) => {
            setPlaying(false);
            setFrame(Number(e.target.value));
          }}
        />
        <span className="time">
          {(current / FPS).toFixed(2)}s / {(frames / FPS).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
