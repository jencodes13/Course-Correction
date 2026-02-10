import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  RefreshCw,
  Download,
  FileText,
  BookOpen,
  Presentation,
  HelpCircle,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Lock,
  Brain,
  Sparkles,
} from 'lucide-react';
import PptxGenJS from 'pptxgenjs';
import {
  DemoResult,
  ExtractedPageData,
  GeneratedTheme,
  IngestedFile,
} from '../types';
import { generateStudyGuide, StudyGuideSection, generateQuizQuestions, QuizQuestion as AIQuizQuestion, GeneratedSlide } from '../services/geminiService';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface VisualOutputProps {
  result: DemoResult;
  pageImages: string[];
  extractedPages: ExtractedPageData[];
  generatedTheme: GeneratedTheme | null;
  selectedSector: string;
  location: string;
  topic: string;
  files: IngestedFile[];
  onReset: () => void;
  preGeneratedStudyGuide?: StudyGuideSection[];
  preGeneratedQuiz?: AIQuizQuestion[];
  preGeneratedSlides?: GeneratedSlide[];
  slideVerification?: {
    totalSourcePages: number;
    pagesReferenced: number;
    coveragePercentage: number;
    missingTopics?: string[];
  } | null;
  disclaimer?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type VisualTab = 'document' | 'study-guide' | 'slides' | 'quiz';

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

/** Convert #hex to RRGGBB for pptxgenjs */
function hexToRgb(hex: string): string {
  return hex.replace('#', '').slice(0, 6);
}

/** Determine if a hex color is light */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

// ────────────────────────────────────────────────────────────────────────────
// Download Helpers
// ────────────────────────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mimeType = 'text/html') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateStudyGuideHTML(
  guideSections: StudyGuideSection[],
  theme: GeneratedTheme | null,
  topic: string,
  sector: string,
): string {
  const primary = theme?.primaryColor || '#2563eb';
  const font = theme?.fontSuggestion || 'Inter';

  const sectionHtml = guideSections
    .map((section, idx) => {
      return `
        <section style="margin-bottom: 2.5rem; page-break-inside: avoid;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: ${primary}18; color: ${primary}; font-weight: 700; font-size: 13px;">
              ${idx + 1}
            </span>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: #1a1a1a; margin: 0; line-height: 1.3;">
              ${section.title}
            </h2>
          </div>
          <p style="color: #6b7280; font-size: 0.875rem; margin: 0 0 1rem 2.75rem;">${section.summary}</p>
          <div style="margin-left: 2.75rem; border-left: 3px solid ${primary}; padding-left: 1rem;">
            ${section.keyPoints.map((kp, ki) => `
              <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span style="color: ${primary}; font-weight: 700; font-size: 0.75rem; flex-shrink: 0;">${ki + 1}.</span>
                <p style="margin: 0; color: #374151; font-size: 0.9rem; line-height: 1.6;">${kp}</p>
              </div>
            `).join('')}
          </div>
          <div style="margin: 1rem 0 0 2.75rem; background: ${primary}08; border: 1px solid ${primary}20; border-radius: 8px; padding: 0.75rem 1rem;">
            <p style="margin: 0; font-size: 0.8rem; color: ${primary}; font-weight: 600;">Key Takeaway</p>
            <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: #374151;">${section.takeaway}</p>
          </div>
        </section>
      `;
    }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${topic || 'Study Guide'} — CourseCorrect Study Guide</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: '${font}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0; padding: 2rem; background: #f8f7f4; color: #1a1a1a;
    max-width: 800px; margin-left: auto; margin-right: auto;
  }
  @media print {
    body { background: #fff; padding: 1rem; }
    section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <header style="margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 2px solid ${primary};">
    <p style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: ${primary}; margin: 0 0 0.5rem;">
      Study Guide
    </p>
    <h1 style="font-size: 2rem; font-weight: 800; color: #1a1a1a; margin: 0 0 0.5rem; line-height: 1.2;">
      ${topic || 'Course Materials'}
    </h1>
    <p style="color: #6b7280; font-size: 0.875rem; margin: 0;">
      ${sector} &middot; Generated ${new Date().toLocaleDateString()}
    </p>
  </header>

  ${sectionHtml}

  <footer style="margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #e5e2db; text-align: center;">
    <p style="font-size: 0.7rem; color: #9a9385;">
      Generated by CourseCorrect &middot; coursecorrect.ai
    </p>
  </footer>
</body>
</html>`;
}

function generateQuizHTML(
  questions: AIQuizQuestion[],
  topic: string,
  sector: string,
): string {
  const questionsJson = JSON.stringify(questions);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${topic || 'Quiz'} — CourseCorrect Quiz</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f7f4; color: #1a1a1a; padding: 2rem; }
  .container { max-width: 640px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 2rem; }
  .header h1 { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem; }
  .header p { color: #6b7280; font-size: 0.85rem; }
  .progress { height: 6px; background: #e5e2db; border-radius: 3px; margin-bottom: 2rem; overflow: hidden; }
  .progress-bar { height: 100%; background: #c8956c; transition: width 0.3s; border-radius: 3px; }
  .question-card { background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e5e2db; margin-bottom: 1rem; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
  .badge-fb { background: #dbeafe; color: #2563eb; }
  .badge-tf { background: #fef3c7; color: #d97706; }
  .badge-mc { background: #ede9fe; color: #7c3aed; }
  .question-text { font-size: 1rem; line-height: 1.6; white-space: pre-line; margin-bottom: 1rem; }
  .option { display: block; width: 100%; text-align: left; padding: 0.75rem 1rem; border: 2px solid #e5e2db; border-radius: 8px; background: #fff; cursor: pointer; margin-bottom: 0.5rem; font-size: 0.9rem; transition: all 0.15s; }
  .option:hover { border-color: #c8956c; background: #fdf8f4; }
  .option.selected { border-color: #c8956c; background: #c8956c10; }
  .option.correct { border-color: #059669; background: #ecfdf5; }
  .option.incorrect { border-color: #dc2626; background: #fef2f2; }
  .tf-buttons { display: flex; gap: 0.75rem; }
  .tf-btn { flex: 1; padding: 1rem; border: 2px solid #e5e2db; border-radius: 8px; background: #fff; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.15s; }
  .tf-btn:hover { border-color: #c8956c; }
  .tf-btn.selected { border-color: #c8956c; background: #c8956c10; }
  .tf-btn.correct { border-color: #059669; background: #ecfdf5; }
  .tf-btn.incorrect { border-color: #dc2626; background: #fef2f2; }
  .blank-input { padding: 0.5rem 0.75rem; border: 2px solid #e5e2db; border-radius: 6px; font-size: 0.9rem; width: 100%; max-width: 300px; }
  .blank-input:focus { outline: none; border-color: #c8956c; }
  .check-btn { padding: 0.6rem 1.5rem; background: #c8956c; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; margin-top: 0.75rem; }
  .check-btn:hover { background: #a87550; }
  .check-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .feedback { padding: 0.75rem 1rem; border-radius: 8px; margin-top: 0.75rem; font-size: 0.85rem; line-height: 1.5; }
  .feedback-correct { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .feedback-incorrect { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .nav { display: flex; justify-content: space-between; margin-top: 1.5rem; }
  .nav-btn { padding: 0.5rem 1.25rem; border: 1px solid #e5e2db; border-radius: 8px; background: #fff; cursor: pointer; font-size: 0.85rem; }
  .nav-btn:hover { background: #f5f5f0; }
  .results { text-align: center; padding: 3rem 1rem; }
  .results h2 { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem; }
  .score { font-size: 3rem; font-weight: 800; color: #c8956c; margin: 1rem 0; }
  .retake { padding: 0.75rem 2rem; background: #c8956c; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1rem; margin-top: 1rem; }
  .retake:hover { background: #a87550; }
  .footer { text-align: center; margin-top: 2rem; font-size: 0.7rem; color: #9a9385; }
</style>
</head>
<body>
<div class="container" id="app"></div>
<script>
const questions = ${questionsJson};
let current = 0;
let answers = {};
let checked = {};
let score = 0;
let showResults = false;

function render() {
  const app = document.getElementById('app');
  if (showResults) {
    const pct = Math.round((score / questions.length) * 100);
    app.innerHTML = \`
      <div class="results">
        <h2>Quiz Complete!</h2>
        <p style="color:#6b7280">${topic || 'Course'} — ${sector}</p>
        <div class="score">\${pct}%</div>
        <p style="color:#6b7280">\${score} of \${questions.length} correct</p>
        <button class="retake" onclick="retake()">Retake Quiz</button>
      </div>
      <div class="footer">Generated by CourseCorrect</div>
    \`;
    return;
  }
  const q = questions[current];
  const pct = ((current) / questions.length) * 100;
  const isChecked = checked[q.id];
  const userAnswer = answers[q.id] || '';
  const badgeClass = q.type === 'fill-blank' ? 'badge-fb' : q.type === 'true-false' ? 'badge-tf' : 'badge-mc';
  const badgeLabel = q.type === 'fill-blank' ? 'Fill in the Blank' : q.type === 'true-false' ? 'True / False' : 'Multiple Choice';

  let inputHtml = '';
  if (q.type === 'fill-blank') {
    inputHtml = \`<input class="blank-input" type="text" placeholder="Type your answer..." value="\${userAnswer}" oninput="setAnswer(this.value)" \${isChecked ? 'disabled' : ''} />\`;
  } else if (q.type === 'true-false') {
    inputHtml = '<div class="tf-buttons">' + q.options.map(o => {
      let cls = 'tf-btn';
      if (userAnswer === o) cls += ' selected';
      if (isChecked && o === q.correctAnswer) cls += ' correct';
      if (isChecked && userAnswer === o && o !== q.correctAnswer) cls += ' incorrect';
      return \`<button class="\${cls}" onclick="setAnswer('\${o}')" \${isChecked ? 'disabled' : ''}>\${o}</button>\`;
    }).join('') + '</div>';
  } else {
    inputHtml = q.options.map(o => {
      let cls = 'option';
      if (userAnswer === o) cls += ' selected';
      if (isChecked && o === q.correctAnswer) cls += ' correct';
      if (isChecked && userAnswer === o && o !== q.correctAnswer) cls += ' incorrect';
      return \`<button class="\${cls}" onclick="setAnswer('\${encodeURIComponent(o)}')" \${isChecked ? 'disabled' : ''}>\${o}</button>\`;
    }).join('');
  }

  let feedbackHtml = '';
  if (isChecked) {
    const isCorrect = q.type === 'fill-blank'
      ? userAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()
      : userAnswer === q.correctAnswer;
    feedbackHtml = \`<div class="feedback \${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
      \${isCorrect ? '✓ Correct!' : '✗ Incorrect.'} \${q.explanation}
    </div>\`;
  }

  app.innerHTML = \`
    <div class="header">
      <h1>${topic || 'Course'} Quiz</h1>
      <p>Question \${current + 1} of \${questions.length}</p>
    </div>
    <div class="progress"><div class="progress-bar" style="width:\${pct}%"></div></div>
    <div class="question-card">
      <span class="badge \${badgeClass}">\${badgeLabel}</span>
      <div class="question-text">\${q.question}</div>
      \${inputHtml}
      \${!isChecked ? '<button class="check-btn" onclick="checkAnswer()" ' + (!userAnswer ? 'disabled' : '') + '>Check Answer</button>' : ''}
      \${feedbackHtml}
    </div>
    <div class="nav">
      <button class="nav-btn" onclick="prev()" \${current === 0 ? 'disabled style="opacity:0.3"' : ''}>← Previous</button>
      <button class="nav-btn" onclick="next()">\${current === questions.length - 1 ? 'See Results' : 'Next →'}</button>
    </div>
    <div class="footer">Generated by CourseCorrect</div>
  \`;
}

function setAnswer(val) {
  const q = questions[current];
  if (checked[q.id]) return;
  if (q.type === 'multiple-choice') val = decodeURIComponent(val);
  answers[q.id] = val;
  render();
}

function checkAnswer() {
  const q = questions[current];
  checked[q.id] = true;
  const isCorrect = q.type === 'fill-blank'
    ? (answers[q.id] || '').toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()
    : answers[q.id] === q.correctAnswer;
  if (isCorrect) score++;
  render();
}

function next() {
  if (current < questions.length - 1) { current++; render(); }
  else { showResults = true; render(); }
}

function prev() {
  if (current > 0) { current--; render(); }
}

function retake() {
  current = 0; answers = {}; checked = {}; score = 0; showResults = false; render();
}

render();
</script>
</body>
</html>`;
}

async function generatePptx(
  pages: ExtractedPageData[],
  slides: DemoResult['slides'],
  theme: GeneratedTheme | null,
  topic: string,
  sector: string,
) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"

  const primary = theme?.primaryColor || '#2563eb';
  const secondary = theme?.secondaryColor || '#64748b';
  const bg = theme?.backgroundColor || '#ffffff';
  const textColor = theme?.textColor || '#1a1a1a';
  const mutedText = theme?.mutedTextColor || '#6b7280';
  const font = theme?.fontSuggestion || 'Arial';
  const bgIsLight = isLightColor(bg);

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: hexToRgb(primary) };
  // Accent bar
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.4, h: '100%',
    fill: { color: hexToRgb(secondary) },
  });
  titleSlide.addText(topic || 'Course Materials', {
    x: 1.2, y: 1.5, w: 10, h: 2,
    fontSize: 36, fontFace: font, color: 'FFFFFF',
    bold: true,
  });
  titleSlide.addText(sector, {
    x: 1.2, y: 3.5, w: 10, h: 0.8,
    fontSize: 18, fontFace: font, color: 'FFFFFF',
    transparency: 30,
  });
  titleSlide.addText(`Generated ${new Date().toLocaleDateString()}`, {
    x: 1.2, y: 4.3, w: 10, h: 0.6,
    fontSize: 12, fontFace: font, color: 'FFFFFF',
    transparency: 50,
  });

  // Content slides
  const contentPages = pages.filter(p => p.bullets.length > 0 || p.title);
  for (let i = 0; i < contentPages.length; i++) {
    const page = contentPages[i];
    const slide = pptx.addSlide();
    slide.background = { color: hexToRgb(bg) };

    // Left accent line
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.08, h: '100%',
      fill: { color: hexToRgb(primary) },
    });

    // Section number
    slide.addText(`${String(i + 1).padStart(2, '0')}`, {
      x: 0.5, y: 0.4, w: 1, h: 0.6,
      fontSize: 14, fontFace: font,
      color: hexToRgb(primary), bold: true,
    });

    // Title
    slide.addText(page.title || `Section ${i + 1}`, {
      x: 0.5, y: 0.9, w: 12, h: 0.9,
      fontSize: 28, fontFace: font,
      color: hexToRgb(textColor), bold: true,
    });

    // Subtitle
    if (page.subtitle) {
      slide.addText(page.subtitle, {
        x: 0.5, y: 1.7, w: 12, h: 0.5,
        fontSize: 14, fontFace: font,
        color: hexToRgb(mutedText),
      });
    }

    // Accent line under title
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: page.subtitle ? 2.2 : 1.8, w: 2, h: 0.04,
      fill: { color: hexToRgb(primary) },
    });

    // Bullets
    const bulletY = page.subtitle ? 2.6 : 2.2;
    const bulletTexts = (page.bullets.length > 0 ? page.bullets : slides[i]?.after.bullets || [])
      .slice(0, 6)
      .map(b => ({
        text: b,
        options: {
          fontSize: 14,
          fontFace: font,
          color: hexToRgb(textColor),
          bullet: { type: 'bullet' as const, color: hexToRgb(primary) },
          paraSpaceAfter: 8,
        },
      }));

    if (bulletTexts.length > 0) {
      slide.addText(bulletTexts, {
        x: 0.7, y: bulletY, w: 11.5, h: 4.5,
        valign: 'top',
      });
    }

    // Footer
    slide.addText(`${sector}  |  ${topic || 'Course Materials'}`, {
      x: 0.5, y: 6.9, w: 8, h: 0.4,
      fontSize: 8, fontFace: font,
      color: hexToRgb(mutedText),
    });
    slide.addText(`${i + 1} / ${contentPages.length}`, {
      x: 11, y: 6.9, w: 2, h: 0.4,
      fontSize: 8, fontFace: font,
      color: hexToRgb(mutedText), align: 'right',
    });
  }

  // Closing slide
  const closingSlide = pptx.addSlide();
  closingSlide.background = { color: hexToRgb(bgIsLight ? primary : bg) };
  closingSlide.addText('Thank You', {
    x: 1, y: 2, w: 11, h: 2,
    fontSize: 40, fontFace: font,
    color: bgIsLight ? 'FFFFFF' : hexToRgb(textColor),
    bold: true, align: 'center',
  });
  closingSlide.addText('Generated by CourseCorrect', {
    x: 1, y: 4, w: 11, h: 1,
    fontSize: 14, fontFace: font,
    color: bgIsLight ? 'FFFFFF' : hexToRgb(mutedText),
    transparency: 40, align: 'center',
  });

  await pptx.writeFile({ fileName: `${(topic || 'course-slides').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60)}.pptx` });
}

