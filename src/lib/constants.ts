// SLA & Timing
export const SLA_BREACH_THRESHOLD_MS = 3_600_000; // 1 hour in milliseconds
export const POLLING_INTERVAL_DMS = 30_000; // 30 seconds
export const POLLING_INTERVAL_NOTIFICATIONS = 15_000; // 15 seconds
export const POLLING_INTERVAL_LEADS = 60_000; // 60 seconds
export const POLLING_INTERVAL_DASHBOARD = 45_000; // 45 seconds

// AI Confidence
export const CONFIDENCE_THRESHOLD_LOW = 0.7;
export const CONFIDENCE_THRESHOLD_MEDIUM = 0.85;
export const CONFIDENCE_THRESHOLD_HIGH = 0.95;

// Lead Scoring
export const LEAD_SCORE_HIGH_PRIORITY = 8.0;
export const LEAD_SCORE_MEDIUM_PRIORITY = 5.0;
export const LEAD_SCORE_LOW_PRIORITY = 3.0;
export const LEAD_SCORE_MIN = 0;
export const LEAD_SCORE_MAX = 10;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// DM Status Labels
export const DM_STATUS_LABELS: Record<string, string> = {
  new: "New",
  drafted: "Drafted",
  replied: "Replied",
  sent: "Sent",
  escalated: "Escalated",
};

// Platform Labels
export const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter",
  linkedin: "LinkedIn",
};

// Platform Colors (Tailwind class-friendly identifiers)
export const PLATFORM_COLORS: Record<string, string> = {
  instagram: "text-pink-600",
  facebook: "text-blue-600",
  twitter: "text-sky-500",
  linkedin: "text-blue-700",
};

// Platform Background Colors
export const PLATFORM_BG_COLORS: Record<string, string> = {
  instagram: "bg-pink-100",
  facebook: "bg-blue-100",
  twitter: "bg-sky-100",
  linkedin: "bg-blue-50",
};

// Draft Status Labels
export const DRAFT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  sent: "Sent",
  rejected: "Rejected",
};

// Lead Status Labels
export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};

// Lead Status Colors
export const LEAD_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-green-100 text-green-800",
  converted: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
};

// Notification Type Labels
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  new_dm: "New DM",
  high_priority_lead: "High Priority Lead",
  unassigned_lead: "Unassigned Lead",
  draft_ready: "Draft Ready",
  draft_sent: "Draft Sent",
  lead_assigned: "Lead Assigned",
  escalation: "Escalation",
};

// Notification Status Labels
export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  unread: "Unread",
  read: "Read",
  dismissed: "Dismissed",
};

// User Role Labels
export const USER_ROLE_LABELS: Record<string, string> = {
  agent: "Agent",
  manager: "Manager",
  admin: "Admin",
};

// Confidence Score Labels
export const getConfidenceLabel = (score: number): string => {
  if (score >= CONFIDENCE_THRESHOLD_HIGH) return "High";
  if (score >= CONFIDENCE_THRESHOLD_MEDIUM) return "Medium";
  if (score >= CONFIDENCE_THRESHOLD_LOW) return "Low";
  return "Very Low";
};

// Confidence Score Colors
export const getConfidenceColor = (score: number): string => {
  if (score >= CONFIDENCE_THRESHOLD_HIGH) return "text-green-600";
  if (score >= CONFIDENCE_THRESHOLD_MEDIUM) return "text-yellow-600";
  if (score >= CONFIDENCE_THRESHOLD_LOW) return "text-orange-600";
  return "text-red-600";
};

// Lead Score Priority Label
export const getLeadPriorityLabel = (score: number): string => {
  if (score >= LEAD_SCORE_HIGH_PRIORITY) return "High";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "Medium";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "Low";
  return "Very Low";
};

// Lead Score Priority Color
export const getLeadPriorityColor = (score: number): string => {
  if (score >= LEAD_SCORE_HIGH_PRIORITY) return "text-red-600";
  if (score >= LEAD_SCORE_MEDIUM_PRIORITY) return "text-yellow-600";
  if (score >= LEAD_SCORE_LOW_PRIORITY) return "text-blue-600";
  return "text-gray-500";
};