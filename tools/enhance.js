// Usage: node enhance.js <srcDir> <outDir> <name=file[:wb=0.3]> [...]
//   wb overrides white-balance strength per photo (use 0 for outdoor shots with lots of sky).
// Auto-enhances hotel photos with one consistent "house look":
//   partial gray-world white balance (removes yellow/green casts, keeps some warmth),
//   percentile levels stretch, gentle shadow lift, a touch of saturation, light sharpen.
// Writes <name>.jpg (2000px, for the site) and <name>-before.jpg (for comparison).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [srcDir, outDir, ...pairs] = process.argv.slice(2);
const WB_STRENGTH = 0.45;  // 0 = no correction, 1 = full gray-world
const WARMTH = 1.02;       // red boost / blue cut after WB, for a warm hotel feel
const MAX = 2000;

async function enhance(file, name, wb = WB_STRENGTH) {
  const src = path.join(srcDir, file);
  const base = sharp(src).rotate().resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true });
  const buf = await base.clone().toBuffer();
  const { channels } = await sharp(buf).stats();
  const [r, g, b] = channels.map(c => c.mean);
  const gray = (r + g + b) / 3;
  const gain = [r, g, b].map(m => 1 + wb * (gray / m - 1));
  if (wb > 0) { gain[0] *= WARMTH; gain[2] /= WARMTH; }

  // Brightness: aim the mean luminance toward ~125 (never darken; capped so night shots stay moody).
  const lum = 0.299 * r * gain[0] + 0.587 * g * gain[1] + 0.114 * b * gain[2];
  const lift = Math.min(1.35, Math.max(1, 125 / lum));

  await sharp(buf)
    .linear(gain.map(x => x * lift), [0, 0, 0])
    .normalise({ lower: 0.3, upper: 99.8 })
    .gamma(1.05)
    .modulate({ saturation: 1.08 })
    .sharpen({ sigma: 0.8 })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(outDir, `${name}.jpg`));
  await sharp(buf).jpeg({ quality: 82 }).toFile(path.join(outDir, `${name}-before.jpg`));
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const p of pairs) {
    const [name, spec] = p.split(/=(.*)/s);
    const [file, opt] = spec.split(':');
    const wb = opt && opt.startsWith('wb=') ? Number(opt.slice(3)) : undefined;
    await enhance(file, name, wb);
    console.log('ok', name);
  }
})();
