// Trims the hotel OV mark (transparent margins) and writes site/images/email-mark.png (2x for retina).
const sharp = require('sharp');
const path = require('path');
const src = process.argv[2];
(async () => {
  const trimmed = await sharp(src).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  console.log('trimmed', trimmed.info.width, trimmed.info.height);
  // sample the gold colour near the top-left inside the rounded square
  const { data, info } = await sharp(trimmed.data).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * info.channels; return Array.from(data.slice(i, i + 3)); };
  const g = px(Math.round(info.width * 0.2), Math.round(info.height * 0.15));
  console.log('gold #' + g.map(v => v.toString(16).padStart(2, '0')).join(''));
  await sharp(trimmed.data).resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(__dirname, '../site/images/email-mark.png'));
  console.log('ok');
})();
