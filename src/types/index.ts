export interface Contact {
  id: string;
  email: string;
  company: string;
  status?: 'pending' | 'sent' | 'failed';
  error?: string;
  sent_at?: string;
  send_session_id?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface CvFile {
  name: string;
  size: number;
  uploadedAt: string;
  storageKey: string;
  storageUrl: string;
}

export interface ScheduleConfig {
  delayMs: number;
  startHour: number;
  endHour: number;
}

export interface AppConfig {
  templateSubject: string;
  templateBody: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFromName: string;
  cvStorageKey: string | null;
  cvStorageUrl: string | null;
  cvOriginalName: string | null;
  cvSize: number | null;
  cvUploadedAt: string | null;
  scheduleDelayMs: number;
  scheduleStartHour: number;
  scheduleEndHour: number;
}

export interface SendSession {
  id: string;
  status: 'running' | 'paused' | 'completed' | 'aborted';
  total: number;
  sentCount: number;
  failedCount: number;
  resumeAt: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface SendResult {
  contactId: string;
  email: string;
  company: string;
  success: boolean;
  error?: string;
}

export interface Profile {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export type TabId = 'contacts' | 'cv' | 'template' | 'smtp' | 'schedule' | 'send' | 'history';

export interface SmtpPreset {
  name: string;
  host: string;
  port: number;
  secure: boolean;
}
