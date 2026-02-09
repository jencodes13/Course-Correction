import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/**
 * Extract individual page images from a PDF file.
 * Returns an array of JPEG data URLs, one per page.
 */
export async function extractPdfPageImages(
  fileData: string,
  options?: { scale?: number; quality?: number; maxPages?: number }
): Promise<string[]> {
  const { scale = 1.5, quality = 0.8, maxPages = 50 } = options || {};

  // Convert base64 data URL to Uint8Array
  const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const numPages = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', quality));

    // Clean up
    canvas.width = 0;
    canvas.height = 0;
  }

  return images;
}
