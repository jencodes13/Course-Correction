const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface ApiError {
  error: string;
}

export interface CourseAnalysisRequest {
  course_materials: string;
  project_id?: string;
}

export interface CourseAnalysisResponse {
  structure: {
    main_topics: string[];
    learning_objectives: string[];
    key_concepts: string[];
    difficulty_level: string;
    estimated_duration: string;
  };
  identified_topics: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  questions: Array<{
    id: string;
    question: string;
    type: string;
    options?: string[];
  }>;
}

export interface GenerateContentRequest {
  course_materials: string;
  structure: Record<string, unknown>;
  project_id?: string;
}

export interface FileUploadResponse {
  file_name: string;
  file_type: string;
  file_size: number;
  course_text: string;
  extracted_length: number;
  file_id?: string;
}

export interface CreateProjectRequest {
  user_id: string;
  name: string;
}

export interface SavePreferencesRequest {
  project_id: string;
  theme_selection: string;
  emphasis_topics: string[];
  exclude_topics: string[];
  custom_instructions: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export interface TransformJobResponse {
  job_id: string;
  message: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface JobResultResponse {
  job_id: string;
  outputs: {
    pdf_content: string;
    quiz: any;
    slideshow_outline: string;
    video_script: string;
    structure: any;
  };
  completed_at: string;
}

export interface VideoTranscriptRequest {
  video_file_id: string;
  project_id: string;
  video_name: string;
  video_size: number;
}

export interface VideoTranscriptResponse {
  success: boolean;
  transcript_id: string;
  message: string;
  status: string;
}

export interface VideoTranscript {
  id: string;
  project_id: string;
  original_video_name: string;
  transcript_text: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  video_file_size: number;
  storage_path: string;
  error_message: string;
  created_at: string;
  completed_at?: string;
}

export const api = {
  health: {
    check: async () => {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      return handleResponse(response);
    },
  },

  transform: {
    start: async (file: File, projectId?: string): Promise<TransformJobResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) {
        formData.append('project_id', projectId);
      }

      const response = await fetch(`${API_BASE_URL}/api/transform`, {
        method: 'POST',
        body: formData,
      });
      return handleResponse(response);
    },

    getStatus: async (jobId: string): Promise<JobStatusResponse> => {
      const response = await fetch(`${API_BASE_URL}/api/status/${jobId}`);
      return handleResponse(response);
    },

    getResult: async (jobId: string): Promise<JobResultResponse> => {
      const response = await fetch(`${API_BASE_URL}/api/result/${jobId}`);
      return handleResponse(response);
    },
  },

  course: {
    analyze: async (data: CourseAnalysisRequest): Promise<CourseAnalysisResponse> => {
      const response = await fetch(`${API_BASE_URL}/api/course/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },

    generatePdf: async (data: GenerateContentRequest) => {
      const response = await fetch(`${API_BASE_URL}/api/course/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },

    generateQuiz: async (data: GenerateContentRequest) => {
      const response = await fetch(`${API_BASE_URL}/api/course/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },

    generateSlideshow: async (data: GenerateContentRequest) => {
      const response = await fetch(`${API_BASE_URL}/api/course/generate-slideshow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },

    generateVideo: async (data: GenerateContentRequest) => {
      const response = await fetch(`${API_BASE_URL}/api/course/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },

    transformFull: async (data: { course_materials: string; project_id?: string; selected_updates?: string[] }) => {
      const response = await fetch(`${API_BASE_URL}/api/course/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },
  },

  upload: {
    file: async (file: File, projectId?: string, fileCategory: string = 'course_material'): Promise<FileUploadResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) {
        formData.append('project_id', projectId);
      }
      formData.append('file_category', fileCategory);

      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      return handleResponse(response);
    },
  },

  project: {
    create: async (data: CreateProjectRequest) => {
      const response = await fetch(`${API_BASE_URL}/api/project/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },

    get: async (projectId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/project/${projectId}`);
      return handleResponse(response);
    },

    getFiles: async (projectId: string) => {
      const response = await fetch(`${API_BASE_URL}/api/project/${projectId}/files`);
      return handleResponse(response);
    },
  },

  preferences: {
    save: async (data: SavePreferencesRequest) => {
      const response = await fetch(`${API_BASE_URL}/api/preferences/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },
  },

  videoTranscript: {
    create: async (data: VideoTranscriptRequest): Promise<VideoTranscriptResponse> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/video-transcriber`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },

    getStatus: async (transcriptId: string): Promise<VideoTranscript> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/video-transcriber?transcript_id=${transcriptId}`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return handleResponse(response);
    },

    getByProject: async (projectId: string): Promise<{ transcripts: VideoTranscript[] }> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/video-transcriber?project_id=${projectId}`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return handleResponse(response);
    },
  },

  regulationResearch: {
    perform: async (data: {
      project_id?: string;
      course_field: string;
      last_updated_date?: string;
      course_topics: string[];
      course_content_sample: string;
    }) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/regulation-researcher`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    },
  },
};
