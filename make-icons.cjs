// One-off icon generator (PNG, RGBA, with 4x supersampling). Run with: node make-icons.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

function roundedRect(px, py, x, y, w, h, r) {
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  return Math.hypot(px - cx, py - cy) <= r;
}

function make(size) {
  const SS = 4;
  const S = size * SS;
  const hi = new Uint8Array(S * S * 4);
  const green = [22, 134, 79];
  const r = S * 0.18;
  const thickness = S * 0.075;
  const halfThickness = thickness / 2 / S;

  const segs = [
    [0.44, 0.31, 0.25, 0.50],
    [0.25, 0.50, 0.44, 0.69],
    [0.56, 0.31, 0.75, 0.50],
    [0.75, 0.50, 0.56, 0.69],
    [0.57, 0.24, 0.43, 0.76],
  ];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      if (!roundedRect(x + 0.5, y + 0.5, 0, 0, S, S, r)) continue;
      let color = green;
      const px = x / S;
      const py = y / S;
      if (segs.some((s) => distToSeg(px, py, ...s) <= halfThickness)) color = [255, 255, 255];
      hi[i] = color[0];
      hi[i + 1] = color[1];
      hi[i + 2] = color[2];
      hi[i + 3] = 255;
    }
  }

  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      let rr = 0, gg = 0, bb = 0, aa = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = (((y * SS + sy) * S) + (x * SS + sx)) * 4;
          const a = hi[i + 3] / 255;
          rr += hi[i] * a;
          gg += hi[i + 1] * a;
          bb += hi[i + 2] * a;
          aa += hi[i + 3];
        }
      }
      const n = SS * SS;
      const out = row + 1 + x * 4;
      raw[out] = Math.round(rr / n / (aa / n / 255 || 1));
      raw[out + 1] = Math.round(gg / n / (aa / n / 255 || 1));
      raw[out + 2] = Math.round(bb / n / (aa / n / 255 || 1));
      raw[out + 3] = Math.round(aa / n);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, 'icons');
fs.mkdirSync(dir, { recursive: true });
[16, 48, 128].forEach((s) => {
  const file = path.join(dir, `icon${s}.png`);
  fs.writeFileSync(file, make(s));
  console.log('wrote', file);
});
