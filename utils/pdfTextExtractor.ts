import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { PageClassification, ExtractedPageData } from '../types';

// Worker is already configured in pdfPageRenderer.ts — just ensure it's set
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
}

interface TextLine {
  text: string;
  fontSize: number;
  y: number;
}

/**
 * Extract text content from each page of a PDF and classify pages.
 * Returns structured page data with title, subtitle, bullets, and classification.
 */
export async function extractPdfPageText(
  fileData: string,
  options?: { maxPages?: number }
): Promise<ExtractedPageData[]> {
  const { maxPages = 50 } = options || {};

  // Convert base64 data URL to Uint8Array
  const base64 = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const numPages = Math.min(pdf.numPages, maxPages);
  const pages: ExtractedPageData[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;
    const pageWidth = viewport.width;

    // Filter to actual text items (not markers)
    const textItems = textContent.items.filter(
      (item): item is TextItem => 'str' in item && item.str.trim().length > 0
    );

    if (textItems.length === 0) {
      pages.push({
        pageNumber: pageNum,
        classification: 'INFOGRAPHIC',
        title: '',
        subtitle: '',
        bullets: [],
        textDensityScore: 0,
      });
      continue;
    }

    // Group items into lines by Y position (items within 3px are on same line)
    const lineMap = new Map<number, { text: string; fontSize: number; items: TextItem[] }>();

    for (const item of textItems) {
      const y = Math.round(item.transform[5]); // Y position
      const fontSize = Math.abs(item.transform[0]); // approximate font size from transform matrix

      // Find an existing line within 3px
      let matchedY: number | null = null;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) < 3) {
          matchedY = existingY;
          break;
        }
      }

      if (matchedY !== null) {
        const line = lineMap.get(matchedY)!;
        line.text += ' ' + item.str;
        line.items.push(item);
        line.fontSize = Math.max(line.fontSize, fontSize);
      } else {
        lineMap.set(y, { text: item.str, fontSize, items: [item] });
      }
    }

    // Sort lines by Y position (top to bottom — PDF Y is inverted, larger = higher)
    const lines: TextLine[] = Array.from(lineMap.entries())
      .sort(([yA], [yB]) => yB - yA) // descending Y = top-to-bottom
      .map(([y, data]) => ({
        text: data.text.trim(),
        fontSize: data.fontSize,
        y,
      }))
      .filter(l => l.text.length > 0);

    // Calculate text density: total text area / page area
    const totalTextChars = lines.reduce((sum, l) => sum + l.text.length, 0);
    const textDensityScore = Math.min(100, Math.round((totalTextChars / (pageWidth * pageHeight / 100)) * 100));

    // Classify the page
    const classification = classifyPage(lines, textItems.length, textDensityScore);

    // Extract structure
    const { title, subtitle, bullets } = extractStructure(lines);

    pages.push({
      pageNumber: pageNum,
      classification,
      title,
      subtitle,
      bullets,
      textDensityScore,
    });
  }

  return pages;
}

/**
 * Classify a page based on its text characteristics.
 */
function classifyPage(
  lines: TextLine[],
  totalItems: number,
  textDensityScore: number
): PageClassification {
  // TITLE page: 1-3 lines, typically large font, very sparse
  if (lines.length <= 3 && totalItems < 10) {
    return 'TITLE';
  }

  // INFOGRAPHIC: very few text items or very low text density
  // These are pages dominated by images, charts, diagrams
  if (totalItems < 8 || textDensityScore < 3) {
    return 'INFOGRAPHIC';
  }

  // Everything else with substantial text is TEXT_HEAVY
  return 'TEXT_HEAVY';
}

/**
 * Extract title, subtitle, and bullet points from sorted text lines.
 */
function extractStructure(lines: TextLine[]): {
  title: string;
  subtitle: string;
  bullets: string[];
} {
  if (lines.length === 0) {
    return { title: '', subtitle: '', bullets: [] };
  }

  // Find the largest font size to identify the title
  const maxFontSize = Math.max(...lines.map(l => l.fontSize));

  // Title: first line with the largest (or near-largest) font
  let titleIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].fontSize >= maxFontSize * 0.85) {
      titleIndex = i;
      break;
    }
  }

  const title = lines[titleIndex]?.text || '';

  // Subtitle: the next line after the title if it has a distinctly smaller font
  let subtitle = '';
  let bulletStartIndex = titleIndex + 1;

  if (titleIndex + 1 < lines.length) {
    const nextLine = lines[titleIndex + 1];
    // If the next line is noticeably smaller than the title but larger than body text
    if (nextLine.fontSize < maxFontSize * 0.85 && nextLine.fontSize > maxFontSize * 0.5) {
      subtitle = nextLine.text;
      bulletStartIndex = titleIndex + 2;
    }
  }

  // Bullets: remaining lines, cleaned up
  const bullets = lines
    .slice(bulletStartIndex)
    .map(l => cleanBulletText(l.text))
    .filter(b => b.length > 2); // filter out tiny fragments

  return { title, subtitle, bullets };
}

/**
 * Clean bullet text by removing common bullet markers.
 */
function cleanBulletText(text: string): string {
  return text
    .replace(/^[\s]*[•●○◦▪▸►\-–—]\s*/, '') // Remove bullet markers
    .replace(/^\d+[.)]\s*/, '') // Remove numbered list markers
    .trim();
}
