/**
 * Image cover-crop utility for PowerPoint generation.
 *
 * pptxgenjs v4.0.1 has a bug where `sizing: { type: 'cover' }` doesn't work
 * for base64 images (it uses display dimensions instead of natural image dimensions,
 * resulting in zero crop and full stretch — photos get distorted).
 *
 * This module pre-processes images using a canvas:
 * 1. Loads the base64 image to get its natural dimensions
 * 2. Draws it with "cover" behavior (scale to fill, center, crop overflow)
 * 3. Returns a new base64 string with the correct aspect ratio
 *
 * PowerPoint then displays this pre-cropped image 1:1 — no stretching.
 *
 * Note: Uses regular canvas (not OffscreenCanvas) so the browser
 * auto-applies EXIF orientation, matching what the user sees in the app.
 */

const DPI = 150;
const INCHES_TO_PX = DPI;

interface CoverCropOptions {
  targetW: number;
  targetH: number;
  format?: 'jpeg' | 'png';
  quality?: number;
}

export async function coverCropImage(
  base64DataUrl: string,
  options: CoverCropOptions
): Promise<string> {
  const { targetW, targetH, format = 'jpeg', quality = 0.92 } = options;

  const img = await loadImage(base64DataUrl);

  const canvasW = Math.round(targetW * INCHES_TO_PX);
  const canvasH = Math.round(targetH * INCHES_TO_PX);

  // Calculate cover crop (same logic as CSS object-fit: cover)
  const imgRatio = img.naturalHeight / img.naturalWidth;
  const boxRatio = canvasH / canvasW;

  let drawW: number, drawH: number, drawX: number, drawY: number;

  if (boxRatio > imgRatio) {
    drawW = canvasW;
    drawH = canvasW * imgRatio;
    drawX = 0;
    drawY = (canvasH - drawH) / 2;
  } else {
    drawH = canvasH;
    drawW = canvasH / imgRatio;
    drawX = (canvasW - drawW) / 2;
    drawY = 0;
  }

  // Always use regular canvas (not OffscreenCanvas) so the browser
  // auto-applies EXIF orientation, matching what the user sees in the app.
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(mimeType, quality);
}

export async function maybeCoverCropImage(
  base64DataUrl: string | null,
  options: CoverCropOptions
): Promise<string | null> {
  if (!base64DataUrl) return null;
  try {
    return await coverCropImage(base64DataUrl, options);
  } catch (err) {
    console.warn('[coverCrop] Failed to process image, using original:', err);
    return base64DataUrl;
  }
}

export async function coverCropImages(
  images: Array<{ data: string | null; targetW: number; targetH: number }>,
  format?: 'jpeg' | 'png',
  quality?: number
): Promise<(string | null)[]> {
  return Promise.all(
    images.map((img) =>
      maybeCoverCropImage(img.data, { targetW: img.targetW, targetH: img.targetH, format, quality })
    )
  );
}

// --- Helpers ---

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export interface ImageInfo {
  width: number;
  height: number;
  isPortrait: boolean;
}

export async function getImageInfo(base64DataUrl: string): Promise<ImageInfo> {
  const img = await loadImage(base64DataUrl);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    isPortrait: img.naturalHeight > img.naturalWidth,
  };
}
