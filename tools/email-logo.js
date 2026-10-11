// Renders the email-signature logo (PNG, 2x for retina) into site/images/email-logo.png
const sharp = require('sharp');
const W = 440, H = 120;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="14" fill="#12263a"/>
  <path d="M28 82c16 12 30 12 48 0s32-12 48 0" fill="none" stroke="#c9a46a" stroke-width="5" stroke-linecap="round"/>
  <text x="76" y="56" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" fill="#fff">OV</text>
  <line x1="150" y1="24" x2="150" y2="96" stroke="#2f4a63" stroke-width="2"/>
  <text x="172" y="52" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="24" fill="#c9a46a">Hotel</text>
  <text x="172" y="88" font-family="Georgia, 'Times New Roman', serif" font-size="32" letter-spacing="5" fill="#ffffff">OCEAN VIEW</text>
</svg>`;
sharp(Buffer.from(svg), { density: 144 }).resize(W, H).png().toFile(require('path').join(__dirname, '../site/images/email-logo.png'))
  .then(i => console.log('ok', i.width, i.height, i.size));
