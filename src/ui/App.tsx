import { useCallback, useEffect, useReducer, useState } from 'react';
import { loadFonts } from '../assets/fonts';
import { lookupAsset } from '../assets/images';
import { importImageFiles, settleImports } from '../assets/import';
import { checkEncoderSupport, encodeSlide, type SupportResult } from '../export/encoder';
import { downloadBytes, slideFileName, zipVideos } from '../export/zip';
import type { Slide } from '../render';
import { loadNewsDemo } from '../demo';
import { collectGarbage, hasSavedProject, loadProject, resetStorage, saveProject } from '../state/persist';
import { freshProject, reducer } from '../state/project';
import type { ExportState } from './exportState';
import { Inspector } from './Inspector';
import { Preview } from './Preview';
import { SlideList } from './SlideList';

export function App() {
  const [project, dispatch] = useReducer(reducer, undefined, freshProject);
  const [loaded, setLoaded] = useState(false);
  const [assetsVersion, setAssetsVersion] = useState(0);
  const [support, setSupport] = useState<SupportResult | null>(null);
  const [exports, setExports] = useState<Record<string, ExportState>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // fonts and images must be ready before the first frame is drawn
  useEffect(() => {
    (async () => {
      await loadFonts();
      // first visit: open the AI-news demo built from headline screenshots
      const demo = hasSavedProject() ? null : await loadNewsDemo().catch(() => null);
      dispatch({ type: 'load', project: demo ?? (await loadProject()) });
      setAssetsVersion((v) => v + 1);
      setLoaded(true);
    })().catch((e) => setNotice(`Could not load the saved project: ${e}`));
    checkEncoderSupport().then(setSupport);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveProject(project);
    const t = setTimeout(() => collectGarbage(project).catch(console.warn), 2000);
    return () => clearTimeout(t);
  }, [project, loaded]);

  const slide = project.slides.find((s) => s.id === project.selectedId) ?? project.slides[0];

  const onFiles = useCallback(
    async (files: File[]) => {
      const images = await importImageFiles(files);
      if (images.length < files.length) setNotice('Some files were skipped: only PNG, JPG and WebP images are supported.');
      if (images.length) {
        dispatch({ type: 'addImages', id: slide.id, images });
        settleImports(images);
        setAssetsVersion((v) => v + 1);
      }
    },
    [slide.id],
  );

  const setExport = (id: string, state: ExportState) => setExports((prev) => ({ ...prev, [id]: state }));

  async function encode(s: Slide): Promise<Uint8Array> {
    setExport(s.id, { status: 'running', progress: 0 });
    try {
      const bytes = await encodeSlide(s, lookupAsset, {
        onProgress: (progress) => setExport(s.id, { status: 'running', progress }),
      });
      setExport(s.id, { status: 'done', progress: 1 });
      return bytes;
    } catch (e) {
      setExport(s.id, { status: 'error', progress: 1, error: String(e) });
      throw e;
    }
  }

  async function exportSlides(targets: Slide[], asZip: boolean) {
    setBusy(true);
    setNotice(null);
    setExports(Object.fromEntries(targets.map((s) => [s.id, { status: 'queued', progress: 0 } as ExportState])));
    try {
      await loadFonts();
      if (asZip) {
        const videos: Uint8Array[] = [];
        for (const s of targets) videos.push(await encode(s));
        downloadBytes(zipVideos(videos), 'carousel.zip', 'application/zip');
      } else {
        const s = targets[0];
        downloadBytes(await encode(s), slideFileName(project.slides.indexOf(s)), 'video/mp4');
      }
    } catch (e) {
      setNotice(`Export failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadDemo() {
    if (!confirm('Replace the current project with the AI news demo?')) return;
    await resetStorage();
    const demo = await loadNewsDemo();
    if (!demo) return setNotice('The demo files could not be loaded.');
    dispatch({ type: 'load', project: demo });
    setAssetsVersion((v) => v + 1);
    setExports({});
  }

  async function newProject() {
    if (!confirm('Start a new project? This removes all slides and images.')) return;
    await resetStorage();
    dispatch({ type: 'new' });
    setExports({});
  }

  const canExport = loaded && !busy && support?.ok === true;
  const ex = exports[slide.id];

  return (
    <div className="app">
      <header>
        <h1>Stop-motion carousel</h1>
        <div className="header-actions">
          <button type="button" onClick={loadDemo} disabled={busy}>AI news demo</button>
          <button type="button" onClick={newProject} disabled={busy}>New project</button>
          <button type="button" data-testid="export-one" disabled={!canExport}
            onClick={() => exportSlides([slide], false)}>Export this slide</button>
          <button type="button" className="primary" data-testid="export-all" disabled={!canExport}
            onClick={() => exportSlides(project.slides, true)}>
            Export all slides ({project.slides.length})
          </button>
        </div>
      </header>
      {support && !support.ok && <div className="banner error" role="alert">{support.reason}</div>}
      {notice && (
        <div className="banner" role="status">
          {notice} <button type="button" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}
      <main>
        <SlideList slides={project.slides} selectedId={slide.id} dispatch={dispatch}
          assetsVersion={assetsVersion} exports={exports} busy={busy} />
        <section className="center">
          {loaded ? <Preview slide={slide} assetsVersion={assetsVersion} /> : <p className="loading">Loading…</p>}
          {ex && ex.status !== 'idle' && (
            <div className={`export-status ${ex.status}`} data-testid="export-status" data-status={ex.status}>
              <div className="progress"><div style={{ width: `${Math.round(ex.progress * 100)}%` }} /></div>
              <span>{ex.status === 'error' ? ex.error : ex.status === 'done' ? 'Exported' : `${Math.round(ex.progress * 100)}%`}</span>
            </div>
          )}
        </section>
        <Inspector slide={slide} dispatch={dispatch} onFiles={onFiles} disabled={busy || !loaded} />
      </main>
    </div>
  );
}
