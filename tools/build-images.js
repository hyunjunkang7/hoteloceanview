// Usage: node build-images.js <photoDir> <siteImgDir>
// Enhances the selected photos and writes web-ready WebP files (1600px + 800px) for the site.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const A = 'KakaoTalk_20261011_114435793', B = 'KakaoTalk_20261011_115325175';
// name: [file, white-balance strength (0 = leave colours alone)]
const PHOTOS = {
  'exterior':        [`${A}_27.jpg`, 0],
  'exterior-2':      [`${B}_10.jpg`, 0],
  'lobby':           [`${B}_09.jpg`, 0.25],
  'room-balcony':    [`${A}_21.jpg`, 0.3],
  'room-double':     [`${A}_25.jpg`, 0.3],
  'room-double-2':   [`${A}_23.jpg`, 0.3],
  'room-double-3':   [`${A}_24.jpg`, 0.3],
  'room-twin':       [`${A}_26.jpg`, 0.45],
  'room-twin-2':     [`${A}_02.jpg`, 0.45],
  'restaurant':      [`${A}_06.jpg`, 0.45],
  'restaurant-2':    [`${A}_07.jpg`, 0.45],
  'lounge':          [`${A}_16.jpg`, 0.45],
  'lounge-2':        [`${A}_18.jpg`, 0.45],
  'lounge-3':        [`${A}_15.jpg`, 0.45],
  'meeting':         [`${A}_09.jpg`, 0.35],
  'food-steak':      [`${B}_07.jpg`, 0.2],
  'food-western':    [`${B}_06.jpg`, 0.2],
  'food-indian':     [`${A}_10.jpg`, 0.2],
  'food-lunchbox':   [`${B}_04.jpg`, 0.2],
};

async function enhanced(src, wb) {
  const buf = await sharp(src).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).toBuffer();
  const [r, g, b] = (await sharp(buf).stats()).channels.map(c => c.mean);
  const gray = (r + g + b) / 3;
  const gain = [r, g, b].map(m => 1 + wb * (gray / m - 1));
  if (wb > 0) { gain[0] *= 1.02; gain[2] /= 1.02; }
  const lum = 0.299 * r * gain[0] + 0.587 * g * gain[1] + 0.114 * b * gain[2];
  const lift = Math.min(1.35, Math.max(1, 125 / lum));
  return sharp(buf)
    .linear(gain.map(x => x * lift), [0, 0, 0])
    .normalise({ lower: 0.3, upper: 99.8 })
    .gamma(1.05)
    .modulate({ saturation: 1.08 })
    .sharpen({ sigma: 0.8 })
    .toBuffer();
}

(async () => {
  const [srcDir, outDir] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, [file, wb]] of Object.entries(PHOTOS)) {
    const img = await enhanced(path.join(srcDir, file), wb);
    await sharp(img).webp({ quality: 78 }).toFile(path.join(outDir, `${name}.webp`));
    await sharp(img).resize(800).webp({ quality: 74 }).toFile(path.join(outDir, `${name}-sm.webp`));
    console.log('ok', name);
  }
})();
