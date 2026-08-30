export interface User {
  username: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface MeResponse {
  user: User;
}

export interface SignupPayload {
  email: string;
  username: string;
  password: string;
}

export interface SigninPayload {
  email: string;
  password: string;
}

export type ContentType = "youtube" | "twitter" | "github" | "text" | "others";
export type ProcessingStatus = "pending" | "processing" | "ready" | "failed";
export type FilterType = ContentType | "all" | "search";

export interface ContentItem {
  _id: string;
  title: string;
  description: string;
  link: string;
  type: ContentType;
  status: ProcessingStatus;
  topics: string[];
  /** The page could not be read; the item is findable from title and note. */
  partial?: boolean;
  /** One user-facing sentence, set only when status is 'failed'. */
  failureReason?: string;
  /** User-initiated retries. One is enough to stop offering another. */
  manualRetries?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContentPayload {
  title: string;
  description?: string;
  type: ContentType;
  link?: string;
}

export interface UpdateContentPayload {
  title?: string;
  description?: string;
  type?: ContentType;
  link?: string;
}

export interface GetContentsResponse {
  contents: ContentItem[];
}

export interface CreateContentResponse {
  message: string;
  content: ContentItem;
}

export interface UpdateContentResponse {
  message: string;
  content: ContentItem;
}

export interface DeleteContentResponse {
  message: string;
}

export interface RetryContentResponse {
  message: string;
  content: ContentItem;
}

export interface RegularSearchResponse {
  results: ContentItem[];
  /** Fuzzy near-misses. Only populated when tier 1 came back thin. */
  suggestions: ContentItem[];
  total: number;
}

export interface ChatSource {
  _id: string;
  title: string;
  description: string;
  link: string;
  type: ContentType;
  topics: string[];
  createdAt: string;
  score: number;
}

export interface ChatQuota {
  used: number;
  limit: number;
}

/** A match beyond the sourced few: enough to render a card, no AI prose. */
export interface MatchSummary {
  contentId: string;
  title: string;
  link: string;
  type: ContentType;
  createdAt: string;
}

export interface ChatDoneEvent {
  text?: string;
  sources: ChatSource[];
  /** Every match above the floor, score-sorted, capped server-side. */
  allMatches: MatchSummary[];
  /** True count above the floor; may exceed allMatches.length. */
  totalMatches: number;
  /** The scan hit its ceiling, so totalMatches is a lower bound. */
  totalCapped: boolean;
  quota: ChatQuota;
}

export interface ChatPayload {
  query: string;
}

export interface QuotaResponse {
  used: number;
  limit: number;
}
