// Printable QR card for the nearby-directions page (site/guide/).
// Output: work/guide/guide-qr-card.png (A6, 300dpi) and guide-qr-a4.png (4 cards on A4 to cut).
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const sharp = require('sharp');

const URL = 'https://www.hoteloceanview.co.kr/guide/';
const OUT = path.join(__dirname, '../work/guide');
const W = 1240, H = 1748; // A6 @ 300dpi
const font = "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

(async () => {
  const qr = QRCode.create(URL, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size, size = 720, cell = size / n;
  const qx = (W - size) / 2, qy = 480;
  let rects = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    if (qr.modules.get(x, y)) rects += `<rect x="${(qx + x * cell).toFixed(2)}" y="${(qy + y * cell).toFixed(2)}" width="${(cell + .4).toFixed(2)}" height="${(cell + .4).toFixed(2)}"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fbf8f3"/>
  <rect width="${W}" height="330" fill="#12263a"/>
  <text x="${W/2}" y="110" text-anchor="middle" font-family="${font}" font-size="38" letter-spacing="14" fill="#c9a46a">HOTEL</text>
  <text x="${W/2}" y="185" text-anchor="middle" font-family="${font}" font-size="68" font-weight="700" letter-spacing="10" fill="#fff">OCEAN VIEW</text>
  <text x="${W/2}" y="270" text-anchor="middle" font-family="${font}" font-size="50" fill="#fff">호텔 주변 길안내 · Directions</text>
  <rect x="${qx - 70}" y="${qy - 70}" width="${size + 140}" height="${size + 140}" rx="36" fill="#fff" stroke="#e4ddd1" stroke-width="4"/>
  <g fill="#12263a">${rects}</g>
  <text x="${W/2}" y="1350" text-anchor="middle" font-family="${font}" font-size="58" font-weight="700" fill="#12263a">홈플러스  ·  대왕암공원</text>
  <text x="${W/2}" y="1425" text-anchor="middle" font-family="${font}" font-size="40" fill="#6b7178">도보 10분  ·  도보 20분</text>
  <text x="${W/2}" y="1560" text-anchor="middle" font-family="${font}" font-size="44" fill="#1d2329">휴대폰 카메라로 QR코드를 찍어보세요</text>
  <text x="${W/2}" y="1625" text-anchor="middle" font-family="${font}" font-size="36" fill="#6b7178">Scan with your phone camera</text>
</svg>`;

  fs.mkdirSync(OUT, { recursive: true });
  const card = await sharp(Buffer.from(svg)).png().withMetadata({ density: 300 }).toBuffer();
  fs.writeFileSync(path.join(OUT, 'guide-qr-card.png'), card);

  // A4 (2480x3508 @300dpi) with 4 cards and light cut lines
  const A4W = 2480, A4H = 3508;
  const lines = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${A4W}" height="${A4H}">
    <line x1="${A4W/2}" y1="0" x2="${A4W/2}" y2="${A4H}" stroke="#bbb" stroke-width="3" stroke-dasharray="20 16"/>
    <line x1="0" y1="${A4H/2}" x2="${A4W}" y2="${A4H/2}" stroke="#bbb" stroke-width="3" stroke-dasharray="20 16"/></svg>`);
  const ox = (A4W / 2 - W) / 2, oy = (A4H / 2 - H) / 2;
  const pos = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([c, r]) => ({ input: card, left: Math.round(c * A4W / 2 + ox), top: Math.round(r * A4H / 2 + oy) }));
  await sharp({ create: { width: A4W, height: A4H, channels: 3, background: '#fff' } })
    .composite([...pos, { input: lines, left: 0, top: 0 }])
    .png().withMetadata({ density: 300 }).toFile(path.join(OUT, 'guide-qr-a4.png'));
  console.log('done:', URL);
})();
