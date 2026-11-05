// DTO types mirroring docs/tech-spec.md section 4. Money values are decimal strings; never parse them to numbers.

export type Role = 'USER' | 'ADMIN';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  quotaOverrideUsd: string | null;
}

export interface LoginResponse {
  token: string;
  user: UserDto;
}

export interface QuotaPart {
  quotaUsd: string;
  usedUsd: string;
  remainingUsd: string;
  remainingPct: string;
  periodStart: string;
  resetsAt: string;
  resetsAtIst: string;
}

export interface QuotaStatus {
  user: QuotaPart & { isOverride: boolean };
  system: QuotaPart;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export interface Settings {
  systemQuotaUsd: string;
  defaultUserQuotaUsd: string;
  userResetDow: number;
  systemResetDom: number;
  updatedAt?: string;
}

export interface SummaryUser {
  userId: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  usedUsd: string;
  quotaUsd: string;
  remainingUsd: string;
  usedPct: string;
  isOverride: boolean;
}

export interface UsageSummary {
  system: QuotaPart;
  users: SummaryUser[];
}

export interface DailyRow {
  date: string;
  userId: string;
  userName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  requestCount: number;
}

export interface DailyUsage {
  rows: DailyRow[];
  totals: { inputTokens: number; outputTokens: number; costUsd: string; requestCount: number };
}

export interface ChatDoneEvent {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: string };
  quota: QuotaStatus;
}
