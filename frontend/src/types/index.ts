export type SourceVideo = {
  id: number;
  project_id: number;
  original_filename: string;
  stored_path: string;
  file_url: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  created_at: string;
};

export type TranscriptSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

export type Transcript = {
  id: number;
  project_id: number;
  language: string | null;
  model_name: string;
  raw_json_path: string;
  raw_json_url: string;
  text: string;
  created_at: string;
  segments: TranscriptSegment[];
};

export type ExportRecord = {
  id: number;
  clip_candidate_id: number;
  output_path: string | null;
  output_url: string | null;
  subtitle_path: string | null;
  subtitle_url: string | null;
  thumbnail_path: string | null;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  clip_title?: string | null;
  project_id?: number | null;
};

export type WorkflowJob = {
  id: number;
  project_id: number;
  clip_candidate_id: number | null;
  job_type: string;
  status: string;
  progress: number;
  message: string | null;
  error_detail: string | null;
  payload_json: Record<string, unknown> | null;
  result_json: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  project_title?: string | null;
  clip_title?: string | null;
};

export type ClipCandidate = {
  id: number;
  project_id: number;
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  hook_text: string;
  suggested_title: string;
  suggested_description: string;
  suggested_hashtags: string;
  subtitle_preset: string;
  status: string;
  created_at: string;
  updated_at: string;
  recommended_format?: string;
  virality_label?: string;
  selection_reason?: string;
  selection_signals?: string[];
  timeline_label?: string | null;
  source_runtime_seconds?: number | null;
  latest_export?: ExportRecord | null;
};

export type Project = {
  id: number;
  title: string;
  source_type: string;
  source_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  source_video?: SourceVideo | null;
  latest_transcript?: Transcript | null;
  clip_count: number;
  pending_clip_count: number;
  rejected_clip_count: number;
  approved_clip_count: number;
  export_count: number;
  latest_export?: ExportRecord | null;
  transcript_status?: string;
  clip_generation_status?: string;
  next_action?: string;
};

export type PublishJob = {
  id: number;
  clip_candidate_id: number;
  platform: string;
  adapter_name: string;
  status: string;
  payload_json: Record<string, unknown> | null;
  result_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  clip_title?: string | null;
  project_id?: number | null;
};

export type PlatformStatus = {
  platform: string;
  adapter_name: string;
  status: string;
  account_label: string;
};

export type PublishQueueResponse = {
  items: PublishJob[];
  platforms: PlatformStatus[];
};

export type BinaryStatus = {
  name: string;
  configured: string;
  available: boolean;
  resolved_path?: string | null;
  version?: string | null;
};

export type StoragePathStatus = {
  name: string;
  path: string;
  exists: boolean;
};

export type SystemStatus = {
  api_status: string;
  database_url: string;
  whisper_model_size: string;
  whisper_device: string;
  binaries: BinaryStatus[];
  storage: StoragePathStatus[];
  total_projects: number;
  completed_exports: number;
  queued_publish_jobs: number;
};

export type DashboardSummary = {
  total_projects: number;
  pending_review_count: number;
  approved_count: number;
  export_count: number;
  recent_projects: Project[];
  recent_exports: ExportRecord[];
  pending_review_clips: ClipCandidate[];
};
