/** Generated stand-in "headline screenshots" (used by the dev harness and the demo button). */
export async function placeholderScreenshot(index: number, width = 1200, height = 630): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const hues = [8, 205, 140, 42, 280];
  const hue = hues[index % hues.length];
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = `hsl(${hue} 55% 45%)`;
  ctx.fillRect(0, 0, width, 70);
  ctx.fillStyle = '#fff';
  ctx.font = '700 34px sans-serif';
  ctx.fillText('THE DAILY PLACEHOLDER', 32, 47);
  ctx.fillStyle = '#111';
  ctx.font = '800 64px sans-serif';
  ctx.fillText(`Headline number ${index + 1}`, 32, 170);
  ctx.fillText('ąčęėįšųūž in the news', 32, 250);
  ctx.fillStyle = `hsl(${hue} 30% 85%)`;
  ctx.fillRect(32, 300, width * 0.45, height - 340);
  ctx.fillStyle = '#999';
  for (let i = 0; i < 6; i++) ctx.fillRect(width * 0.5, 310 + i * 44, width * 0.45 - (i % 3) * 60, 22);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}
