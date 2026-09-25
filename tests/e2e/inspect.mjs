// Reads an MP4 back with Mediabunny's input API (and ffprobe/ffmpeg when
// available) and checks it against the Instagram output spec.
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny';
import { execFileSync } from 'node:child_process';

export async function inspectMp4(bytes) {
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
  const format = await input.getFormat();
  const track = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  const stats = await track.computePacketStats();
  return {
    format: format.name,
    mimeType: await input.getMimeType(),
    codec: track.codec,
    codecString: await track.getCodecParameterString(),
    width: track.displayWidth,
    height: track.displayHeight,
    duration: await input.computeDuration(),
    fps: stats.averagePacketRate,
    frames: stats.packetCount,
    bitrate: stats.averageBitrate,
    hasAudio: !!audio,
    firstTimestamp: await track.getFirstTimestamp(),
  };
}

/** Throws with every violated expectation listed. */
export function assertSpec(info, { duration }) {
  const problems = [];
  if (info.codec !== 'avc') problems.push(`codec ${info.codec} != avc`);
  // avc1.PPCCLL: PP = 64 → High profile
  if (!/^avc1\.64/i.test(info.codecString ?? '')) problems.push(`codec string ${info.codecString} is not High profile`);
  if (info.width !== 1080 || info.height !== 1350) problems.push(`size ${info.width}x${info.height}`);
  if (Math.abs(info.fps - 30) > 0.01) problems.push(`fps ${info.fps}`);
  if (Math.abs(info.duration - duration) > 0.04) problems.push(`duration ${info.duration} != ${duration}`);
  if (info.frames !== Math.round(duration * 30)) problems.push(`frames ${info.frames}`);
  if (info.hasAudio) problems.push('has an audio track');
  if (info.firstTimestamp !== 0) problems.push(`first timestamp ${info.firstTimestamp}`);
  if (problems.length) throw new Error(`MP4 spec check failed:\n  ${problems.join('\n  ')}`);
}

/** ffprobe if present, else `ffmpeg -i` stream line. Null when neither exists. */
export function ffprobeSummary(file) {
  const ffprobe = process.env.FFPROBE ?? 'ffprobe';
  try {
    return execFileSync(ffprobe, ['-v', 'error', '-show_entries',
      'stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_frames:format=duration,format_name',
      '-of', 'compact', file], { encoding: 'utf8' }).trim();
  } catch {}
  const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
  try {
    execFileSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    const text = String(e.stderr ?? '');
    if (!text.includes('Stream')) return null;
    return text.split('\n').filter((l) => /Duration|Stream/.test(l)).map((l) => l.trim()).join('\n');
  }
  return null;
}
