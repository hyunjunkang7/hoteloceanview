// Usage: node contact-sheet.js <photoDir> <outDir>
// Builds numbered contact sheets (4x3 thumbnails) so photos can be reviewed quickly.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [srcDir, outDir] = process.argv.slice(2);
const files = fs.readdirSync(srcDir).filter(f => /\.(jpe?g|png|heic|webp)$/i.test(f)).sort();
const W = 400, H = 300, COLS = 4, ROWS = 3, LABEL = 28;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const index = [];
  for (let s = 0; s * COLS * ROWS < files.length; s++) {
    const chunk = files.slice(s * COLS * ROWS, (s + 1) * COLS * ROWS);
    const tiles = await Promise.all(chunk.map(async (f, i) => {
      const n = s * COLS * ROWS + i + 1;
      index.push(`${n}\t${f}`);
      const img = await sharp(path.join(srcDir, f)).rotate().resize(W, H - LABEL, { fit: 'contain', background: '#222' }).toBuffer();
      const label = Buffer.from(`<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#000"/><text x="8" y="20" font-size="18" fill="#fff" font-family="Arial">#${n}</text></svg>`);
      return { img, label, i };
    }));
    const composites = [];
    for (const t of tiles) {
      const x = (t.i % COLS) * W, y = Math.floor(t.i / COLS) * H;
      composites.push({ input: t.label, left: x, top: y });
      composites.push({ input: t.img, left: x, top: y + LABEL });
    }
    await sharp({ create: { width: W * COLS, height: H * ROWS, channels: 3, background: '#111' } })
      .composite(composites).jpeg({ quality: 80 }).toFile(path.join(outDir, `sheet-${s + 1}.jpg`));
  }
  fs.writeFileSync(path.join(outDir, 'index.tsv'), index.join('\n'));
  for (const f of files) {
    const m = await sharp(path.join(srcDir, f)).metadata();
    console.log(f, m.width + 'x' + m.height, m.orientation || '');
  }
})();
