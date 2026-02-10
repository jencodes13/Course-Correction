import React, { useState, useMemo, useRef } from 'react';
import {
  RefreshCw,
  ExternalLink,
  Download,
  FileText,
  Eye,
  FileCheck,
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  Layers,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  Clock,
  BarChart3,
  Tag,
  Package,
  Presentation,
  FileType,
  BrainCircuit,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import {
  UpdateMode,
  DemoResult,
  DemoSlideEnhanced,
  CourseFinding,
  ExtractedPageData,
  DiffToken,
  BulletDiff,
  RedlineEntry,
  VerifiedFinding,
  CourseSummaryResult,
} from '../types';
import { QuizQuestion } from '../services/geminiService';

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface RegulatoryOutputProps {
  result: DemoResult;
  findings: CourseFinding[];
  approvedFindingIds: Set<string>;
  pageImages: string[];
  extractedPages: ExtractedPageData[];
  selectedSector: string;
  location: string;
  topic: string;
  updateMode: UpdateMode;
  onReset: () => void;
  verificationResults?: VerifiedFinding[];
  quizResults?: QuizQuestion[];
  courseSummaryResult?: CourseSummaryResult | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Utility functions
// ────────────────────────────────────────────────────────────────────────────

/** Jaccard word-overlap similarity (0-1) */
function similarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  return intersection / (wordsA.size + wordsB.size - intersection);
}

/** Longest Common Subsequence on word arrays → DiffToken[] */
function computeWordDiff(before: string, after: string): DiffToken[] {
  const wordsA = before.split(/\s+/).filter(Boolean);
  const wordsB = after.split(/\s+/).filter(Boolean);

  const m = wordsA.length;
  const n = wordsB.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (wordsA[i - 1].toLowerCase() === wordsB[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff tokens
  const tokens: DiffToken[] = [];
  let i = m, j = n;
  const rawTokens: DiffToken[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1].toLowerCase() === wordsB[j - 1].toLowerCase()) {
      rawTokens.push({ text: wordsB[j - 1], type: 'same' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawTokens.push({ text: wordsB[j - 1], type: 'added' });
      j--;
    } else {
      rawTokens.push({ text: wordsA[i - 1], type: 'removed' });
      i--;
    }
  }

  rawTokens.reverse();

  // Merge consecutive same-type tokens
  for (const token of rawTokens) {
    if (tokens.length > 0 && tokens[tokens.length - 1].type === token.type) {
      tokens[tokens.length - 1].text += ' ' + token.text;
    } else {
      tokens.push({ ...token });
    }
  }

  return tokens;
}

/** Match findings to slides via sourceSnippet similarity or index fallback */
function mapFindingsToSlides(
  slides: DemoSlideEnhanced[],
  findings: CourseFinding[],
  approvedIds: Set<string>,
): Map<string, CourseFinding> {
  const approvedFindings = findings.filter(f => approvedIds.has(f.id));
  const slideToFinding = new Map<string, CourseFinding>();

  // Try sourceSnippet matching first
  for (const finding of approvedFindings) {
    if (!finding.sourceSnippet) continue;
    let bestSlideId = '';
    let bestScore = 0;
    for (const slide of slides) {
      const beforeText = [slide.before.title, ...slide.before.bullets].join(' ');
      const score = similarity(finding.sourceSnippet, beforeText);
      if (score > bestScore) {
        bestScore = score;
        bestSlideId = slide.id;
      }
    }
    if (bestScore > 0.15 && bestSlideId && !slideToFinding.has(bestSlideId)) {
      slideToFinding.set(bestSlideId, finding);
    }
  }

  // Index fallback for unmatched slides
  const unmatchedFindings = approvedFindings.filter(
    f => ![...slideToFinding.values()].includes(f),
  );
  let fi = 0;
  for (const slide of slides) {
    if (!slideToFinding.has(slide.id) && fi < unmatchedFindings.length) {
      slideToFinding.set(slide.id, unmatchedFindings[fi]);
      fi++;
    }
  }

  return slideToFinding;
}

/** Produce RedlineEntry[] from result data */
function computeRedlineData(
  result: DemoResult,
  findings: CourseFinding[],
  approvedIds: Set<string>,
): RedlineEntry[] {
  const slideToFinding = mapFindingsToSlides(result.slides, findings, approvedIds);

  return result.slides.map((slide, idx) => {
    const finding = slideToFinding.get(slide.id);
    const titleChanged = slide.before.title.toLowerCase() !== slide.after.title.toLowerCase();

    // Match bullets between before/after using similarity
    const bulletDiffs: BulletDiff[] = [];
    const usedAfter = new Set<number>();

    for (const beforeBullet of slide.before.bullets) {
      let bestIdx = -1;
      let bestScore = 0;
      for (let ai = 0; ai < slide.after.bullets.length; ai++) {
        if (usedAfter.has(ai)) continue;
        const score = similarity(beforeBullet, slide.after.bullets[ai]);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = ai;
        }
      }

      if (bestScore > 0.5 && bestIdx >= 0) {
        usedAfter.add(bestIdx);
        const afterBullet = slide.after.bullets[bestIdx];
        if (beforeBullet === afterBullet) {
          bulletDiffs.push({ type: 'unchanged', beforeText: beforeBullet });
        } else {
          bulletDiffs.push({
            type: 'modified',
            beforeText: beforeBullet,
            afterText: afterBullet,
            tokens: computeWordDiff(beforeBullet, afterBullet),
          });
        }
      } else {
        bulletDiffs.push({ type: 'removed', beforeText: beforeBullet });
      }
    }

    // Any unmatched after bullets are additions
    for (let ai = 0; ai < slide.after.bullets.length; ai++) {
      if (!usedAfter.has(ai)) {
        bulletDiffs.push({ type: 'added', afterText: slide.after.bullets[ai] });
      }
    }

    return {
      slideId: slide.id,
      slideIndex: idx,
      sourcePageNumber: slide.before.sourcePageNumber,
      findingId: finding?.id,
      findingTitle: finding?.title,
      findingCategory: finding?.category,
      findingSeverity: finding?.severity,
      changesSummary: slide.changesSummary,
      titleDiff: { before: slide.before.title, after: slide.after.title, changed: titleChanged },
      bulletDiffs,
      citationIds: slide.after.citationIds,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

const categoryIcon: Record<string, React.ReactNode> = {
  outdated: <AlertTriangle className="w-3.5 h-3.5" />,
  compliance: <ShieldAlert className="w-3.5 h-3.5" />,
  missing: <BookOpen className="w-3.5 h-3.5" />,
  structural: <Layers className="w-3.5 h-3.5" />,
};

const severityColor: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};

function FindingBadge({ category, severity }: { category?: string; severity?: string }) {
  if (!category) return null;
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
      style={{
        background: `${severityColor[severity || 'low']}18`,
        color: severityColor[severity || 'low'],
        border: `1px solid ${severityColor[severity || 'low']}30`,
      }}
    >
      {categoryIcon[category] || <FileText className="w-3.5 h-3.5" />}
      {category}
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: severityColor[severity || 'low'] }} />
      {severity}
    </div>
  );
}

const CitationPill: React.FC<{ id: number }> = ({ id }) => {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold mx-0.5 align-middle"
      style={{ background: '#c8956c', color: '#fff' }}
    >
      {id}
    </span>
  );
};

function InlineTokens({ tokens }: { tokens: DiffToken[] }) {
  return (
    <span>
      {tokens.map((t, i) => {
        if (t.type === 'same') return <span key={i}>{t.text} </span>;
        if (t.type === 'removed') {
          return (
            <span key={i} className="line-through" style={{ color: '#dc2626', background: 'rgba(220,38,38,0.08)' }}>
              {t.text}
            </span>
          );
        }
        return (
          <span key={i} style={{ color: '#059669', background: 'rgba(5,150,105,0.08)' }}>
            {' '}{t.text}
          </span>
        );
      })}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Redline View
// ────────────────────────────────────────────────────────────────────────────

function RedlineView({ entries, citations }: { entries: RedlineEntry[]; citations: DemoResult['citations'] }) {
  return (
    <div className="space-y-6">
      {entries.map((entry) => {
        const hasChanges = entry.titleDiff.changed || entry.bulletDiffs.some(b => b.type !== 'unchanged');
        if (!hasChanges) return null;

        return (
          <div key={entry.slideId} className="rounded-xl overflow-hidden" style={{
            background: '#f8f7f4',
            border: '1px solid #e5e2db',
          }}>
            {/* Section header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e5e2db' }}>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{
                  background: '#c8956c20', color: '#c8956c',
                }}>
                  {entry.sourcePageNumber || entry.slideIndex + 1}
                </span>
                <span className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>
                  {entry.sourcePageNumber ? `Page ${entry.sourcePageNumber}` : `Section ${entry.slideIndex + 1}`}
                </span>
                {entry.findingCategory && entry.findingSeverity && (
                  <FindingBadge category={entry.findingCategory} severity={entry.findingSeverity} />
                )}
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4" style={{ color: '#1a1a1a' }}>
              {/* Finding context */}
              {entry.findingTitle && (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#f0ede5', color: '#6b6455' }}>
                  <span className="font-semibold">Finding:</span> {entry.findingTitle}
                </div>
              )}

              {/* Title diff */}
              {entry.titleDiff.changed && (
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9a9385' }}>
                    Heading
                  </p>
                  <p className="text-lg font-semibold leading-snug">
                    <span className="line-through" style={{ color: '#dc2626', background: 'rgba(220,38,38,0.06)' }}>
                      {entry.titleDiff.before}
                    </span>
                    <ChevronRight className="inline w-4 h-4 mx-2 opacity-30" />
                    <span style={{ color: '#059669', background: 'rgba(5,150,105,0.06)' }}>
                      {entry.titleDiff.after}
                    </span>
                  </p>
                </div>
              )}

              {/* Bullet diffs */}
              <div className="space-y-2">
                {entry.bulletDiffs.map((bd, bi) => {
                  if (bd.type === 'unchanged') {
                    return (
                      <div key={bi} className="flex items-start gap-2 text-sm pl-2" style={{ color: '#4a4640' }}>
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#c8c0b0' }} />
                        {bd.beforeText}
                      </div>
                    );
                  }
                  if (bd.type === 'removed') {
                    return (
                      <div key={bi} className="flex items-start gap-2 text-sm pl-2 line-through" style={{
                        color: '#dc2626', background: 'rgba(220,38,38,0.04)', borderRadius: '6px', padding: '4px 8px',
                      }}>
                        <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        {bd.beforeText}
                      </div>
                    );
                  }
                  if (bd.type === 'added') {
                    return (
                      <div key={bi} className="flex items-start gap-2 text-sm pl-2" style={{
                        color: '#059669', background: 'rgba(5,150,105,0.04)', borderRadius: '6px', padding: '4px 8px',
                      }}>
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                        {bd.afterText}
                      </div>
                    );
                  }
                  // modified — inline word diff
                  return (
                    <div key={bi} className="flex items-start gap-2 text-sm pl-2" style={{
                      borderRadius: '6px', padding: '4px 8px', background: 'rgba(200,149,108,0.06)',
                    }}>
                      <MinusCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#c8956c' }} />
                      <span style={{ color: '#1a1a1a' }}>
                        {bd.tokens ? <InlineTokens tokens={bd.tokens} /> : bd.afterText}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Inline citation markers */}
              {entry.citationIds.length > 0 && (
                <div className="flex items-center gap-1 mt-3 pt-3" style={{ borderTop: '1px solid #e5e2db' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: '#9a9385' }}>
                    Sources:
                  </span>
                  {entry.citationIds.map(id => <CitationPill key={id} id={id} />)}
                </div>
              )}
            </div>

            {/* Changes summary */}
            <div className="px-6 py-3 text-xs" style={{ background: '#f0ede5', color: '#6b6455', borderTop: '1px solid #e5e2db' }}>
              {entry.changesSummary}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Change Report
// ────────────────────────────────────────────────────────────────────────────

function ChangeReportTab({
  entries,
  findings,
  approvedFindingIds,
  citations,
  sector,
  location,
}: {
  entries: RedlineEntry[];
  findings: CourseFinding[];
  approvedFindingIds: Set<string>;
  citations: DemoResult['citations'];
  sector: string;
  location: string;
}) {
  const changedEntries = entries.filter(e =>
    e.titleDiff.changed || e.bulletDiffs.some(b => b.type !== 'unchanged'),
  );
  const removedBullets = entries.flatMap(e => e.bulletDiffs.filter(b => b.type === 'removed'));
  const addedBullets = entries.flatMap(e => e.bulletDiffs.filter(b => b.type === 'added'));
  const modifiedBullets = entries.flatMap(e => e.bulletDiffs.filter(b => b.type === 'modified'));
  const approvedFindings = findings.filter(f => approvedFindingIds.has(f.id));
  const skippedFindings = findings.filter(f => !approvedFindingIds.has(f.id));

  return (
    <div className="space-y-8">
      {/* Executive Summary */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#f8f7f4', border: '1px solid #e5e2db' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #e5e2db' }}>
          <h3 className="text-base font-bold" style={{ color: '#1a1a1a' }}>Executive Summary</h3>
        </div>
        <div className="px-6 py-5" style={{ color: '#1a1a1a' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="text-center p-3 rounded-lg" style={{ background: '#f0ede5' }}>
              <div className="text-2xl font-bold" style={{ color: '#c8956c' }}>{changedEntries.length}</div>
              <div className="text-[11px] uppercase tracking-wider mt-1" style={{ color: '#9a9385' }}>Sections Changed</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: '#f0ede5' }}>
              <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>{removedBullets.length}</div>
              <div className="text-[11px] uppercase tracking-wider mt-1" style={{ color: '#9a9385' }}>Items Removed</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: '#f0ede5' }}>
              <div className="text-2xl font-bold" style={{ color: '#059669' }}>{addedBullets.length}</div>
              <div className="text-[11px] uppercase tracking-wider mt-1" style={{ color: '#9a9385' }}>Items Added</div>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: '#f0ede5' }}>
              <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{modifiedBullets.length}</div>
              <div className="text-[11px] uppercase tracking-wider mt-1" style={{ color: '#9a9385' }}>Items Modified</div>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#4a4640' }}>
            This report covers a <strong>{sector}</strong> course analyzed for the <strong>{location}</strong> jurisdiction.
            {' '}{approvedFindings.length} finding{approvedFindings.length !== 1 ? 's' : ''} were reviewed and approved for update.
            {skippedFindings.length > 0 && ` ${skippedFindings.length} finding${skippedFindings.length !== 1 ? 's were' : ' was'} skipped.`}
            {' '}All changes are backed by {citations.length} verified source{citations.length !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      {/* Changes Detail */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#f8f7f4', border: '1px solid #e5e2db' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #e5e2db' }}>
          <h3 className="text-base font-bold" style={{ color: '#1a1a1a' }}>Changes by Finding</h3>
        </div>
        <div className="divide-y" style={{ borderColor: '#e5e2db' }}>
          {approvedFindings.map((finding) => {
            const relatedEntry = entries.find(e => e.findingId === finding.id);
            return (
              <div key={finding.id} className="px-6 py-4" style={{ color: '#1a1a1a' }}>
                <div className="flex items-start gap-3 mb-2">
                  <FindingBadge category={finding.category} severity={finding.severity} />
                  <h4 className="text-sm font-semibold flex-1">{finding.title}</h4>
                </div>
                <p className="text-xs mb-2" style={{ color: '#6b6455' }}>{finding.description}</p>
                {finding.sourceSnippet && (
                  <div className="text-xs px-3 py-2 rounded mb-2" style={{ background: 'rgba(220,38,38,0.04)', color: '#8b4513' }}>
                    <span className="font-semibold">Original:</span> "{finding.sourceSnippet}"
                  </div>
                )}
                {finding.currentInfo && (
                  <div className="text-xs px-3 py-2 rounded" style={{ background: 'rgba(5,150,105,0.04)', color: '#065f46' }}>
                    <span className="font-semibold">Current:</span> {finding.currentInfo}
                  </div>
                )}
                {relatedEntry && relatedEntry.changesSummary && (
                  <p className="text-xs mt-2" style={{ color: '#9a9385' }}>
                    Action: {relatedEntry.changesSummary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Removal Log */}
      {removedBullets.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#f8f7f4', border: '1px solid #e5e2db' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #e5e2db' }}>
            <h3 className="text-base font-bold" style={{ color: '#1a1a1a' }}>Removal Log</h3>
          </div>
          <div className="px-6 py-4 space-y-2">
            {removedBullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2 text-sm line-through" style={{ color: '#dc2626' }}>
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {b.beforeText}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skipped Findings */}
      {skippedFindings.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#f8f7f4', border: '1px solid #e5e2db' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #e5e2db' }}>
            <h3 className="text-base font-bold" style={{ color: '#1a1a1a' }}>Skipped Findings</h3>
          </div>
          <div className="px-6 py-4 space-y-3">
            {skippedFindings.map(f => (
              <div key={f.id} className="text-sm flex items-start gap-2" style={{ color: '#6b6455' }}>
                <MinusCircle className="w-4 h-4 mt-0.5 shrink-0 opacity-50" />
                <div>
                  <span className="font-semibold">{f.title}</span>
                  <span className="mx-1.5 opacity-30">—</span>
                  <span className="text-xs">{f.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Citations */}
      <CitationsBlock citations={citations} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Annotated Original
// ────────────────────────────────────────────────────────────────────────────

function AnnotatedOriginalTab({
  pageImages,
  entries,
}: {
  pageImages: string[];
  entries: RedlineEntry[];
}) {
  // Build a map: pageNumber → entries with changes on that page
  const pageAnnotations = useMemo(() => {
    const map = new Map<number, RedlineEntry[]>();
    for (const entry of entries) {
      const hasChanges = entry.titleDiff.changed || entry.bulletDiffs.some(b => b.type !== 'unchanged');
      if (!hasChanges) continue;
      const pageNum = entry.sourcePageNumber || entry.slideIndex + 1;
      const existing = map.get(pageNum) || [];
      existing.push(entry);
      map.set(pageNum, existing);
    }
    return map;
  }, [entries]);

  // Filter: show page 1 (cover) + only pages with changes
  const pagesToShow = useMemo(() => {
    const pages: { pageNum: number; img: string; annotations: RedlineEntry[] | null }[] = [];
    // Always show page 1 as cover
    if (pageImages.length > 0) {
      pages.push({ pageNum: 1, img: pageImages[0], annotations: null });
    }
    // Add pages with changes (skip page 1 if already added)
    for (const [pageNum, anns] of pageAnnotations) {
      if (pageNum === 1) continue; // already shown as cover
      if (pageNum <= pageImages.length) {
        pages.push({ pageNum, img: pageImages[pageNum - 1], annotations: anns });
      }
    }
    // Sort by page number
    pages.sort((a, b) => a.pageNum - b.pageNum);
    return pages;
  }, [pageImages, pageAnnotations]);

  if (pageImages.length === 0) {
    return (
      <div className="rounded-xl p-12 text-center" style={{ background: '#f8f7f4', border: '1px solid #e5e2db' }}>
        <Eye className="w-10 h-10 mx-auto mb-3" style={{ color: '#c8c0b0' }} />
        <p className="text-sm font-semibold" style={{ color: '#1a1a1a' }}>No page images available</p>
        <p className="text-xs mt-1" style={{ color: '#9a9385' }}>
          PDF page previews were not extracted for this document.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pagesToShow.map(({ pageNum, img, annotations }) => {
        const hasAnnotations = !!annotations && annotations.length > 0;
        const isCover = pageNum === 1 && !hasAnnotations;

        return (
          <div key={pageNum} className="rounded-xl overflow-hidden relative" style={{
            border: hasAnnotations ? '2px solid #c8956c' : '1px solid #e5e2db',
          }}>
            {/* Page number label */}
            <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md text-xs font-bold" style={{
              background: 'rgba(0,0,0,0.7)', color: '#fff',
            }}>
              Page {pageNum}
            </div>

            {/* Annotation overlay */}
            {hasAnnotations && (
              <div className="absolute top-0 left-0 bottom-0 z-10" style={{ width: '6px', background: '#c8956c' }} />
            )}
            {hasAnnotations && annotations.map((ann, ai) => (
              <div key={ai} className="absolute left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-r-lg shadow-lg"
                style={{
                  top: `${12 + ai * 52}px`,
                  background: 'rgba(255,255,255,0.95)',
                  borderLeft: `3px solid ${severityColor[ann.findingSeverity || 'low']}`,
                  maxWidth: '60%',
                }}
              >
                {ann.findingCategory && categoryIcon[ann.findingCategory]}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold truncate" style={{ color: '#1a1a1a' }}>
                    {ann.findingTitle || ann.changesSummary}
                  </p>
                  <p className="text-[10px]" style={{ color: '#9a9385' }}>
                    {ann.bulletDiffs.filter(b => b.type !== 'unchanged').length} change{ann.bulletDiffs.filter(b => b.type !== 'unchanged').length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}

            {/* Cover page label */}
            {isCover && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
                <span className="px-4 py-2 rounded-full text-xs font-semibold" style={{
                  background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)',
                }}>
                  Cover — no changes on this page
                </span>
              </div>
            )}

            {/* Page image */}
            <img
              src={img}
              alt={`Page ${pageNum}`}
              className="w-full"
              style={{ display: 'block' }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Clean Document
// ────────────────────────────────────────────────────────────────────────────

function CleanDocumentTab({
  slides,
  citations,
  pageImages,
  entries,
}: {
  slides: DemoSlideEnhanced[];
  citations: DemoResult['citations'];
  pageImages: string[];
  entries: RedlineEntry[];
}) {
  return (
    <div className="space-y-6">
      {slides.map((slide, idx) => {
        const pageNum = slide.after.sourcePageNumber || idx + 1;
        const pageImg = pageNum <= pageImages.length ? pageImages[pageNum - 1] : null;
        const entry = entries[idx];
        const hasChanges = entry && (entry.titleDiff.changed || entry.bulletDiffs.some(b => b.type !== 'unchanged'));

        return (
          <div key={slide.id} className="rounded-xl overflow-hidden relative" style={{
            border: '1px solid #e5e2db',
            // 16:9 aspect ratio container
            aspectRatio: '16/9',
          }}>
            {/* Background: original page image dimmed */}
            {pageImg && (
              <img
                src={pageImg}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.25, filter: 'blur(1px)' }}
              />
            )}
            {/* Dark overlay for readability */}
            <div className="absolute inset-0" style={{
              background: pageImg
                ? 'linear-gradient(135deg, rgba(20,18,14,0.82), rgba(20,18,14,0.70))'
                : '#1a1914',
            }} />

            {/* Page badge */}
            <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md text-xs font-bold" style={{
              background: 'rgba(0,0,0,0.5)', color: '#fff',
            }}>
              Page {pageNum}
            </div>

            {/* Updated badge */}
            {hasChanges && (
              <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider" style={{
                background: 'rgba(5,150,105,0.2)', color: '#6abf8a', border: '1px solid rgba(5,150,105,0.3)',
              }}>
                Updated
              </div>
            )}

            {/* Content overlay */}
            <div className="relative z-10 h-full flex flex-col justify-center px-8 md:px-12 py-6">
              <h3 className="text-xl md:text-2xl font-heading font-bold text-white mb-2 leading-tight">
                {slide.after.title}
              </h3>
              {slide.after.subtitle && (
                <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>{slide.after.subtitle}</p>
              )}
              <ul className="space-y-2 flex-1 overflow-y-auto">
                {slide.after.bullets.map((bullet, bi) => (
                  <li key={bi} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#c8956c' }} />
                    {bullet}
                  </li>
                ))}
              </ul>
              {slide.after.keyFact && (
                <div className="mt-4 px-4 py-2 rounded-lg text-center" style={{
                  background: 'rgba(200,149,108,0.15)', border: '1px solid rgba(200,149,108,0.25)',
                }}>
                  <p className="text-lg font-bold" style={{ color: '#c8956c' }}>{slide.after.keyFact}</p>
                </div>
              )}
              {/* Citation pills at bottom */}
              {slide.after.citationIds.length > 0 && (
                <div className="flex items-center gap-1 mt-3">
                  {slide.after.citationIds.map(id => <CitationPill key={id} id={id} />)}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Citations */}
      <CitationsBlock citations={citations} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared: Citations block
// ────────────────────────────────────────────────────────────────────────────

function CitationsBlock({ citations }: { citations: DemoResult['citations'] }) {
  if (citations.length === 0) return null;
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#f8f7f4', border: '1px solid #e5e2db' }}>
      <div className="px-6 py-4" style={{ borderBottom: '1px solid #e5e2db' }}>
        <h3 className="text-base font-bold flex items-center gap-2" style={{ color: '#1a1a1a' }}>
          <ExternalLink className="w-4 h-4" /> Verified Sources
        </h3>
      </div>
      <div className="px-6 py-4 space-y-3">
        {citations.map((c) => (
          <div key={c.id} className="flex items-start gap-3">
            <CitationPill id={c.id} />
            <div className="flex-1 min-w-0">
              <a
                href={c.url !== '#' && c.url.startsWith('https://') ? c.url : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline"
                style={{ color: '#1a1a1a' }}
              >
                {c.title}
              </a>
              {c.snippet && (
                <p className="text-xs mt-0.5" style={{ color: '#9a9385' }}>{c.snippet}</p>
              )}
              {c.accessedDate && (
                <p className="text-[10px] mt-0.5" style={{ color: '#c8c0b0' }}>
                  Accessed {c.accessedDate}
                </p>
              )}
            </div>
            {c.url !== '#' && c.url.startsWith('https://') && (
              <ExternalLink className="w-3 h-3 shrink-0 mt-1" style={{ color: '#c8c0b0' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Download stub button
// ────────────────────────────────────────────────────────────────────────────

/** Generate and trigger download of the currently visible tab content */
function downloadTabContent(tabId: DeliverableTab, containerRef: React.RefObject<HTMLDivElement | null>) {
  const el = containerRef.current;
  if (!el) return;

  // Clone the tab content HTML and wrap in a standalone document
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CourseCorrect — ${tabId === 'redline' ? 'Redline Report' : tabId === 'report' ? 'Change Report' : tabId === 'annotated' ? 'Annotated Original' : tabId === 'fact-check' ? 'Fact Check' : tabId === 'quiz' ? 'Quiz' : 'Clean Document'}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; background: #fff; color: #1a1a1a; }
  img { max-width: 100%; height: auto; }
  * { box-sizing: border-box; }
</style>
</head>
<body>
${el.innerHTML}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coursecorrect-${tabId}-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function DownloadButton({ label, tabId, containerRef }: {
  label: string;
  tabId: DeliverableTab;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <button
      onClick={() => downloadTabContent(tabId, containerRef)}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
      style={{
        background: 'linear-gradient(135deg, #c8956c, #a87550)',
        color: '#fff',
        boxShadow: '0 4px 15px rgba(200,149,108,0.25)',
      }}
    >
      <Download className="w-4 h-4" />
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Fact Check
// ────────────────────────────────────────────────────────────────────────────

const statusConfig: Record<VerifiedFinding['status'], { label: string; color: string; icon: React.ReactNode }> = {
  verified: { label: 'Verified', color: '#6abf8a', icon: <CheckCircle2 className="w-4 h-4" /> },
  updated: { label: 'Updated', color: '#c8956c', icon: <RefreshCw className="w-4 h-4" /> },
  unverified: { label: 'Unverified', color: '#c27056', icon: <XCircle className="w-4 h-4" /> },
};

function FactCheckTab({ verificationResults }: { verificationResults?: VerifiedFinding[] }) {
  if (!verificationResults || verificationResults.length === 0) {
    return (
      <div className="rounded-xl p-12 text-center" style={{ background: 'rgba(255,248,230,0.04)', border: '1px solid rgba(255,248,230,0.08)' }}>
        <ShieldAlert className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(245,240,224,0.3)' }} />
        <p className="text-sm font-semibold text-text-primary">No fact check results yet</p>
        <p className="text-xs mt-1 text-text-muted">
          Fact checking results will appear here when the Fact Checker agent completes.
        </p>
      </div>
    );
  }

  const verified = verificationResults.filter(v => v.status === 'verified').length;
  const updated = verificationResults.filter(v => v.status === 'updated').length;
  const unverified = verificationResults.filter(v => v.status === 'unverified').length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,248,230,0.04)', border: '1px solid rgba(255,248,230,0.08)' }}>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#6abf8a' }} />
          <span className="text-text-muted">{verified} verified</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#c8956c' }} />
          <span className="text-text-muted">{updated} updated</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#c27056' }} />
          <span className="text-text-muted">{unverified} unverified</span>
        </div>
      </div>

      {/* Verification cards */}
      {verificationResults.map((vf) => {
        const cfg = statusConfig[vf.status];
        return (
          <div key={vf.findingId} className="rounded-xl overflow-hidden" style={{
            background: 'rgba(255,248,230,0.04)',
            border: `1px solid ${cfg.color}30`,
          }}>
            {/* Card header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${cfg.color}20` }}>
              <div className="flex items-center gap-3 min-w-0">
                <span style={{ color: cfg.color }}>{cfg.icon}</span>
                <h4 className="text-sm font-semibold text-text-primary truncate">{vf.title}</h4>
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
              >
                {cfg.label}
              </span>
            </div>

            {/* Card body */}
            <div className="px-5 py-4 space-y-3">
              {/* Confidence bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Confidence</span>
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{vf.confidence}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,248,230,0.08)' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${vf.confidence}%`,
                    background: `linear-gradient(90deg, #c27056, #c8956c, #6abf8a)`,
                  }} />
                </div>
              </div>

              {/* Verification note */}
              <p className="text-sm leading-relaxed text-text-muted">{vf.verificationNote}</p>

              {/* Original vs updated (if status is 'updated') */}
              {vf.status === 'updated' && vf.updatedInfo && (
                <div className="space-y-2">
                  <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(194,112,86,0.08)', color: '#c27056' }}>
                    <span className="font-semibold">Original: </span>{vf.originalDescription}
                  </div>
                  <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(106,191,138,0.08)', color: '#6abf8a' }}>
                    <span className="font-semibold">Updated: </span>{vf.updatedInfo}
                  </div>
                </div>
              )}

              {/* Source link */}
              {vf.sourceUrl && (
                <a
                  href={vf.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
                  style={{ color: '#c8956c' }}
                >
                  <ExternalLink className="w-3 h-3" />
                  {vf.sourceTitle || 'View source'}
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Quiz
// ────────────────────────────────────────────────────────────────────────────

function QuizTab({ quizResults }: { quizResults?: QuizQuestion[] }) {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(new Set());

  if (!quizResults || quizResults.length === 0) {
    return (
      <div className="rounded-xl p-12 text-center" style={{ background: 'rgba(255,248,230,0.04)', border: '1px solid rgba(255,248,230,0.08)' }}>
        <HelpCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(245,240,224,0.3)' }} />
        <p className="text-sm font-semibold text-text-primary">No quiz questions yet</p>
        <p className="text-xs mt-1 text-text-muted">
          Quiz questions will appear here when the Quiz Builder agent completes.
        </p>
      </div>
    );
  }

  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = Object.entries(userAnswers).filter(
    ([qId, answer]) => quizResults.find(q => q.id === Number(qId))?.correctAnswer === answer,
  ).length;

  function handleSelectOption(questionId: number, option: string) {
    if (revealedQuestions.has(questionId)) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: option }));
    setRevealedQuestions(prev => new Set(prev).add(questionId));
  }

  return (
    <div className="space-y-6">
      {/* Score summary */}
      {answeredCount > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,248,230,0.04)', border: '1px solid rgba(255,248,230,0.08)' }}>
          <BarChart3 className="w-5 h-5 text-accent" />
          <div className="text-sm text-text-primary">
            <span className="font-bold" style={{ color: '#6abf8a' }}>{correctCount}</span>
            <span className="text-text-muted"> / {answeredCount} correct</span>
            <span className="text-text-muted ml-2">({quizResults.length - answeredCount} remaining)</span>
          </div>
          {answeredCount === quizResults.length && (
            <span className="ml-auto text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
              style={{
                background: correctCount === quizResults.length ? 'rgba(106,191,138,0.15)' : 'rgba(200,149,108,0.15)',
                color: correctCount === quizResults.length ? '#6abf8a' : '#c8956c',
              }}
            >
              {correctCount === quizResults.length ? 'Perfect Score' : 'Complete'}
            </span>
          )}
        </div>
      )}

      {/* Question cards */}
      {quizResults.map((q) => {
        const isRevealed = revealedQuestions.has(q.id);
        const userAnswer = userAnswers[q.id];
        const isCorrect = userAnswer === q.correctAnswer;

        return (
          <div key={q.id} className="rounded-xl overflow-hidden" style={{
            background: 'rgba(255,248,230,0.04)',
            border: `1px solid ${isRevealed ? (isCorrect ? '#6abf8a30' : '#c2705630') : 'rgba(255,248,230,0.08)'}`,
          }}>
            {/* Question header */}
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,248,230,0.06)' }}>
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'rgba(200,149,108,0.15)', color: '#c8956c' }}
              >
                {q.id}
              </span>
              <p className="text-sm font-semibold text-text-primary flex-1">{q.question}</p>
              <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(200,149,108,0.1)', color: '#c8956c' }}
              >
                {q.topic}
              </span>
            </div>

            {/* Options */}
            <div className="px-5 py-4 space-y-2">
              {q.options.map((option, oi) => {
                const letter = String.fromCharCode(65 + oi);
                const isSelected = userAnswer === option;
                const isCorrectOption = q.correctAnswer === option;

                let optionBg = 'rgba(255,248,230,0.04)';
                let optionBorder = 'rgba(255,248,230,0.08)';
                let optionColor = 'rgba(245,240,224,0.7)';
                let iconEl: React.ReactNode = null;

                if (isRevealed) {
                  if (isCorrectOption) {
                    optionBg = 'rgba(106,191,138,0.1)';
                    optionBorder = 'rgba(106,191,138,0.3)';
                    optionColor = '#6abf8a';
                    iconEl = <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#6abf8a' }} />;
                  } else if (isSelected && !isCorrectOption) {
                    optionBg = 'rgba(194,112,86,0.1)';
                    optionBorder = 'rgba(194,112,86,0.3)';
                    optionColor = '#c27056';
                    iconEl = <XCircle className="w-4 h-4 shrink-0" style={{ color: '#c27056' }} />;
                  }
                }

                return (
                  <button
                    key={oi}
                    onClick={() => handleSelectOption(q.id, option)}
                    disabled={isRevealed}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-left transition-all"
                    style={{
                      background: optionBg,
                      border: `1px solid ${optionBorder}`,
                      color: optionColor,
                      cursor: isRevealed ? 'default' : 'pointer',
                    }}
                  >
                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: isRevealed && isCorrectOption ? 'rgba(106,191,138,0.2)' : 'rgba(255,248,230,0.06)',
                        color: isRevealed && isCorrectOption ? '#6abf8a' : 'rgba(245,240,224,0.5)',
                      }}
                    >
                      {letter}
                    </span>
                    <span className="flex-1">{option}</span>
                    {iconEl}
                  </button>
                );
              })}
            </div>

            {/* Explanation (revealed after answer) */}
            {isRevealed && (
              <div className="px-5 py-3 text-xs leading-relaxed" style={{
                background: 'rgba(255,248,230,0.03)',
                borderTop: '1px solid rgba(255,248,230,0.06)',
                color: 'rgba(245,240,224,0.6)',
              }}>
                <span className="font-semibold text-text-primary">Explanation: </span>
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Course Summary Info Bar
// ────────────────────────────────────────────────────────────────────────────

function CourseSummaryBar({ summary }: { summary: CourseSummaryResult }) {
  const difficultyColor: Record<string, string> = {
    beginner: '#6abf8a',
    intermediate: '#c8956c',
    advanced: '#c27056',
  };

  return (
    <div className="rounded-xl p-4 mb-8 flex flex-wrap items-center gap-x-6 gap-y-3" style={{
      background: 'rgba(255,248,230,0.04)',
      border: '1px solid rgba(255,248,230,0.08)',
    }}>
      {/* Title */}
      <h3 className="text-sm font-bold text-text-primary truncate max-w-[280px]">{summary.courseTitle}</h3>

      {/* Difficulty badge */}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
        style={{ background: `${difficultyColor[summary.difficulty] || '#c8956c'}18`, color: difficultyColor[summary.difficulty] || '#c8956c' }}
      >
        {summary.difficulty}
      </span>

      {/* Duration */}
      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
        <Clock className="w-3 h-3" />
        {summary.estimatedDuration}
      </span>

      {/* Modules */}
      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
        <Layers className="w-3 h-3" />
        {summary.moduleCount} module{summary.moduleCount !== 1 ? 's' : ''}
      </span>

      {/* Objectives count */}
      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
        <CheckCircle2 className="w-3 h-3" />
        {summary.learningObjectives.length} objective{summary.learningObjectives.length !== 1 ? 's' : ''}
      </span>

      {/* Key topics as chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Tag className="w-3 h-3 text-text-muted" />
        {summary.keyTopics.slice(0, 5).map((topic, i) => (
          <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ background: 'rgba(200,149,108,0.1)', color: '#c8956c' }}
          >
            {topic}
          </span>
        ))}
        {summary.keyTopics.length > 5 && (
          <span className="text-[10px] text-text-muted">+{summary.keyTopics.length - 5}</span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: Course Module
// ────────────────────────────────────────────────────────────────────────────

function CourseModuleTab({
  slides,
  citations,
  courseSummaryResult,
  quizResults,
  pageImages,
  entries,
  topic,
  sector,
  tabContentRef,
}: {
  slides: DemoSlideEnhanced[];
  citations: DemoResult['citations'];
  courseSummaryResult?: CourseSummaryResult | null;
  quizResults?: QuizQuestion[];
  pageImages: string[];
  entries: RedlineEntry[];
  topic: string;
  sector: string;
  tabContentRef: React.RefObject<HTMLDivElement | null>;
}) {
  const moduleTitle = courseSummaryResult?.courseTitle || topic || 'Course Module';
  const moduleCount = courseSummaryResult?.moduleCount || slides.length;
  const objectives = courseSummaryResult?.learningObjectives || [];
  const difficulty = courseSummaryResult?.difficulty || 'intermediate';
  const duration = courseSummaryResult?.estimatedDuration || `${slides.length * 10} minutes`;

  const difficultyColors: Record<string, string> = {
    beginner: '#6abf8a',
    intermediate: '#c8956c',
    advanced: '#c27056',
  };

  function handleDownloadPPTX() {
    // Build an HTML representation styled like a PowerPoint
    const slidesHtml = slides.map((slide, idx) => {
      const bullets = slide.after.bullets.map(b => `<li style="margin-bottom:8px;font-size:16px;color:#333;">${b}</li>`).join('');
      return `
        <div style="page-break-after:always;padding:60px;min-height:700px;background:#fff;border:1px solid #e5e2db;margin-bottom:24px;border-radius:8px;">
          <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Slide ${idx + 1} of ${slides.length}</div>
          <h2 style="font-size:28px;font-weight:700;color:#1a1a1a;margin-bottom:8px;">${slide.after.title}</h2>
          ${slide.after.subtitle ? `<p style="font-size:14px;color:#666;margin-bottom:24px;">${slide.after.subtitle}</p>` : ''}
          <ul style="list-style:none;padding:0;">${bullets}</ul>
          ${slide.after.keyFact ? `<div style="margin-top:24px;padding:16px;background:#f8f3ec;border-left:4px solid #c8956c;border-radius:4px;font-size:18px;font-weight:600;color:#c8956c;">${slide.after.keyFact}</div>` : ''}
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${moduleTitle} - Presentation</title>
<style>body{font-family:'Segoe UI',Roboto,sans-serif;margin:0;padding:24px;background:#f5f5f5;}@media print{body{padding:0;background:#fff;}div{page-break-inside:avoid;}}</style>
</head><body>
<div style="page-break-after:always;padding:80px 60px;min-height:700px;background:linear-gradient(135deg,#FF6B5B,#4A3AFF);border-radius:8px;display:flex;flex-direction:column;justify-content:center;">
  <div style="font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:3px;margin-bottom:16px;">${sector}</div>
  <h1 style="font-size:42px;font-weight:800;color:#fff;margin-bottom:16px;line-height:1.15;">${moduleTitle}</h1>
  <p style="font-size:18px;color:rgba(255,255,255,0.8);max-width:500px;">${moduleCount} sections &middot; ${duration} &middot; ${difficulty} level</p>
</div>
${slidesHtml}
<div style="padding:60px;text-align:center;color:#999;font-size:12px;">Generated by CourseCorrect &middot; Powered by Gemini 3</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleTitle.replace(/[^a-zA-Z0-9]/g, '_')}_presentation.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleDownloadPDF() {
    // Generate a comprehensive PDF-style HTML document
    const sectionsHtml = slides.map((slide, idx) => {
      const bullets = slide.after.bullets.map(b => `<li style="margin-bottom:6px;line-height:1.6;">${b}</li>`).join('');
      const citationRefs = slide.after.citationIds.length > 0
        ? `<p style="font-size:11px;color:#999;margin-top:12px;">Sources: ${slide.after.citationIds.map(id => `[${id}]`).join(' ')}</p>`
        : '';
      return `
        <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #eee;">
          <h3 style="font-size:20px;font-weight:600;color:#1a1a1a;margin-bottom:8px;">${idx + 1}. ${slide.after.title}</h3>
          ${slide.after.subtitle ? `<p style="font-size:13px;color:#666;margin-bottom:12px;">${slide.after.subtitle}</p>` : ''}
          <ul style="padding-left:20px;color:#333;font-size:14px;">${bullets}</ul>
          ${slide.after.keyFact ? `<div style="margin-top:12px;padding:12px 16px;background:#faf6ee;border-radius:6px;font-weight:600;color:#8b6d47;">${slide.after.keyFact}</div>` : ''}
          ${citationRefs}
        </div>`;
    }).join('');

    const objectivesHtml = objectives.length > 0
      ? `<div style="margin-bottom:32px;padding:20px;background:#f5f8f5;border-radius:8px;border:1px solid #e0e8e0;">
           <h3 style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:12px;">Learning Objectives</h3>
           <ul style="padding-left:20px;color:#333;font-size:14px;">${objectives.map(o => `<li style="margin-bottom:6px;">${o}</li>`).join('')}</ul>
         </div>`
      : '';

    const citationsHtml = citations.length > 0
      ? `<div style="margin-top:40px;padding-top:24px;border-top:2px solid #eee;">
           <h3 style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:16px;">References</h3>
           ${citations.map(c => `<p style="font-size:12px;color:#666;margin-bottom:8px;">[${c.id}] ${c.title}${c.url !== '#' ? ` — ${c.url}` : ''}${c.accessedDate ? ` (Accessed ${c.accessedDate})` : ''}</p>`).join('')}
         </div>`
      : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${moduleTitle}</title>
<style>body{font-family:Georgia,'Times New Roman',serif;margin:0;padding:48px;max-width:800px;margin:0 auto;color:#1a1a1a;line-height:1.6;}@media print{body{padding:24px;}}</style>
</head><body>
<div style="margin-bottom:40px;padding-bottom:24px;border-bottom:2px solid #c8956c;">
  <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">${sector}</div>
  <h1 style="font-size:32px;font-weight:700;color:#1a1a1a;margin-bottom:8px;">${moduleTitle}</h1>
  <p style="font-size:14px;color:#666;">${moduleCount} sections &middot; ${duration} &middot; ${difficulty} level &middot; ${citations.length} verified sources</p>
</div>
${objectivesHtml}
${sectionsHtml}
${citationsHtml}
<div style="margin-top:40px;text-align:center;color:#ccc;font-size:11px;">Generated by CourseCorrect &middot; Powered by Gemini 3</div>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleTitle.replace(/[^a-zA-Z0-9]/g, '_')}_document.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleDownloadQuiz() {
    if (!quizResults || quizResults.length === 0) return;
    const questionsHtml = quizResults.map((q, idx) => {
      const options = q.options.map((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        const isCorrect = opt === q.correctAnswer;
        return `<div style="padding:8px 12px;margin-bottom:4px;border-radius:6px;font-size:14px;${isCorrect ? 'background:#e8f5e9;border:1px solid #a5d6a7;' : 'background:#f9f9f9;border:1px solid #eee;'}">
          <strong>${letter}.</strong> ${opt} ${isCorrect ? '<span style="color:#2e7d32;font-weight:600;">  ✓ Correct</span>' : ''}
        </div>`;
      }).join('');
      return `
        <div style="margin-bottom:28px;">
          <p style="font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:10px;">${idx + 1}. ${q.question}</p>
          ${options}
          <p style="font-size:12px;color:#666;margin-top:8px;padding:8px 12px;background:#f5f5f5;border-radius:6px;"><strong>Explanation:</strong> ${q.explanation}</p>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${moduleTitle} - Quiz</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:48px;max-width:700px;margin:0 auto;}</style>
</head><body>
<h1 style="font-size:28px;font-weight:700;margin-bottom:8px;">${moduleTitle} — Assessment</h1>
<p style="font-size:14px;color:#666;margin-bottom:32px;">${quizResults.length} questions &middot; ${sector}</p>
${questionsHtml}
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleTitle.replace(/[^a-zA-Z0-9]/g, '_')}_quiz.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const deliverables = [
    {
      id: 'pptx',
      icon: Presentation,
      title: 'Presentation',
      description: `${slides.length} modernized slides with updated content, citations, and modern layouts.`,
      color: '#FF6B5B',
      fileType: 'HTML Slides',
      ready: slides.length > 0,
      onDownload: handleDownloadPPTX,
    },
    {
      id: 'pdf',
      icon: FileType,
      title: 'Course Document',
      description: `Complete course document with all updated content, learning objectives, and verified references.`,
      color: '#4A3AFF',
      fileType: 'HTML Document',
      ready: slides.length > 0,
      onDownload: handleDownloadPDF,
    },
    {
      id: 'quiz',
      icon: BrainCircuit,
      title: 'Assessment Quiz',
      description: `${quizResults?.length || 0} certification-style questions with explanations and answer keys.`,
      color: '#8b5cf6',
      fileType: 'HTML Quiz',
      ready: !!quizResults && quizResults.length > 0,
      onDownload: handleDownloadQuiz,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Module header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,107,91,0.08), rgba(74,58,255,0.08))',
        border: '1px solid rgba(255,248,230,0.1)',
        borderRadius: 16, padding: '32px 28px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%',
          background: 'rgba(255,107,91,0.06)', filter: 'blur(40px)', pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Package className="w-5 h-5" style={{ color: '#c8956c' }} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#c8956c' }}>
              Full Course Module
            </span>
          </div>
          <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: 24, fontWeight: 700, color: '#f5f0e0', marginBottom: 8 }}>
            {moduleTitle}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'rgba(245,240,224,0.6)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Layers className="w-3.5 h-3.5" />
              {moduleCount} sections
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock className="w-3.5 h-3.5" />
              {duration}
            </span>
            <span style={{
              padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: `${difficultyColors[difficulty] || '#c8956c'}18`,
              color: difficultyColors[difficulty] || '#c8956c',
            }}>
              {difficulty}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {citations.length} sources
            </span>
          </div>
        </div>
      </div>

      {/* Deliverable cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {deliverables.map((d) => (
          <div key={d.id} style={{
            background: 'rgba(255,248,230,0.04)',
            border: `1px solid ${d.ready ? `${d.color}25` : 'rgba(255,248,230,0.06)'}`,
            borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden',
            transition: 'border-color 0.3s, transform 0.3s',
            opacity: d.ready ? 1 : 0.5,
          }}>
            {/* Accent bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: d.ready ? `linear-gradient(90deg, ${d.color}, ${d.color}40)` : 'rgba(255,248,230,0.06)',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${d.color}12`, border: `1px solid ${d.color}20`,
              }}>
                <d.icon className="w-6 h-6" style={{ color: d.color }} />
              </div>
              <div>
                <h4 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 16, color: '#f5f0e0' }}>
                  {d.title}
                </h4>
                <span style={{ fontSize: 11, color: 'rgba(245,240,224,0.4)' }}>{d.fileType}</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'rgba(245,240,224,0.6)', lineHeight: 1.6, marginBottom: 20 }}>
              {d.description}
            </p>

            <button
              onClick={d.ready ? d.onDownload : undefined}
              disabled={!d.ready}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 16px', borderRadius: 10,
                background: d.ready ? `linear-gradient(135deg, ${d.color}, ${d.color}cc)` : 'rgba(255,248,230,0.04)',
                color: d.ready ? '#fff' : 'rgba(245,240,224,0.3)',
                border: 'none', cursor: d.ready ? 'pointer' : 'default',
                fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 13,
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: d.ready ? `0 4px 15px ${d.color}25` : 'none',
              }}
              onMouseEnter={e => { if (d.ready) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${d.color}35`; } }}
              onMouseLeave={e => { if (d.ready) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 15px ${d.color}25`; } }}
            >
              <Download className="w-4 h-4" />
              {d.ready ? 'Download' : 'Generating...'}
            </button>
          </div>
        ))}
      </div>

      {/* Learning Objectives */}
      {objectives.length > 0 && (
        <div style={{
          background: 'rgba(255,248,230,0.04)', border: '1px solid rgba(255,248,230,0.08)',
          borderRadius: 16, padding: 24,
        }}>
          <h4 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 16, color: '#f5f0e0', marginBottom: 16 }}>
            Learning Objectives
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {objectives.map((obj, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#6abf8a' }} />
                <span style={{ fontSize: 14, color: 'rgba(245,240,224,0.7)', lineHeight: 1.5 }}>{obj}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick preview of slides */}
      <div style={{
        background: 'rgba(255,248,230,0.04)', border: '1px solid rgba(255,248,230,0.08)',
        borderRadius: 16, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h4 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 16, color: '#f5f0e0' }}>
            Slide Preview
          </h4>
          <span style={{ fontSize: 12, color: 'rgba(245,240,224,0.4)' }}>{slides.length} slides</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {slides.slice(0, 6).map((slide, idx) => (
            <div key={slide.id} style={{
              aspectRatio: '16/10', borderRadius: 10, overflow: 'hidden', position: 'relative',
              background: 'rgba(255,248,230,0.03)', border: '1px solid rgba(255,248,230,0.06)',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: `linear-gradient(135deg, ${idx % 2 === 0 ? 'rgba(255,107,91,0.08)' : 'rgba(74,58,255,0.08)'}, rgba(0,0,0,0.3))`,
              }} />
              <div style={{ position: 'relative', padding: 12, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 9, color: 'rgba(245,240,224,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Slide {idx + 1}
                  </span>
                  <h5 style={{ fontSize: 12, fontWeight: 600, color: '#f5f0e0', marginTop: 4, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {slide.after.title}
                  </h5>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(245,240,224,0.3)' }}>
                  {slide.after.bullets.length} bullet{slide.after.bullets.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))}
          {slides.length > 6 && (
            <div style={{
              aspectRatio: '16/10', borderRadius: 10, overflow: 'hidden',
              background: 'rgba(200,149,108,0.06)', border: '1px dashed rgba(200,149,108,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
            }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#c8956c' }}>+{slides.length - 6}</span>
              <span style={{ fontSize: 11, color: 'rgba(200,149,108,0.6)' }}>more slides</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

type DeliverableTab = 'course-module' | 'redline' | 'report' | 'annotated' | 'clean' | 'fact-check' | 'quiz';

const tabConfig: { id: DeliverableTab; label: string; icon: React.ReactNode; downloadLabel: string }[] = [
  { id: 'course-module', label: 'Course Module', icon: <Package className="w-4 h-4" />, downloadLabel: 'Download All' },
  { id: 'redline', label: 'Redline View', icon: <FileText className="w-4 h-4" />, downloadLabel: 'Download Redline PDF' },
  { id: 'report', label: 'Change Report', icon: <FileCheck className="w-4 h-4" />, downloadLabel: 'Download Report' },
  { id: 'clean', label: 'Clean Document', icon: <BookOpen className="w-4 h-4" />, downloadLabel: 'Download Clean PDF' },
  { id: 'fact-check', label: 'Fact Check', icon: <ShieldAlert className="w-3 h-3" />, downloadLabel: 'Download Fact Check' },
  { id: 'quiz', label: 'Quiz', icon: <HelpCircle className="w-3 h-3" />, downloadLabel: 'Download Quiz' },
];

const RegulatoryOutput: React.FC<RegulatoryOutputProps> = ({
  result,
  findings,
  approvedFindingIds,
  pageImages,
  extractedPages,
  selectedSector,
  location,
  topic,
  updateMode,
  onReset,
  verificationResults,
  quizResults,
  courseSummaryResult,
}) => {
  const [activeTab, setActiveTab] = useState<DeliverableTab>('course-module');
  const tabContentRef = useRef<HTMLDivElement>(null);

  const redlineEntries = useMemo(
    () => computeRedlineData(result, findings, approvedFindingIds),
    [result, findings, approvedFindingIds],
  );

  const changedCount = redlineEntries.filter(
    e => e.titleDiff.changed || e.bulletDiffs.some(b => b.type !== 'unchanged'),
  ).length;

  const activeTabConfig = tabConfig.find(t => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-background text-text-primary overflow-y-auto">
      {/* Atmospheric gradient */}
      <div className="fixed top-0 left-0 right-0 h-64 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(200,149,108,0.08), transparent)',
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">
              {updateMode === 'full' ? 'Full Modernization' : 'Regulatory Update'} — Results
            </p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-text-primary leading-tight mb-2">
              {changedCount} section{changedCount !== 1 ? 's' : ''} updated
            </h2>
            <p className="text-text-muted text-sm">
              {selectedSector} &middot; {location || 'United States'} &middot; {result.citations.length} verified source{result.citations.length !== 1 ? 's' : ''}
            </p>
            {result.metadata.searchQueries.length > 0 && (
              <p className="text-text-muted text-xs mt-2 flex items-center gap-1">
                <Search className="w-3 h-3" />
                Verified via: {result.metadata.searchQueries.slice(0, 3).join(', ')}
              </p>
            )}
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-text-muted transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> New analysis
          </button>
        </div>

        {/* Course Summary */}
        {courseSummaryResult && <CourseSummaryBar summary={courseSummaryResult} />}

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

        {/* Download button for active tab */}
        <div className="flex justify-end mb-6">
          <DownloadButton label={activeTabConfig.downloadLabel} tabId={activeTab} containerRef={tabContentRef} />
        </div>

        {/* Tab content */}
        <div ref={tabContentRef}>
          {activeTab === 'course-module' && (
            <CourseModuleTab
              slides={result.slides}
              citations={result.citations}
              courseSummaryResult={courseSummaryResult}
              quizResults={quizResults}
              pageImages={pageImages}
              entries={redlineEntries}
              topic={topic}
              sector={selectedSector}
              tabContentRef={tabContentRef}
            />
          )}
          {activeTab === 'redline' && (
            <RedlineView entries={redlineEntries} citations={result.citations} />
          )}
          {activeTab === 'report' && (
            <ChangeReportTab
              entries={redlineEntries}
              findings={findings}
              approvedFindingIds={approvedFindingIds}
              citations={result.citations}
              sector={selectedSector}
              location={location || 'United States'}
            />
          )}
          {activeTab === 'clean' && (
            <CleanDocumentTab slides={result.slides} citations={result.citations} pageImages={pageImages} entries={redlineEntries} />
          )}
          {activeTab === 'fact-check' && (
            <FactCheckTab verificationResults={verificationResults} />
          )}
          {activeTab === 'quiz' && (
            <QuizTab quizResults={quizResults} />
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

export default RegulatoryOutput;
