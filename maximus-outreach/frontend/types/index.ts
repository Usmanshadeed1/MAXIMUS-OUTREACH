// ─── Auth & Users ──────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager";
  is_active: boolean;
  created_at: string;
  assigned_clients: AssignedClient[];
}

export interface AssignedClient {
  id: string;
  name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ─── Clients ────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  business_type?: string;
  services?: string;
  target_audience?: string;
  tone?: string;
  pitch?: string;
  website?: string;
  phone?: string;
  smtp_id?: string;
  from_email?: string;
  from_name?: string;
  custom_instructions?: string;
  is_active: boolean;
  created_at: string;
  lead_count?: number;
  active_campaigns_count?: number;
}

// ─── Leads ──────────────────────────────────────────────────────

export interface Lead {
  id: string;
  client_id: string;
  import_id?: string;
  business_name?: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  rating?: number;
  reviews?: number;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  twitter?: string;
  tiktok?: string;
  snapchat?: string;
  other_social?: Record<string, string>;
  source?: string;
  status: string;
  tags?: string[];
  notes?: string;
  imported_at: string;
  updated_at: string;
  available_channels?: string[];
}

export interface LeadImport {
  id: string;
  client_id: string;
  file_name: string;
  total_rows: number;
  imported_count: number;
  duplicates_skipped: number;
  errors_count: number;
  status: string;
  imported_at: string;
}

// ─── Campaigns ──────────────────────────────────────────────────

export interface CampaignStats {
  total_enrolled: number;
  total_activated: number;
  total_queued: number;
  total_completed: number;
  total_replied: number;
}

export interface Campaign {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  status: string;
  stop_on_reply: boolean;
  max_attempts: number;
  repeat_delay_days: number;
  pacing_mode: string;
  pacing_leads_per_day: Record<string, number>;
  send_window_start: string;
  send_window_end: string;
  send_timezone: string;
  total_enrolled: number;
  total_activated: number;
  created_at: string;
  updated_at: string;
  steps?: CampaignStep[];
  stats?: CampaignStats;
}

export interface CampaignStep {
  id: string;
  campaign_id: string;
  step_order: number;
  channel: string;
  delay_days: number;
  delay_hours: number;
  message_template?: string;
  use_ai_generation: boolean;
  ai_prompt_override?: string;
  subject_template?: string;
  is_active: boolean;
  created_at: string;
}

// ─── Conversations ──────────────────────────────────────────────

export interface Conversation {
  id: string;
  lead_id: string;
  client_id: string;
  channel: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  content: string;
  media_urls?: string[];
  is_ai_generated: boolean;
  is_approved: boolean;
  sent_at?: string;
  created_at: string;
}

// ─── Social DM Queue ────────────────────────────────────────────

export interface SocialDmQueueItem {
  id: string;
  lead_id: string;
  client_id: string;
  platform: string;
  profile_url: string;
  message_content: string;
  status: string;
  scheduled_for?: string;
  sent_at?: string;
  created_at: string;
}

// ─── Settings ───────────────────────────────────────────────────

export interface SmtpSetting {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  use_tls: boolean;
  is_default: boolean;
  daily_limit: number;
  sent_today: number;
  warmup_enabled: boolean;
  warmup_start_date?: string;
  warmup_current_daily_limit: number;
  is_active: boolean;
  last_health_check?: string;
  health_status: string;
  created_at: string;
}

export interface AiApiKey {
  id: string;
  provider: string;
  base_url: string;
  model_name: string;
  label?: string;
  is_active: boolean;
  priority: number;
  requests_today: number;
  daily_limit: number;
  last_health_check?: string;
  health_status: string;
  last_error?: string;
  created_at: string;
}

// ─── Analytics ──────────────────────────────────────────────────

export interface DashboardStats {
  total_leads: number;
  messages_sent: number;
  replies: number;
  reply_rate: number;
}

// ─── Pagination ─────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
