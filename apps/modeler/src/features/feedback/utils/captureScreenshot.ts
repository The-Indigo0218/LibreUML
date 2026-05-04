import { useStageStore } from '../../../canvas/store/stageStore';

const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
const JPEG_QUALITY = 0.7;
const MAX_BYTES = 500 * 1024; // 500 KB

/**
 * Captures the active Konva canvas, downscales to ≤ 1280×720, and encodes as
 * JPEG 0.7 quality.  Returns null when no stage is mounted (e.g. welcome screen).
 */
export async function captureCanvasScreenshot(): Promise<string | null> {
  const stage = useStageStore.getState().stage;
  if (!stage) return null;

  // Grab the full canvas PNG from Konva
  const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Compute scaled dimensions preserving aspect ratio
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }

      ctx.drawImage(img, 0, 0, width, height);

      // Try JPEG at the target quality; reduce if still over the byte cap
      let quality = JPEG_QUALITY;
      let result = canvas.toDataURL('image/jpeg', quality);

      // Each base64 char ≈ 0.75 bytes; account for the "data:…;base64," prefix
      const byteLength = (result.length - result.indexOf(',') - 1) * 0.75;
      if (byteLength > MAX_BYTES) {
        // Reduce quality until it fits
        while (quality > 0.1) {
          quality = Math.round((quality - 0.1) * 10) / 10;
          result = canvas.toDataURL('image/jpeg', quality);
          const newBytes = (result.length - result.indexOf(',') - 1) * 0.75;
          if (newBytes <= MAX_BYTES) break;
        }
      }

      resolve(result);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Strip the "data:image/jpeg;base64," prefix to get a bare base64 string. */
export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] ?? '';
}
