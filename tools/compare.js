// node compare.js <dir> name...  -> <dir>/compare.jpg (before | after rows)
const sharp = require('sharp'); const path = require('path');
const [dir, ...names] = process.argv.slice(2); const W = 700, H = 525;
(async () => {
  const comps = [];
  for (const [i, n] of names.entries()) for (const [j, s] of ['-before', ''].entries())
    comps.push({ input: await sharp(path.join(dir, n + s + '.jpg')).resize(W, H, { fit: 'cover' }).toBuffer(), left: j * (W + 10), top: i * (H + 10) });
  await sharp({ create: { width: W * 2 + 10, height: names.length * (H + 10), channels: 3, background: '#fff' } })
    .composite(comps).jpeg({ quality: 80 }).toFile(path.join(dir, 'compare.jpg'));
})();
