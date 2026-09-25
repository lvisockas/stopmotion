export interface ExportState {
  status: 'idle' | 'queued' | 'running' | 'done' | 'error';
  progress: number;
  error?: string;
}
