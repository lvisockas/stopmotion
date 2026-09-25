import { BufferTarget, EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output } from 'mediabunny';
import { I420_COLOR_SPACE, i420Size, rgbaToI420 } from './yuv';
import { drawFrame, FPS, HEIGHT, totalFrames, WIDTH, type AssetLookup, type Slide } from '../render';

export const TARGET_BITRATE = 8_000_000;
/** A keyframe every 2 s: cheap seeking, and what Instagram's own encodes use. */
const KEYFRAME_INTERVAL = FPS * 2;

/**
 * H.264 High profile, most conservative level first. 1080×1350@30 needs
 * 5 780 macroblocks/frame and ~173k MB/s, inside Level 4.0 (8 192 / 245 760).
 */
const HIGH_PROFILE_CODECS = ['avc1.640028', 'avc1.64002a', 'avc1.640032'];

export function encoderConfig(codec: string, bitrate = TARGET_BITRATE): VideoEncoderConfig {
  return {
    codec,
    width: WIDTH,
    height: HEIGHT,
    bitrate,
    bitrateMode: 'variable',
    framerate: FPS,
    latencyMode: 'quality',
    // 'avc' = length-prefixed NALUs + avcC description, which is what MP4 wants
    avc: { format: 'avc' },
  };
}

export type SupportResult = { ok: true; codec: string } | { ok: false; reason: string };

let supportPromise: Promise<SupportResult> | null = null;

/** Probes (once) for an H.264 High profile encoder via VideoEncoder.isConfigSupported. */
export function checkEncoderSupport(): Promise<SupportResult> {
  supportPromise ??= (async (): Promise<SupportResult> => {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
      return {
        ok: false,
        reason:
          'This browser has no WebCodecs video encoder, so it cannot export MP4 files. Please use a current Chrome, Edge or Safari.',
      };
    }
    for (const codec of HIGH_PROFILE_CODECS) {
      try {
        const { supported } = await VideoEncoder.isConfigSupported(encoderConfig(codec));
        if (supported) return { ok: true, codec };
      } catch {
        // malformed-for-this-browser config: try the next one
      }
    }
    return {
      ok: false,
      reason:
        'This browser cannot encode H.264 (High profile) video, which Instagram needs. Please use a current Chrome, Edge or Safari.',
    };
  })();
  return supportPromise;
}

export interface EncodeOptions {
  /** Defaults to TARGET_BITRATE (Instagram quality); lower it for size-capped destinations. */
  bitrate?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

function makeContext(): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  // every frame is read back for the YUV conversion
  const options = { alpha: false, willReadFrequently: true };
  if (typeof OffscreenCanvas !== 'undefined') {
    const ctx = new OffscreenCanvas(WIDTH, HEIGHT).getContext('2d', options);
    if (ctx) return ctx;
  }
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return canvas.getContext('2d', options) as CanvasRenderingContext2D;
}

/**
 * Renders every frame of `slide` with drawFrame and encodes it offline
 * (as fast as the encoder allows, not in real time). Returns the MP4 bytes.
 */
export async function encodeSlide(slide: Slide, assets: AssetLookup, opts: EncodeOptions = {}): Promise<Uint8Array> {
  const support = await checkEncoderSupport();
  if (!support.ok) throw new Error(support.reason);

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new EncodedVideoPacketSource('avc');
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  let failure: unknown = null;
  // packets must reach the muxer in decode order; chain the async adds
  let muxing: Promise<void> = Promise.resolve();
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxing = muxing.then(() => source.add(EncodedPacket.fromEncodedChunk(chunk), meta));
      muxing.catch((e) => (failure ??= e));
    },
    error: (e) => (failure ??= e),
  });
  encoder.configure(encoderConfig(support.codec, opts.bitrate));

  const ctx = makeContext();
  const yuv = new Uint8Array(i420Size(WIDTH, HEIGHT));
  const frames = totalFrames(slide);
  const frameDuration = 1e6 / FPS;
  try {
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      if (failure) throw failure;
      drawFrame(ctx, slide, i, assets);
      rgbaToI420(ctx.getImageData(0, 0, WIDTH, HEIGHT).data, WIDTH, HEIGHT, yuv);
      const frame = new VideoFrame(yuv, {
        format: 'I420',
        codedWidth: WIDTH,
        codedHeight: HEIGHT,
        timestamp: Math.round(i * frameDuration),
        duration: Math.round(frameDuration),
        colorSpace: I420_COLOR_SPACE,
      });
      encoder.encode(frame, { keyFrame: i % KEYFRAME_INTERVAL === 0 });
      frame.close();
      // backpressure: don't let the encoder queue (and memory) run away
      while (encoder.encodeQueueSize > 6) {
        await new Promise<void>((resolve) => encoder.addEventListener('dequeue', () => resolve(), { once: true }));
      }
      if (i % 5 === 0) {
        opts.onProgress?.(i / frames);
        // let the page paint the progress bar
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await encoder.flush();
    await muxing;
    if (failure) throw failure;
    await output.finalize();
  } catch (e) {
    if (encoder.state !== 'closed') encoder.close();
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
    throw e;
  }
  if (encoder.state !== 'closed') encoder.close();
  opts.onProgress?.(1);
  if (!target.buffer) throw new Error('Muxer produced no output');
  return new Uint8Array(target.buffer);
}
