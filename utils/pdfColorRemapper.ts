/**
 * Recolor a slide image by remapping its grayscale spectrum to a new theme.
 *
 * How it works:
 * - White/light pixels (backgrounds) → theme background color
 * - Black/dark pixels (text) → theme text color
 * - Gray pixels (borders, shadows) → proportional blend between theme bg/text
 * - Colorful pixels (images, diagrams, code highlights) → preserved as-is
 *
 * This produces a dramatic visual transformation while keeping all
 * images, diagrams, and colored elements intact.
 */

interface RGB { r: number; g: number; b: number }

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 128, g: 128, b: 128 };
}

export async function recolorSlideImage(
  imageDataUrl: string,
  backgroundColor: string,
  textColor: string,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageDataUrl); return; }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = imageData.data;

      const bg = hexToRgb(backgroundColor);
      const txt = hexToRgb(textColor);

      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;

        // Colorful pixels (images, diagrams, colored code) — preserve them
        if (saturation > 0.18) continue;

        // Desaturated (grayscale) pixels: remap to theme spectrum
        // lightness 1.0 (white bg) → theme bg
        // lightness 0.0 (black text) → theme text color
        const lightness = (max + min) / 510; // 0–1
        px[i]     = Math.round(txt.r + (bg.r - txt.r) * lightness);
        px[i + 1] = Math.round(txt.g + (bg.g - txt.g) * lightness);
        px[i + 2] = Math.round(txt.b + (bg.b - txt.b) * lightness);
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

/**
 * Recolor multiple slide images in parallel.
 */
export async function recolorSlideImages(
  imageDataUrls: string[],
  backgroundColor: string,
  textColor: string,
): Promise<string[]> {
  return Promise.all(
    imageDataUrls.map(url => recolorSlideImage(url, backgroundColor, textColor))
  );
}
