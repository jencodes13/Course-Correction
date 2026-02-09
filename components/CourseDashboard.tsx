import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, FolderOpen, Shield, Palette, Zap, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { useWorkflow } from '../contexts/WorkflowContext';
import { AppStep } from '../types';
import {
  getProjects,
  getProjectAnalysis,
  deleteProject as deleteProjectApi,
  type Project,
  type Analysis,
} from '../services/supabaseClient';

interface ProjectWithAnalysis {
  project: Project;
  analysis: Analysis | null;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const goalConfig = {
  regulatory: { icon: Shield, label: 'Regulatory', color: 'text-blue-400' },
  visual: { icon: Palette, label: 'Visual', color: 'text-purple-400' },
  full: { icon: Zap, label: 'Full Update', color: 'text-accent' },
};

const statusConfig: Record<string, { label: string; classes: string }> = {
  draft: { label: 'Draft', classes: 'bg-text-muted/10 text-text-muted' },
  analyzing: { label: 'Analyzing', classes: 'bg-accent/10 text-accent' },
  reviewed: { label: 'Reviewed', classes: 'bg-success/10 text-success' },
  exported: { label: 'Exported', classes: 'bg-blue-500/10 text-blue-400' },
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-text-muted font-medium tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

const CourseDashboard: React.FC = () => {
  const {
    goToStep,
    clearProjectData,
    setCurrentProjectId,
    setProjectName,
    setProjectConfig,
    setAnalysis,
  } = useWorkflow();

  const [projects, setProjects] = useState<ProjectWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await getProjects();
      const withAnalyses = await Promise.all(
        projectList.map(async (project) => {
          try {
            const analysis = await getProjectAnalysis(project.id);
            return { project, analysis };
          } catch {
            return { project, analysis: null };
          }
        })
      );
      setProjects(withAnalyses);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load projects';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleNewCourse = () => {
    clearProjectData();
    goToStep(AppStep.INGESTION);
  };

  const handleOpenProject = (item: ProjectWithAnalysis) => {
    setCurrentProjectId(item.project.id);
    setProjectName(item.project.title);
    if (item.project.goal) {
      setProjectConfig({
        goal: item.project.goal,
        targetAudience: item.project.target_audience || '',
        standardsContext: item.project.standards_context || '',
        location: item.project.location?.state || item.project.location?.country || '',
      });
    }
    if (item.analysis) {
      setAnalysis({
        freshnessScore: item.analysis.freshness_score,
        engagementScore: item.analysis.engagement_score,
        freshnessIssues: item.analysis.freshness_issues.map((i) => i.description),
        engagementIssues: item.analysis.engagement_issues.map((i) => i.description),
        summary: item.analysis.summary,
      });
      goToStep(AppStep.DIAGNOSIS);
    } else {
      goToStep(AppStep.CONFIGURATION);
    }
  };

  const handleDelete = async (projectId: string) => {
    try {
      setDeletingId(projectId);
      await deleteProjectApi(projectId);
      setProjects((prev) => prev.filter((p) => p.project.id !== projectId));
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete project';
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="flex items-center gap-2 text-warning">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={loadProjects}
          className="px-4 py-2 text-sm font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">My Courses</h1>
          <p className="text-sm text-text-muted mt-1">
            {projects.length} {projects.length === 1 ? 'course' : 'courses'}
          </p>
        </div>
        <button
          onClick={handleNewCourse}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-background font-heading font-bold text-sm rounded-lg transition-colors shadow-lg shadow-accent/20"
        >
          <Plus className="w-4 h-4" />
          New Course
        </button>
      </div>

      {/* Empty State */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-surface-border flex items-center justify-center mb-6">
            <FolderOpen className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-lg font-heading font-semibold text-text-primary mb-2">No courses yet</h2>
          <p className="text-sm text-text-muted mb-6 max-w-sm">
            Upload your first course to start scanning for outdated regulations and stale designs.
          </p>
          <button
            onClick={handleNewCourse}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-background font-heading font-bold text-sm rounded-lg transition-colors shadow-lg shadow-accent/20"
          >
            <Plus className="w-4 h-4" />
            Upload Your First Course
          </button>
        </div>
      ) : (
        /* Project Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(({ project, analysis }) => {
            const goal = goalConfig[project.goal] || goalConfig.full;
            const GoalIcon = goal.icon;
            const status = statusConfig[project.status] || statusConfig.draft;

            return (
              <div
                key={project.id}
                className="bg-card border border-surface-border rounded-xl p-5 hover:border-accent/30 transition-all group cursor-pointer"
                onClick={() => handleOpenProject({ project, analysis })}
              >
                {/* Top row: goal icon + status badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${goal.color}`}>
                    <GoalIcon className="w-3.5 h-3.5" />
                    {goal.label}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.classes}`}>
                    {status.label}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-sm font-heading font-semibold text-text-primary mb-3 line-clamp-2 group-hover:text-accent transition-colors">
                  {project.title}
                </h3>

                {/* Scores */}
                {analysis && (
                  <div className="space-y-2 mb-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Freshness</span>
                      </div>
                      <ScoreBar
                        score={analysis.freshness_score}
                        color={analysis.freshness_score >= 70 ? 'bg-success' : analysis.freshness_score >= 40 ? 'bg-accent' : 'bg-warning'}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Engagement</span>
                      </div>
                      <ScoreBar
                        score={analysis.engagement_score}
                        color={analysis.engagement_score >= 70 ? 'bg-success' : analysis.engagement_score >= 40 ? 'bg-accent' : 'bg-warning'}
                      />
                    </div>
                  </div>
                )}

                {!analysis && (
                  <div className="text-xs text-text-muted italic mb-3">Not yet analyzed</div>
                )}

                {/* Footer: dates + actions */}
                <div className="flex items-center justify-between pt-3 border-t border-surface-border">
                  <span className="text-[10px] text-text-muted">
                    Updated {relativeTime(project.updated_at)}
                  </span>
                  <div className="flex items-center gap-1">
                    {confirmDeleteId === project.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(project.id)}
                          disabled={deletingId === project.id}
                          className="text-[10px] font-bold text-warning hover:text-red-400 px-2 py-1 rounded transition-colors"
                        >
                          {deletingId === project.id ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[10px] text-text-muted hover:text-text-primary px-2 py-1 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(project.id);
                          }}
                          className="p-1.5 text-text-muted hover:text-warning rounded-md hover:bg-surface transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CourseDashboard;
