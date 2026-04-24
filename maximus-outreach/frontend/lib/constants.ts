export const ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
} as const;

export const CHANNELS = {
  EMAIL: "email",
  SMS: "sms",
  MMS: "mms",
  WHATSAPP: "whatsapp",
  SOCIAL_DM: "social_dm",
} as const;

export const LEAD_STATUSES = {
  NEW: "new",
  CONTACTED: "contacted",
  REPLIED: "replied",
  QUALIFIED: "qualified",
  CUSTOMER: "customer",
  OPTED_OUT: "opted_out",
} as const;

export const CAMPAIGN_STATUSES = {
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
} as const;

export const PACING_MODES = {
  ALL_AT_ONCE: "all_at_once",
  FIXED_DAILY: "fixed_daily",
  GRADUAL_RAMPUP: "gradual_rampup",
  CUSTOM: "custom",
} as const;

export const ENROLLMENT_STATUSES = {
  QUEUED: "queued",
  ACTIVE: "active",
  COMPLETED: "completed",
  REPLIED: "replied",
  STOPPED: "stopped",
} as const;
