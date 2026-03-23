export interface User {
  username: string;
  isDemo: boolean;
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
export type ProcessingStatus =
  | "pending"
  | "processing"
  | "retrying"
  | "ready"
  | "failed";
export type FilterType = ContentType | "all" | "search";

export interface ContentItem {
  _id: string;
  title: string;
  description: string;
  link: string;
  type: ContentType;
  status: ProcessingStatus;
  retryCount: number;
  retryAfter: string | null;
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

export interface RegularSearchResponse {
  contents: ContentItem[];
}

export interface ChatSource {
  _id: string;
  title: string;
  description: string;
  link: string;
  score: number;
}

export interface ChatResponse {
  answer: string;
  sources?: ChatSource[];
}

export interface ChatPayload {
  query: string;
}
