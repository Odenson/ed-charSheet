// ui/portrait-image.js — client-side portrait processing (plans/add-char-portrait).
// DOM-side and OUTSIDE engine/*: the pure helpers (validate, fit, output choice,
// filename) are unit-tested; the canvas decode/encode defaults are browser-only
// and injectable (`decode` / `encode`) so `processImage` is node-testable.
//
// Limits are product decisions (spec "Build-time decisions"): source <= 10 MB of
// JPEG/PNG/WebP, longest side <= 1024, JPEG q0.85 (PNG when transparent), stored
// blob <= 1,000,000 bytes (shrink ladder 1024 -> 768 -> 512 until it fits).

export const MAX_STORED_BYTES = 1_000_000;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_SIDE = 1024;
export const JPEG_QUALITY = 0.85;
const LADDER = [1024, 768, 512];
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/** `{ ok:true }` or `{ ok:false, error }` for a picked file's `{ type, size }`. */
export function validateImageFile({ type, size } = {}) {
  if (!ACCEPTED.includes(type)) return { ok: false, error: 'Choose a JPEG, PNG or WebP image.' };
  if (!(size <= MAX_SOURCE_BYTES)) return { ok: false, error: 'That image is larger than 10 MB. Choose a smaller one.' };
  return { ok: true };
}

/** Scale (w, h) so the longest side is at most `max`; never upscales; rounds; min 1. */
export function fitWithin(w, h, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** PNG when the picture has transparency, else JPEG at the standard quality. */
export function chooseOutput(hasAlpha) {
  return hasAlpha
    ? { mime: 'image/png', ext: 'png', quality: undefined }
    : { mime: 'image/jpeg', ext: 'jpg', quality: JPEG_QUALITY };
}

export const portraitFilename = (charId, now, ext) => `${charId}-${now}.${ext}`;
export const portraitPath = (filename) => `data/${filename}`;

/**
 * Validate, decode, downscale and encode a picked file. Resolves
 * `{ path, filename, mime, ext, dataUrl, width, height, bytes }`; rejects with an
 * Error whose message is user-facing. `decode(file) -> { width, height, hasAlpha }`
 * and `encode(decoded, { width, height, mime, quality }) -> { dataUrl, bytes }` are
 * injectable seams (defaults: createImageBitmap + canvas).
 */
export async function processImage(file, { charId, now = Date.now(), decode = browserDecode, encode = browserEncode } = {}) {
  const valid = validateImageFile(file);
  if (!valid.ok) throw new Error(valid.error);

  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error('Could not read that image. Try a different file.');
  }

  const out = chooseOutput(!!decoded.hasAlpha);
  for (const side of LADDER) {
    const { width, height } = fitWithin(decoded.width, decoded.height, side);
    let enc;
    try {
      enc = await encode(decoded, { width, height, mime: out.mime, quality: out.quality });
    } catch {
      throw new Error('Could not process that image. Try a different file.');
    }
    if (enc.bytes <= MAX_STORED_BYTES) {
      const filename = portraitFilename(charId, now, out.ext);
      return { path: portraitPath(filename), filename, mime: out.mime, ext: out.ext, dataUrl: enc.dataUrl, width, height, bytes: enc.bytes };
    }
  }
  throw new Error('Image is too detailed to store; try a simpler image');
}

// --- browser defaults (canvas; not unit-tested) ------------------------------------------------

async function browserDecode(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return { bitmap, width: bitmap.width, height: bitmap.height, hasAlpha: file.type !== 'image/jpeg' && sampleHasAlpha(bitmap) };
}

// Alpha detection: draw a downsampled copy and look for any pixel with alpha < 255.
function sampleHasAlpha(bitmap) {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, 128);
  const ctx = makeCanvas(width, height).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  const px = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 255) return true;
  return false;
}

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

async function browserEncode(decoded, { width, height, mime, quality }) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#fff'; // JPEG has no alpha; never composite onto black
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(decoded.bitmap, 0, 0, width, height);
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: mime, quality })
    : await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob || blob.type !== mime) throw new Error('encode failed');
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return { dataUrl, bytes: blob.size };
}
