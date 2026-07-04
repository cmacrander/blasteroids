// Generates placeholder part sprites as PNGs using only Node built-ins.
// Each sprite is a square drawn in canonical orientation (facing north / up);
// the renderer rotates per part at draw time. Replace with real art by dropping
// PNGs of the same names into client/public/sprites and deleting this script.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const size = 64;
const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "sprites",
);

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function blank() {
  return Buffer.alloc(size * size * 4);
}

function set(rgba, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function eachPixel(rgba, predicate, color) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (predicate(x, y)) set(rgba, x, y, color);
    }
  }
}

// Draws the shared square body with a darker border and returns the buffer.
function body(base, border) {
  const rgba = blank();
  const inset = 3;
  eachPixel(
    rgba,
    (x, y) => x >= inset && y >= inset && x < size - inset && y < size - inset,
    border,
  );
  const b = inset + 3;
  eachPixel(
    rgba,
    (x, y) => x >= b && y >= b && x < size - b && y < size - b,
    base,
  );
  return rgba;
}

const center = (size - 1) / 2;

const sprites = {
  // core: centered diamond
  core: () => {
    const rgba = body([74, 85, 104, 255], [45, 55, 72, 255]);
    eachPixel(
      rgba,
      (x, y) => Math.abs(x - center) + Math.abs(y - center) <= 13,
      [226, 232, 240, 255],
    );
    return rgba;
  },
  // power: centered filled circle
  power: () => {
    const rgba = body([133, 100, 4, 255], [87, 65, 2, 255]);
    eachPixel(
      rgba,
      (x, y) => (x - center) ** 2 + (y - center) ** 2 <= 13 ** 2,
      [246, 224, 94, 255],
    );
    return rgba;
  },
  // engine: exhaust nozzle flaring open toward the canonical-north edge
  engine: () => {
    const rgba = body([124, 45, 18, 255], [87, 30, 12, 255]);
    eachPixel(
      rgba,
      (x, y) => y <= 30 && Math.abs(x - center) <= 6 + (30 - y) * 0.7,
      [237, 137, 54, 255],
    );
    return rgba;
  },
  // laser: emitter triangle pointing out the front (north) edge
  laser: () => {
    const rgba = body([6, 111, 131, 255], [4, 74, 87, 255]);
    eachPixel(
      rgba,
      (x, y) => y <= 30 && Math.abs(x - center) <= (y - 6) * 0.6,
      [79, 209, 197, 255],
    );
    return rgba;
  },
};

mkdirSync(outDir, { recursive: true });
for (const [name, draw] of Object.entries(sprites)) {
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, encodePng(draw()));
  console.log(`wrote ${file}`);
}
