// Enums

export enum Platform {
  Instagram = "instagram",
  Facebook = "facebook",
  Twitter = "twitter",
  LinkedIn = "linkedin",
}

export enum DMStatus {
  New = "new",
  Drafted = "drafted",
  Replied = "replied",
  Sent = "sent",
  Escalated = "escalated",
}

export enum DraftStatus {
  Pending = "pending",
  Approved = "approved",
  Sent = "sent",
  Rejected = "rejected",
}

export enum LeadPriority {
  Low = "low",
  Medium = "medium",
  High = "high",
  Critical = "critical",
}

export enum LeadStatus {
  New = "new",
  Contacted = "contacted",
  Qualified = "qualified",
  Converted = "converted",
  Lost = "lost",
}

export enum NotificationType {
  NewDM = "new_dm",
  HighPriorityLead = "high_priority_lead",
  UnassignedLead = "unassigned_lead",
  DraftReady = "draft_ready",
  DraftSent = "draft_sent",
  LeadAssigned = "lead_assigned",
  Escalation = "escalation",
}

export enum NotificationStatus {
  Unread = "unread",
  Read = "read",
  Dismissed = "dismissed",
}

export enum UserRole {
  Agent = "agent",
  Manager = "manager",
  Admin = "admin",
}

// Base entity interfaces

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface DM {
  id: string;
  platform: string;
  senderName: string;
  senderHandle: string;
  message: string;
  timestamp: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  id: string;
  dmId: string;
  content: string;
  confidenceScore: number;
  isEdited: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  dmId: string;
  name: string;
  contact: string | null;
  budget: string | null;
  location: string | null;
  intent: string | null;
  score: number;
  priorityFlag: boolean;
  salesforceId: string | null;
  status: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  leadId: string | null;
  dmId: string | null;
  type: string;
  status: string;
  recipient: string;
  details: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  details: string | null;
  createdAt: string;
}

// API Response DTOs

export interface DMResponse extends DM {
  drafts?: DraftResponse[];
  leads?: LeadResponse[];
  notifications?: NotificationResponse[];
}

export interface DraftResponse extends Draft {
  dm?: DM;
}

export interface LeadResponse extends Lead {
  dm?: DM;
  assignedUser?: User | null;
  notifications?: NotificationResponse[];
}

export interface NotificationResponse extends Notification {
  lead?: Lead | null;
  dm?: DM | null;
}

export interface AuditLogResponse extends AuditLog {
  user?: User | null;
}

// API Request DTOs

export interface CreateDraftRequest {
  dmId: string;
  content?: string;
}

export interface UpdateDraftRequest {
  content: string;
  isEdited?: boolean;
  status?: string;
}

export interface ApproveDraftRequest {
  draftId: string;
}

export interface UpdateLeadRequest {
  status?: string;
  assignedTo?: string | null;
  priorityFlag?: boolean;
  score?: number;
  salesforceId?: string | null;
  budget?: string | null;
  location?: string | null;
  intent?: string | null;
}

export interface AssignLeadRequest {
  leadId: string;
  assignedTo: string;
}

export interface UpdateNotificationRequest {
  status: string;
}

export interface SalesforceCreateRequest {
  leadId: string;
  name: string;
  contact: string | null;
  budget: string | null;
  location: string | null;
  intent: string | null;
  score: number;
  priorityFlag: boolean;
}

export interface SalesforceCreateResponse {
  success: boolean;
  salesforceId: string | null;
  error?: string;
}

// AI/ML Result Types

export interface LeadScoreResult {
  score: number;
  priorityFlag: boolean;
  intent: string | null;
  budget: string | null;
  location: string | null;
  confidence: number;
  reasoning: string;
}

export interface PIICheckResult {
  hasPII: boolean;
  detectedTypes: string[];
  sanitizedContent: string;
  originalContent: string;
}

export interface DraftGenerationResult {
  content: string;
  confidenceScore: number;
  tokensUsed: number;
}

// Pagination & Filtering

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface DMFilterParams extends PaginationParams {
  platform?: string;
  status?: string;
  search?: string;
}

export interface LeadFilterParams extends PaginationParams {
  status?: string;
  assignedTo?: string;
  priorityFlag?: boolean;
  minScore?: number;
  maxScore?: number;
}

export interface NotificationFilterParams extends PaginationParams {
  type?: string;
  status?: string;
  recipient?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// API Error Response

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, string[]>;
}

// Dashboard Stats

export interface DashboardStats {
  totalDMs: number;
  newDMs: number;
  totalLeads: number;
  highPriorityLeads: number;
  pendingDrafts: number;
  unreadNotifications: number;
  averageLeadScore: number;
  conversionRate: number;
}