// ────────────────────────────────────────────────────────────────────────────
// Tab Configuration
// ────────────────────────────────────────────────────────────────────────────

const tabConfig: { id: VisualTab; label: string; icon: React.ReactNode; downloadLabel: string }[] = [
  { id: 'document', label: 'Your Document', icon: <FileText className="w-4 h-4" />, downloadLabel: '' },
  { id: 'study-guide', label: 'Study Guide', icon: <BookOpen className="w-4 h-4" />, downloadLabel: 'Download Study Guide' },
  { id: 'slides', label: 'Slide Deck', icon: <Presentation className="w-4 h-4" />, downloadLabel: 'Download PowerPoint' },
  { id: 'quiz', label: 'Quiz Module', icon: <HelpCircle className="w-4 h-4" />, downloadLabel: 'Download Interactive Quiz' },
];

// ────────────────────────────────────────────────────────────────────────────
// Tab: Your Document
// ────────────────────────────────────────────────────────────────────────────

const DOC_PREVIEW_LIMIT = 3;

function YourDocumentTab({ pageImages }: { pageImages: string[] }) {
  if (pageImages.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(245,240,224,0.2)' }} />
        <p className="text-text-muted text-sm">No page images available.</p>
      </div>
    );
  }

  const previewPages = pageImages.slice(0, DOC_PREVIEW_LIMIT);
  const remainingCount = Math.max(0, pageImages.length - DOC_PREVIEW_LIMIT);
  const hasMore = remainingCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {pageImages.length} page{pageImages.length !== 1 ? 's' : ''} preserved at full fidelity
        </span>
      </div>
      {/* Visible preview pages */}
      {previewPages.map((img, idx) => (
        <div key={idx} className="relative rounded-xl overflow-hidden" style={{
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          <img
            src={img}
            alt={`Page ${idx + 1}`}
            className="w-full h-auto"
            style={{ background: '#fff' }}
          />
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-bold"
              style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(8px)' }}>
              {idx + 1}
            </span>
          </div>
        </div>
      ))}

      {/* Blurred teaser + lock overlay */}
      {hasMore && (
        <div className="relative">
          {/* Show next page blurred as teaser */}
          {pageImages[DOC_PREVIEW_LIMIT] && (
            <div className="rounded-xl overflow-hidden" style={{
              border: '1px solid rgba(255,255,255,0.06)',
              filter: 'blur(6px)',
              pointerEvents: 'none',
              userSelect: 'none',
              maxHeight: '300px',
              overflow: 'hidden',
            }}>
              <img
                src={pageImages[DOC_PREVIEW_LIMIT]}
                alt="Preview"
                className="w-full h-auto"
                style={{ background: '#fff' }}
              />
            </div>
          )}

          {/* Gradient fade */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, rgba(12,11,9,0) 0%, rgba(12,11,9,0.7) 40%, rgba(12,11,9,0.95) 70%)',
            pointerEvents: 'none',
          }} />

          {/* CTA overlay */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
            <button
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-bold text-sm transition-all transform hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #c8956c, #c8956ccc)',
                color: '#fff',
                boxShadow: '0 8px 30px rgba(200,149,108,0.4)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Lock className="w-4 h-4" />
              Unlock Full Document — {remainingCount} more page{remainingCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Study Guide (AI-powered)
// ────────────────────────────────────────────────────────────────────────────

const PREVIEW_SECTION_COUNT = 3;

function StudyGuideTab({
  topic,
  sector,
  files,
  theme,
  onSectionsLoaded,
  preGeneratedSections,
}: {
  topic: string;
  sector: string;
  files: IngestedFile[];
  theme: GeneratedTheme | null;
  onSectionsLoaded: (sections: StudyGuideSection[]) => void;
  preGeneratedSections?: StudyGuideSection[];
}) {
  const [sections, setSections] = useState<StudyGuideSection[]>(preGeneratedSections || []);
  const [loading, setLoading] = useState(!preGeneratedSections || preGeneratedSections.length === 0);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(!!preGeneratedSections && preGeneratedSections.length > 0);

  const primary = theme?.primaryColor || '#c8956c';
  const font = theme?.fontSuggestion || 'Inter';

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await generateStudyGuide(topic, sector, files);
        if (cancelled) return;
        setSections(result.sections);
        onSectionsLoaded(result.sections);
      } catch (err) {
        if (cancelled) return;
        console.error('Study guide generation failed:', err);
        setError('Unable to generate study guide. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, sector]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-xl overflow-hidden" style={{
        background: '#f8f7f4',
        border: '1px solid #e5e2db',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        {/* Header skeleton */}
        <div className="px-8 py-6" style={{ borderBottom: `3px solid ${primary}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 animate-pulse" style={{ color: primary }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: primary }}>
              AI Study Guide — Generating...
            </p>
          </div>
          <div className="h-7 w-64 rounded-md animate-pulse" style={{ background: '#e5e2db' }} />
          <div className="h-4 w-40 rounded-md mt-2 animate-pulse" style={{ background: '#ece9e1' }} />
        </div>

        {/* Skeleton cards */}
        <div className="px-8 py-6 space-y-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-7 h-7 rounded-lg" style={{ background: `${primary}18` }} />
                <div className="h-5 rounded-md" style={{ background: '#e5e2db', width: `${40 + i * 15}%` }} />
              </div>
              <div className="ml-10 mb-3">
                <div className="h-4 w-full rounded-md mb-2" style={{ background: '#ece9e1' }} />
                <div className="h-4 rounded-md mb-2" style={{ background: '#ece9e1', width: '85%' }} />
              </div>
              <div className="ml-10" style={{ borderLeft: `3px solid ${primary}30`, paddingLeft: '1rem' }}>
                {[1, 2, 3].map(j => (
                  <div key={j} className="flex items-baseline gap-2 mb-3">
                    <div className="w-4 h-4 rounded flex-shrink-0" style={{ background: `${primary}20` }} />
                    <div className="h-4 rounded-md" style={{ background: '#e5e2db', width: `${70 + j * 8}%` }} />
                  </div>
                ))}
              </div>
              <div className="ml-10 mt-3 h-16 rounded-lg" style={{ background: `${primary}06`, border: `1px solid ${primary}15` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error || sections.length === 0) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(245,240,224,0.2)' }} />
        <p className="text-text-muted text-sm">{error || 'No study guide content could be generated.'}</p>
        <p className="text-text-muted text-xs mt-1">Try uploading a document with more detailed content.</p>
      </div>
    );
  }

  const previewSections = sections.slice(0, PREVIEW_SECTION_COUNT);
  const remainingCount = Math.max(0, sections.length - PREVIEW_SECTION_COUNT);
  const hasMore = remainingCount > 0;

  return (
    <div>
      {/* Paper-style study guide */}
      <div className="rounded-xl overflow-hidden relative" style={{
        background: '#f8f7f4',
        border: '1px solid #e5e2db',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div className="px-8 py-6" style={{ borderBottom: `3px solid ${primary}` }}>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4" style={{ color: primary }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: primary }}>
              AI-Generated Study Guide
            </p>
          </div>
          <h3 className="text-2xl font-bold leading-tight" style={{ color: '#1a1a1a', fontFamily: `${font}, system-ui, sans-serif` }}>
            {topic || 'Course Materials'}
          </h3>
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
            {sector} &middot; {sections.length} section{sections.length !== 1 ? 's' : ''} &middot; {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Table of Contents */}
        <div className="px-8 py-4" style={{ background: '#f0ede5', borderBottom: '1px solid #e5e2db' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9a9385' }}>
            Contents
          </p>
          <div className="space-y-1">
            {sections.map((section, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm" style={{
                color: idx < PREVIEW_SECTION_COUNT ? '#4a4640' : '#b0aa9f',
              }}>
                <span className="font-semibold text-xs" style={{
                  color: idx < PREVIEW_SECTION_COUNT ? primary : '#c4beb4',
                }}>{idx + 1}.</span>
                <span>{section.title}</span>
                {idx >= PREVIEW_SECTION_COUNT && (
                  <Lock className="w-3 h-3 ml-1" style={{ color: '#c4beb4' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Visible sections */}
        <div className="px-8 py-6 space-y-8">
          {previewSections.map((section, idx) => (
            <div key={idx}>
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                  style={{ background: `${primary}18`, color: primary }}>
                  {idx + 1}
                </span>
                <h4 className="text-lg font-bold" style={{ color: '#1a1a1a', fontFamily: `${font}, system-ui, sans-serif` }}>
                  {section.title}
                </h4>
              </div>

              {/* Summary */}
              <p className="text-sm mb-3 ml-10" style={{ color: '#6b7280' }}>
                {section.summary}
              </p>

              {/* Key Points */}
              <div className="ml-10" style={{ borderLeft: `3px solid ${primary}`, paddingLeft: '1rem' }}>
                {section.keyPoints.map((kp, ki) => (
                  <div key={ki} className="flex items-baseline gap-2 mb-2">
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: primary }}>
                      {ki + 1}.
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{kp}</p>
                  </div>
                ))}
              </div>

              {/* Takeaway callout */}
              <div className="ml-10 mt-3 px-4 py-3 rounded-lg" style={{
                background: `${primary}08`, border: `1px solid ${primary}20`,
              }}>
                <p className="text-xs font-bold mb-0.5" style={{ color: primary }}>Key Takeaway</p>
                <p className="text-sm" style={{ color: '#374151' }}>{section.takeaway}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Blurred preview + CTA overlay for remaining sections */}
        {hasMore && (
          <div className="relative">
            {/* Teaser: show first locked section blurred */}
            <div className="px-8 pt-2 pb-24" style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none' }}>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                    style={{ background: `${primary}18`, color: primary }}>
                    {PREVIEW_SECTION_COUNT + 1}
                  </span>
                  <h4 className="text-lg font-bold" style={{ color: '#1a1a1a', fontFamily: `${font}, system-ui, sans-serif` }}>
                    {sections[PREVIEW_SECTION_COUNT]?.title || 'Next Section'}
                  </h4>
                </div>
                <p className="text-sm mb-3 ml-10" style={{ color: '#6b7280' }}>
                  {sections[PREVIEW_SECTION_COUNT]?.summary || 'Additional content available in the full study guide.'}
                </p>
                <div className="ml-10" style={{ borderLeft: `3px solid ${primary}`, paddingLeft: '1rem' }}>
                  {(sections[PREVIEW_SECTION_COUNT]?.keyPoints || ['Key point content', 'More key points', 'Additional details']).slice(0, 3).map((kp, ki) => (
                    <div key={ki} className="flex items-baseline gap-2 mb-2">
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: primary }}>
                        {ki + 1}.
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{kp}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(to bottom, rgba(248,247,244,0) 0%, rgba(248,247,244,0.6) 30%, rgba(248,247,244,0.95) 60%, #f8f7f4 100%)',
              pointerEvents: 'none',
            }} />

            {/* CTA button */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
              <button
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-bold text-sm transition-all transform hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${primary}, ${primary}cc)`,
                  color: '#fff',
                  boxShadow: `0 8px 30px ${primary}40`,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Lock className="w-4 h-4" />
                Unlock Full Study Guide — {remainingCount} more section{remainingCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-3 text-center" style={{ background: '#f0ede5', borderTop: '1px solid #e5e2db' }}>
          <p className="text-[10px]" style={{ color: '#9a9385' }}>
            Generated by CourseCorrect &middot; coursecorrect.ai
          </p>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Slide Deck
// ────────────────────────────────────────────────────────────────────────────

function SlidePreviewTab({
  pages,
  slides,
  theme,
  topic,
  sector,
  preGeneratedSlides,
  disclaimer,
}: {
  pages: ExtractedPageData[];
  slides: DemoResult['slides'];
  theme: GeneratedTheme | null;
  topic: string;
  sector: string;
  preGeneratedSlides?: GeneratedSlide[];
  disclaimer?: string;
}) {
  const primary = theme?.primaryColor || '#2563eb';
  const secondary = theme?.secondaryColor || '#64748b';
  const bg = theme?.backgroundColor || '#ffffff';
  const textColor = theme?.textColor || '#1a1a1a';
  const mutedText = theme?.mutedTextColor || '#6b7280';
  const font = theme?.fontSuggestion || 'Inter';
  const bgIsLight = isLightColor(bg);

  // Render an AI-generated slide
  const renderAISlide = (slide: GeneratedSlide, idx: number) => {
    const hasInfographic = !!slide.imageUrl;
    const totalSlides = preGeneratedSlides ? preGeneratedSlides.length : contentPages.length;

    return (
      <div key={`ai-${idx}`} className="rounded-xl overflow-hidden" style={{
        aspectRatio: '16 / 9',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div className="w-full h-full flex" style={{ background: bg }}>
          {/* Left accent bar */}
          <div style={{ width: '0.5%', background: primary }} />

          {/* Main content area */}
          <div className="flex-1 flex flex-col" style={{ padding: '3.5% 5%' }}>
            {/* Slide number */}
            <span style={{
              fontSize: 'clamp(9px, 1.1vw, 13px)', fontWeight: 700,
              color: primary, fontFamily: `${font}, system-ui, sans-serif`,
              marginBottom: '0.5%', letterSpacing: '0.05em',
            }}>
              {String(idx + 1).padStart(2, '0')}
            </span>

            {/* Title */}
            <h4 style={{
              fontSize: 'clamp(16px, 2.8vw, 32px)', fontWeight: 700,
              color: textColor, lineHeight: 1.15,
              fontFamily: `${font}, system-ui, sans-serif`,
            }}>
              {slide.title}
            </h4>

            {/* Subtitle */}
            {slide.subtitle && (
              <p style={{
                fontSize: 'clamp(9px, 1.2vw, 14px)', color: mutedText,
                fontFamily: `${font}, system-ui, sans-serif`, marginTop: '0.5%',
              }}>
                {slide.subtitle}
              </p>
            )}

            {/* Divider */}
            <div style={{
              width: '12%', height: 'clamp(2px, 0.3vw, 3px)',
              background: primary, margin: '1.5% 0',
            }} />

            {/* Key fact highlight */}
            {slide.keyFact && !hasInfographic && (
              <div style={{
                fontSize: 'clamp(16px, 2.8vw, 32px)', fontWeight: 800,
                color: primary, fontFamily: `${font}, system-ui, sans-serif`,
                marginBottom: '1.5%', lineHeight: 1.1,
              }}>
                {slide.keyFact}
              </div>
            )}

            {/* Content: infographic slide OR bullet slide */}
            {hasInfographic ? (
              <div style={{ flex: 1, display: 'flex', gap: '3%', overflow: 'hidden' }}>
                {/* Left: key fact + minimal bullets */}
                <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {slide.keyFact && (
                    <div style={{
                      fontSize: 'clamp(14px, 2.2vw, 26px)', fontWeight: 800,
                      color: primary, fontFamily: `${font}, system-ui, sans-serif`,
                      marginBottom: '6%', lineHeight: 1.1,
                    }}>
                      {slide.keyFact}
                    </div>
                  )}
                  {slide.bullets.slice(0, 2).map((b, bi) => (
                    <div key={bi} style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(5px, 0.6vw, 8px)', marginBottom: 'clamp(4px, 0.6vw, 8px)' }}>
                      <span style={{
                        width: 'clamp(5px, 0.5vw, 6px)', height: 'clamp(5px, 0.5vw, 6px)',
                        borderRadius: '50%', background: primary, flexShrink: 0,
                        marginTop: 'clamp(4px, 0.6vw, 8px)',
                      }} />
                      <span style={{
                        fontSize: 'clamp(10px, 1.3vw, 15px)', color: textColor, lineHeight: 1.45,
                        fontFamily: `${font}, system-ui, sans-serif`,
                      }}>
                        {b}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Right: infographic image */}
                <div style={{
                  flex: 1, borderRadius: 'clamp(4px, 0.5vw, 8px)', overflow: 'hidden',
                  background: bgIsLight ? '#f8f8f8' : 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <img
                    src={slide.imageUrl}
                    alt={`Infographic: ${slide.title}`}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'clamp(6px, 1vw, 12px)' }}>
                {slide.bullets.slice(0, 3).map((b, bi) => (
                  <div key={bi} style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(6px, 0.7vw, 10px)' }}>
                    <span style={{
                      width: 'clamp(5px, 0.5vw, 7px)', height: 'clamp(5px, 0.5vw, 7px)',
                      borderRadius: '50%', background: primary, flexShrink: 0,
                      marginTop: 'clamp(5px, 0.7vw, 9px)',
                    }} />
                    <span style={{
                      fontSize: 'clamp(11px, 1.5vw, 18px)', color: textColor, lineHeight: 1.5,
                      fontFamily: `${font}, system-ui, sans-serif`,
                    }}>
                      {b}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer: sector + disclaimer + page number */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              fontSize: 'clamp(6px, 0.7vw, 8px)', color: mutedText,
              fontFamily: `${font}, system-ui, sans-serif`,
              borderTop: `1px solid ${bgIsLight ? '#e5e5e5' : 'rgba(255,255,255,0.08)'}`,
              paddingTop: '1.2%', marginTop: 'auto',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span>{sector} | {topic || 'Course Materials'}</span>
                {disclaimer && (
                  <span style={{ opacity: 0.7, fontSize: 'clamp(5px, 0.55vw, 7px)' }}>{disclaimer}</span>
                )}
              </div>
              <span>{idx + 1} / {totalSlides}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const contentPages = pages.filter(p => p.bullets.length > 0 || p.title);
  const SLIDE_PREVIEW_LIMIT = 3;
  const previewSlides = contentPages.slice(0, SLIDE_PREVIEW_LIMIT);
  const remainingSlideCount = Math.max(0, contentPages.length - SLIDE_PREVIEW_LIMIT);
  const hasMoreSlides = remainingSlideCount > 0;

  const renderContentSlide = (page: ExtractedPageData, idx: number) => {
    const bullets = page.bullets.length > 0 ? page.bullets : slides[idx]?.after.bullets || [];
    return (
      <div key={idx} className="rounded-xl overflow-hidden" style={{
        aspectRatio: '16 / 9',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div className="w-full h-full flex" style={{ background: bg }}>
          <div style={{ width: '0.6%', background: primary }} />
          <div className="flex-1 flex flex-col" style={{ padding: '4% 6%' }}>
            <span style={{
              fontSize: 'clamp(8px, 1vw, 12px)', fontWeight: 700,
              color: primary, fontFamily: `${font}, system-ui, sans-serif`,
              marginBottom: '1%',
            }}>
              {String(idx + 1).padStart(2, '0')}
            </span>
            <h4 style={{
              fontSize: 'clamp(12px, 2.2vw, 24px)', fontWeight: 700,
              color: textColor, lineHeight: 1.2,
              fontFamily: `${font}, system-ui, sans-serif`,
            }}>
              {page.title || `Section ${idx + 1}`}
            </h4>
            {page.subtitle && (
              <p style={{
                fontSize: 'clamp(7px, 1vw, 12px)', color: mutedText,
                fontFamily: `${font}, system-ui, sans-serif`, marginTop: '0.5%',
              }}>
                {page.subtitle}
              </p>
            )}
            <div style={{
              width: '15%', height: 'clamp(2px, 0.3vw, 3px)',
              background: primary, margin: '2% 0',
            }} />
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 'clamp(3px, 0.5vw, 6px)' }}>
              {bullets.slice(0, 5).map((b, bi) => (
                <div key={bi} style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(4px, 0.5vw, 6px)' }}>
                  <span style={{
                    width: 'clamp(4px, 0.4vw, 5px)', height: 'clamp(4px, 0.4vw, 5px)',
                    borderRadius: '50%', background: primary, flexShrink: 0,
                    marginTop: 'clamp(3px, 0.5vw, 6px)',
                  }} />
                  <span style={{
                    fontSize: 'clamp(7px, 1vw, 11px)', color: textColor, lineHeight: 1.5,
                    fontFamily: `${font}, system-ui, sans-serif`,
                  }}>
                    {b}
                  </span>
                </div>
              ))}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 'clamp(5px, 0.6vw, 7px)', color: mutedText,
              fontFamily: `${font}, system-ui, sans-serif`,
              borderTop: `1px solid ${bgIsLight ? '#e5e5e5' : 'rgba(255,255,255,0.08)'}`,
              paddingTop: '1.5%',
            }}>
              <span>{sector} | {topic || 'Course Materials'}</span>
              <span>{idx + 1} / {contentPages.length}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title slide preview */}
      <div className="rounded-xl overflow-hidden" style={{
        aspectRatio: '16 / 9',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div className="w-full h-full flex" style={{ background: primary }}>
          <div style={{ width: '4%', background: secondary }} />
          <div className="flex-1 flex flex-col justify-center" style={{ padding: '6% 8%' }}>
            <h3 style={{
              fontSize: 'clamp(16px, 3vw, 32px)', fontWeight: 800, color: '#fff',
              fontFamily: `${font}, system-ui, sans-serif`, lineHeight: 1.2, marginBottom: '2%',
            }}>
              {topic || 'Course Materials'}
            </h3>
            <p style={{
              fontSize: 'clamp(9px, 1.4vw, 16px)', color: 'rgba(255,255,255,0.7)',
              fontFamily: `${font}, system-ui, sans-serif`,
            }}>
              {sector}
            </p>
            <p style={{
              fontSize: 'clamp(7px, 0.9vw, 10px)', color: 'rgba(255,255,255,0.4)',
              fontFamily: `${font}, system-ui, sans-serif`, marginTop: '2%',
            }}>
              Generated {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Visible preview slides — use AI content when available */}
      {preGeneratedSlides && preGeneratedSlides.length > 0 ? (
        <>
          {preGeneratedSlides.slice(0, SLIDE_PREVIEW_LIMIT).map((slide, idx) => renderAISlide(slide, idx))}
          {preGeneratedSlides.length > SLIDE_PREVIEW_LIMIT && (
            <div className="relative">
              <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
                {renderAISlide(preGeneratedSlides[SLIDE_PREVIEW_LIMIT], SLIDE_PREVIEW_LIMIT)}
              </div>
              <div className="absolute inset-0 rounded-xl" style={{
                background: 'linear-gradient(to bottom, rgba(12,11,9,0) 0%, rgba(12,11,9,0.7) 40%, rgba(12,11,9,0.95) 70%)',
                pointerEvents: 'none',
              }} />
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
                <button className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-bold text-sm transition-all transform hover:scale-105" style={{
                  background: 'linear-gradient(135deg, #c8956c, #c8956ccc)', color: '#fff',
                  boxShadow: '0 8px 30px rgba(200,149,108,0.4)', border: 'none', cursor: 'pointer',
                }}>
                  <Lock className="w-4 h-4" />
                  Unlock Full Slide Deck — {preGeneratedSlides.length - SLIDE_PREVIEW_LIMIT} more slide{preGeneratedSlides.length - SLIDE_PREVIEW_LIMIT !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {previewSlides.map((page, idx) => renderContentSlide(page, idx))}
        </>
      )}

      {/* Blurred teaser + lock overlay for remaining slides (non-AI path) */}
      {!preGeneratedSlides && hasMoreSlides && (
        <div className="relative">
          {/* Show next slide blurred */}
          {contentPages[SLIDE_PREVIEW_LIMIT] && (
            <div style={{
              filter: 'blur(6px)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              {renderContentSlide(contentPages[SLIDE_PREVIEW_LIMIT], SLIDE_PREVIEW_LIMIT)}
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 rounded-xl" style={{
            background: 'linear-gradient(to bottom, rgba(12,11,9,0) 0%, rgba(12,11,9,0.7) 40%, rgba(12,11,9,0.95) 70%)',
            pointerEvents: 'none',
          }} />

          {/* CTA overlay */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
            <button
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-bold text-sm transition-all transform hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #c8956c, #c8956ccc)',
                color: '#fff',
                boxShadow: '0 8px 30px rgba(200,149,108,0.4)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Lock className="w-4 h-4" />
              Unlock Full Slide Deck — {remainingSlideCount} more slide{remainingSlideCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Quiz Module
// ────────────────────────────────────────────────────────────────────────────

// AI Quiz Tab constants
const FREE_PREVIEW_LIMIT = 3;

function QuizTab({
  topic,
  sector,
  files,
  onQuestionsLoaded,
  preGeneratedQuestions,
}: {
  topic: string;
  sector: string;
  files: IngestedFile[];
  onQuestionsLoaded?: (questions: AIQuizQuestion[]) => void;
  preGeneratedQuestions?: AIQuizQuestion[];
}) {
  const [questions, setQuestions] = useState<AIQuizQuestion[]>(preGeneratedQuestions || []);
  const [loading, setLoading] = useState(!preGeneratedQuestions || preGeneratedQuestions.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [showResults, setShowResults] = useState(false);
  const fetchedRef = useRef(!!preGeneratedQuestions && preGeneratedQuestions.length > 0);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await generateQuizQuestions(topic, sector, files);
        if (cancelled) return;
        const qs = result.questions || [];
        setQuestions(qs);
        onQuestionsLoaded?.(qs);
      } catch (err) {
        if (cancelled) return;
        console.error('Quiz generation error:', err);
        setError('Unable to generate quiz questions. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, sector]);

  // Loading state
  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block relative mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, rgba(200,149,108,0.15), rgba(200,149,108,0.05))',
            border: '1px solid rgba(200,149,108,0.2)',
          }}>
            <Brain className="w-8 h-8 animate-pulse" style={{ color: '#c8956c' }} />
          </div>
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-5 h-5 animate-spin" style={{ color: '#c8956c', animationDuration: '3s' }} />
          </div>
        </div>
        <h3 className="text-lg font-heading font-bold text-text-primary mb-2">
          Creating your quiz...
        </h3>
        <p className="text-text-muted text-sm max-w-sm mx-auto">
          Generating quiz questions from your course content using AI. This may take a moment.
        </p>
        <div className="mt-6 flex justify-center gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{
              background: '#c8956c',
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.8s',
            }} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-16">
        <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#c27056' }} />
        <p className="text-text-primary text-sm font-medium mb-1">{error}</p>
        <button
          onClick={() => {
            fetchedRef.current = false;
            setLoading(true);
            setError(null);
            setQuestions([]);
          }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #c8956c, #a87550)', color: '#fff' }}
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (questions.length === 0) {
    return (
      <div className="text-center py-16">
        <HelpCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(245,240,224,0.2)' }} />
        <p className="text-text-muted text-sm">No quiz questions could be generated from this content.</p>
        <p className="text-text-muted text-xs mt-1">Try uploading a document with more detailed content.</p>
      </div>
    );
  }

  const isLocked = currentQ >= FREE_PREVIEW_LIMIT;
  const lockedCount = Math.max(0, questions.length - FREE_PREVIEW_LIMIT);
  const q = questions[currentQ];
  const userAnswer = answers[q.id] || '';
  const isChecked = checked[q.id] || false;
  const score = questions.filter(qq => {
    if (!checked[qq.id]) return false;
    if (qq.type === 'fill-blank') return (answers[qq.id] || '').toLowerCase().trim() === qq.correctAnswer.toLowerCase().trim();
    return answers[qq.id] === qq.correctAnswer;
  }).length;
  const pct = Math.round((currentQ / questions.length) * 100);

  const handleAnswer = (val: string) => {
    if (isChecked || isLocked) return;
    setAnswers(prev => ({ ...prev, [q.id]: val }));
  };

  const handleCheck = () => {
    if (isLocked) return;
    setChecked(prev => ({ ...prev, [q.id]: true }));
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) setCurrentQ(currentQ + 1);
    else setShowResults(true);
  };

  const handleRetake = () => {
    setCurrentQ(0);
    setAnswers({});
    setChecked({});
    setShowResults(false);
  };

  // Results screen
  if (showResults) {
    const answeredCount = Math.min(FREE_PREVIEW_LIMIT, questions.length);
    const previewScore = questions.slice(0, answeredCount).filter(qq => {
      if (!checked[qq.id]) return false;
      if (qq.type === 'fill-blank') return (answers[qq.id] || '').toLowerCase().trim() === qq.correctAnswer.toLowerCase().trim();
      return answers[qq.id] === qq.correctAnswer;
    }).length;
    const finalScore = answeredCount > 0 ? Math.round((previewScore / answeredCount) * 100) : 0;

    return (
      <div className="text-center py-16">
        <div className="inline-block p-10 rounded-2xl" style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h3 className="text-2xl font-heading font-bold text-text-primary mb-2">Quiz Preview Complete!</h3>
          <div className="text-5xl font-bold my-4" style={{ color: finalScore >= 70 ? '#6abf8a' : '#c27056' }}>
            {finalScore}%
          </div>
          <p className="text-text-muted text-sm mb-6">
            {previewScore} of {answeredCount} correct (preview)
          </p>

          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={handleRetake}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #c8956c, #a87550)', color: '#fff' }}
            >
              <RotateCcw className="w-4 h-4" />
              Retake Preview
            </button>
          </div>

          {lockedCount > 0 && (
            <div className="mt-4 px-6 py-4 rounded-xl" style={{
              background: 'rgba(200,149,108,0.08)',
              border: '1px solid rgba(200,149,108,0.2)',
            }}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Lock className="w-4 h-4" style={{ color: '#c8956c' }} />
                <span className="text-sm font-semibold" style={{ color: '#c8956c' }}>
                  {lockedCount} more question{lockedCount !== 1 ? 's' : ''} available
                </span>
              </div>
              <p className="text-text-muted text-xs">Unlock the full quiz with CourseCorrect Pro</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const badgeColors: Record<string, { bg: string; text: string }> = {
    'fill-blank': { bg: '#dbeafe', text: '#2563eb' },
    'true-false': { bg: '#fef3c7', text: '#d97706' },
    'multiple-choice': { bg: '#ede9fe', text: '#7c3aed' },
  };
  const badge = badgeColors[q.type] || { bg: '#e5e2db', text: '#4a4640' };
  const badgeLabel = q.type === 'fill-blank' ? 'Fill in the Blank' : q.type === 'true-false' ? 'True / False' : 'Multiple Choice';

  let isCorrect = false;
  if (isChecked) {
    isCorrect = q.type === 'fill-blank'
      ? userAnswer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()
      : userAnswer === q.correctAnswer;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">Question {currentQ + 1} of {questions.length}</span>
        <span className="text-xs text-text-muted">{score} correct so far</span>
      </div>
      <div className="h-1.5 rounded-full mb-6" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{
          width: `${pct}%`, background: '#c8956c',
        }} />
      </div>

      {/* Question card with optional lock overlay */}
      <div className="relative">
        <div className="rounded-xl p-6" style={{
          background: '#f8f7f4', border: '1px solid #e5e2db',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          filter: isLocked ? 'blur(4px)' : 'none',
          pointerEvents: isLocked ? 'none' : 'auto',
        }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
              style={{ background: badge.bg, color: badge.text }}>
              {badgeLabel}
            </span>
            {q.topic && (
              <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold"
                style={{ background: '#c8956c18', color: '#c8956c', border: '1px solid #c8956c30' }}>
                {q.topic}
              </span>
            )}
          </div>

          <div className="text-base leading-relaxed mb-5 whitespace-pre-line" style={{ color: '#1a1a1a' }}>
            {q.question}
          </div>

          {/* Answer inputs */}
          {q.type === 'fill-blank' && (
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Type your answer..."
              disabled={isChecked}
              className="w-full max-w-xs px-4 py-2.5 rounded-lg border-2 text-sm"
              style={{
                borderColor: isChecked ? (isCorrect ? '#059669' : '#dc2626') : '#e5e2db',
                background: isChecked ? (isCorrect ? '#ecfdf5' : '#fef2f2') : '#fff',
                color: '#1a1a1a',
                outline: 'none',
              }}
            />
          )}

          {q.type === 'true-false' && (
            <div className="flex gap-3">
              {['True', 'False'].map(opt => {
                let borderColor = '#e5e2db';
                let bgColor = '#fff';
                if (userAnswer === opt) { borderColor = '#c8956c'; bgColor = '#c8956c10'; }
                if (isChecked && opt === q.correctAnswer) { borderColor = '#059669'; bgColor = '#ecfdf5'; }
                if (isChecked && userAnswer === opt && opt !== q.correctAnswer) { borderColor = '#dc2626'; bgColor = '#fef2f2'; }

                return (
                  <button key={opt} onClick={() => handleAnswer(opt)} disabled={isChecked}
                    className="flex-1 py-3 rounded-lg font-semibold text-sm border-2 transition-all"
                    style={{ borderColor, background: bgColor, color: '#1a1a1a' }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === 'multiple-choice' && q.options && (
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                let borderColor = '#e5e2db';
                let bgColor = '#fff';
                if (userAnswer === opt) { borderColor = '#c8956c'; bgColor = '#c8956c10'; }
                if (isChecked && opt === q.correctAnswer) { borderColor = '#059669'; bgColor = '#ecfdf5'; }
                if (isChecked && userAnswer === opt && opt !== q.correctAnswer) { borderColor = '#dc2626'; bgColor = '#fef2f2'; }

                return (
                  <button key={oi} onClick={() => handleAnswer(opt)} disabled={isChecked}
                    className="w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all"
                    style={{ borderColor, background: bgColor, color: '#1a1a1a' }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Check answer */}
          {!isChecked && (
            <button onClick={handleCheck} disabled={!userAnswer}
              className="mt-4 px-5 py-2 rounded-lg font-semibold text-sm text-white transition-all"
              style={{
                background: userAnswer ? '#c8956c' : '#c8956c60',
                cursor: userAnswer ? 'pointer' : 'not-allowed',
              }}>
              Check Answer
            </button>
          )}

          {/* Feedback */}
          {isChecked && (
            <div className="mt-4 px-4 py-3 rounded-lg text-sm leading-relaxed" style={{
              background: isCorrect ? '#ecfdf5' : '#fef2f2',
              color: isCorrect ? '#065f46' : '#991b1b',
              border: `1px solid ${isCorrect ? '#a7f3d0' : '#fecaca'}`,
            }}>
              {isCorrect ? (
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Correct!</span>
              ) : (
                <span className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Incorrect.</span>
              )}
              <p className="mt-1">{q.explanation}</p>
            </div>
          )}
        </div>

        {/* Lock overlay for questions beyond preview limit */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{
            background: 'rgba(12,11,9,0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(200,149,108,0.2)',
          }}>
            <div className="text-center px-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{
                background: 'linear-gradient(135deg, rgba(200,149,108,0.2), rgba(200,149,108,0.05))',
                border: '1px solid rgba(200,149,108,0.3)',
              }}>
                <Lock className="w-7 h-7" style={{ color: '#c8956c' }} />
              </div>
              <h4 className="text-lg font-heading font-bold text-text-primary mb-2">
                Unlock Full Quiz
              </h4>
              <p className="text-text-muted text-sm mb-4">
                {lockedCount} more question{lockedCount !== 1 ? 's' : ''} available
              </p>
              <button className="px-6 py-2.5 rounded-lg font-bold text-sm text-white transition-all transform hover:scale-105" style={{
                background: 'linear-gradient(135deg, #c8956c, #a87550)',
                boxShadow: '0 4px 15px rgba(200,149,108,0.3)',
              }}>
                Upgrade to Pro
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
          className="px-4 py-2 rounded-lg text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            color: currentQ === 0 ? 'rgba(245,240,224,0.2)' : 'rgba(245,240,224,0.5)',
          }}>
          &larr; Previous
        </button>
        <button onClick={handleNext}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(245,240,224,0.7)',
          }}>
          {currentQ === questions.length - 1 ? 'See Results' : 'Next \u2192'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

const VisualOutput: React.FC<VisualOutputProps> = ({
  result,
  pageImages,
  extractedPages,
  generatedTheme,
  selectedSector,
  location,
  topic,
  files,
  onReset,
  preGeneratedStudyGuide,
  preGeneratedQuiz,
  preGeneratedSlides,
  slideVerification,
  disclaimer,
}) => {
  const [activeTab, setActiveTab] = useState<VisualTab>('document');
  const [isDownloading, setIsDownloading] = useState(false);
  const studyGuideSectionsRef = useRef<StudyGuideSection[]>([]);
  const quizQuestionsRef = useRef<AIQuizQuestion[]>([]);

  const activeTabConfig = tabConfig.find(t => t.id === activeTab)!;

  const handleStudyGuideSectionsLoaded = useCallback((sections: StudyGuideSection[]) => {
    studyGuideSectionsRef.current = sections;
  }, []);

  const handleQuizQuestionsLoaded = useCallback((questions: AIQuizQuestion[]) => {
    quizQuestionsRef.current = questions;
  }, []);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      if (activeTab === 'study-guide') {
        const sections = studyGuideSectionsRef.current;
        if (sections.length === 0) return;
        const html = generateStudyGuideHTML(sections, generatedTheme, topic, selectedSector);
        triggerDownload(html, `${(topic || 'study-guide').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60)}-study-guide.html`);
      } else if (activeTab === 'slides') {
        // Use AI-generated slides for PPTX when available
        const pptxPages = preGeneratedSlides && preGeneratedSlides.length > 0
          ? preGeneratedSlides.map((s, i) => ({
              pageNumber: i + 1,
              title: s.title,
              subtitle: s.subtitle || '',
              bullets: s.bullets,
              textDensityScore: 0,
              classification: 'TEXT_HEAVY' as const,
            }))
          : extractedPages;
        await generatePptx(pptxPages, result.slides, generatedTheme, topic, selectedSector);
      } else if (activeTab === 'quiz') {
        const qs = quizQuestionsRef.current;
        if (qs.length === 0) return;
        const html = generateQuizHTML(qs, topic, selectedSector);
        triggerDownload(html, `${(topic || 'quiz').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60)}-quiz.html`);
      }
    } finally {
      setIsDownloading(false);
    }
  }, [activeTab, extractedPages, result.slides, generatedTheme, topic, selectedSector]);

  return (
    <div className="min-h-screen bg-background text-text-primary overflow-y-auto">
      {/* Atmospheric gradient */}
      <div className="fixed top-0 left-0 right-0 h-64 pointer-events-none" style={{
        background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${generatedTheme?.primaryColor || '#c8956c'}12, transparent)`,
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">
              Design Refresh — New Materials
            </p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-text-primary leading-tight mb-2">
              {topic || 'Course materials ready'}
            </h2>
            <p className="text-text-muted text-sm">
              {selectedSector} &middot; {location || 'United States'}
            </p>
            {generatedTheme && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex gap-1">
                  <div className="w-4 h-4 rounded-full" style={{ background: generatedTheme.primaryColor }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: generatedTheme.secondaryColor }} />
                  <div className="w-4 h-4 rounded-full" style={{ background: generatedTheme.backgroundColor, border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
                <p className="text-text-muted text-xs">
                  {generatedTheme.fontSuggestion} &middot; {generatedTheme.designReasoning}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-text-muted transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> New design
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 mb-8 p-1 rounded-xl" style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center"
              style={{
                background: activeTab === tab.id ? 'rgba(200,149,108,0.15)' : 'transparent',
                color: activeTab === tab.id ? '#c8956c' : 'rgba(245,240,224,0.5)',
                border: activeTab === tab.id ? '1px solid rgba(200,149,108,0.25)' : '1px solid transparent',
              }}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Download button for active tab (skip for "Your Document" tab) */}
        {activeTabConfig.downloadLabel && (
          <div className="flex justify-end mb-6">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #c8956c, #a87550)',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(200,149,108,0.25)',
                opacity: isDownloading ? 0.6 : 1,
              }}
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Generating...' : activeTabConfig.downloadLabel}
            </button>
          </div>
        )}

        {/* Tab content */}
        <div>
          {activeTab === 'document' && (
            <YourDocumentTab pageImages={pageImages} />
          )}
          {activeTab === 'study-guide' && (
            <StudyGuideTab
              topic={topic}
              sector={selectedSector}
              files={files}
              theme={generatedTheme}
              onSectionsLoaded={handleStudyGuideSectionsLoaded}
              preGeneratedSections={preGeneratedStudyGuide}
            />
          )}
          {activeTab === 'slides' && (
            <SlidePreviewTab
              pages={extractedPages}
              slides={result.slides}
              theme={generatedTheme}
              topic={topic}
              sector={selectedSector}
              preGeneratedSlides={preGeneratedSlides}
              disclaimer={disclaimer}
            />
          )}
          {activeTab === 'quiz' && (
            <QuizTab
              topic={topic}
              sector={selectedSector}
              files={files}
              onQuestionsLoaded={handleQuizQuestionsLoaded}
              preGeneratedQuestions={preGeneratedQuiz}
            />
          )}
        </div>

        {/* CTA */}
        <div className="mt-20 mb-12 text-center">
          <div className="inline-block px-12 py-10 rounded-2xl relative overflow-hidden" style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(ellipse at center, rgba(200,149,108,0.06), transparent 70%)',
            }} />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">Full Platform</p>
              <h3 className="text-2xl font-heading font-bold text-text-primary mb-2">
                Ready for the complete transformation?
              </h3>
              <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
                Analyze entire libraries. Generate quizzes. Export to SCORM/xAPI.
              </p>
              <button className="px-8 py-3 rounded-full font-bold text-sm text-white transition-all transform hover:scale-105" style={{
                background: 'linear-gradient(135deg, #c8956c, #a87550)',
                boxShadow: '0 8px 30px rgba(200,149,108,0.25)',
              }}>
                Unlock Full Access
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualOutput;
