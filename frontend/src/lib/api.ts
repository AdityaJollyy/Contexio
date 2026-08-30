import axios from "axios";
import { clearAuth } from "./auth";
import type {
  AuthResponse,
  MeResponse,
  SignupPayload,
  SigninPayload,
  GetContentsResponse,
  CreateContentPayload,
  CreateContentResponse,
  UpdateContentPayload,
  UpdateContentResponse,
  DeleteContentResponse,
  RetryContentResponse,
  RegularSearchResponse,
  ChatPayload,
  ChatDoneEvent,
  QuotaResponse,
} from "@/types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAuth();
      window.location.href = "/signin";
    }
    return Promise.reject(error);
  },
);

export const signup = async (payload: SignupPayload): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>("/auth/signup", payload);
  return res.data;
};

export const signin = async (payload: SigninPayload): Promise<AuthResponse> => {
  const res = await api.post<AuthResponse>("/auth/signin", payload);
  return res.data;
};

export const getMe = async (): Promise<MeResponse> => {
  const res = await api.get<MeResponse>("/auth/me");
  return res.data;
};

export const getContents = async (): Promise<GetContentsResponse> => {
  const res = await api.get<GetContentsResponse>("/content");
  return res.data;
};

export const createContent = async (
  payload: CreateContentPayload,
): Promise<CreateContentResponse> => {
  const res = await api.post<CreateContentResponse>("/content", payload);
  return res.data;
};

export const updateContent = async (
  id: string,
  payload: UpdateContentPayload,
): Promise<UpdateContentResponse> => {
  const res = await api.put<UpdateContentResponse>(`/content/${id}`, payload);
  return res.data;
};

export const removeContent = async (
  id: string,
): Promise<DeleteContentResponse> => {
  const res = await api.delete<DeleteContentResponse>(`/content/${id}`);
  return res.data;
};

export const retryContent = async (
  id: string,
): Promise<RetryContentResponse> => {
  const res = await api.post<RetryContentResponse>(`/content/${id}/retry`);
  return res.data;
};

export const regularSearch = async (
  query: string,
): Promise<RegularSearchResponse> => {
  const res = await api.get<RegularSearchResponse>("/search", {
    params: { query },
  });
  return res.data;
};

export const getAiQuota = async (): Promise<QuotaResponse> => {
  const res = await api.get<QuotaResponse>("/search/quota");
  return res.data;
};

const FRAME_SEPARATOR = "\n\n";

/**
 * EventSource cannot send an Authorization header, so the SSE stream is read
 * off a fetch body instead. Everything else stays on axios.
 */
export const chatWithBrainStream = async (
  payload: ChatPayload,
  onToken: (text: string) => void,
  onDone: (data: ChatDoneEvent) => void,
  signal?: AbortSignal,
): Promise<void> => {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL as string}/search/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
      },
      body: JSON.stringify(payload),
      signal,
    },
  );

  // Matches the axios interceptor's behaviour, which this call bypasses.
  if (res.status === 401) {
    clearAuth();
    window.location.href = "/signin";
    return;
  }

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
      used?: number;
      limit?: number;
    } | null;
    const error = new Error(body?.message ?? "Search failed") as Error & {
      status: number;
      used?: number;
      limit?: number;
    };
    error.status = res.status;
    if (body?.used !== undefined) error.used = body.used;
    if (body?.limit !== undefined) error.limit = body.limit;
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf(FRAME_SEPARATOR);
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + FRAME_SEPARATOR.length);
      boundary = buffer.indexOf(FRAME_SEPARATOR);

      let event = "";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;

      if (event === "token") {
        onToken((JSON.parse(data) as { text: string }).text);
      } else if (event === "done") {
        onDone(JSON.parse(data) as ChatDoneEvent);
      } else if (event === "error") {
        throw new Error((JSON.parse(data) as { message: string }).message);
      }
    }
  }
};
