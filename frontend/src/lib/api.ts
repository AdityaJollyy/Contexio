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
  RegularSearchResponse,
  ChatPayload,
  ChatResponse,
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

// --- Auth ---
export const signup = async (
  payload: SignupPayload,
): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/auth/signup", payload);
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

// --- Content ---
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

// --- Search ---
export const regularSearch = async (
  query: string,
): Promise<RegularSearchResponse> => {
  const res = await api.get<RegularSearchResponse>("/search", {
    params: { query },
  });
  return res.data;
};

export const chatWithBrain = async (
  payload: ChatPayload,
): Promise<ChatResponse> => {
  const res = await api.post<ChatResponse>("/search/chat", payload);
  return res.data;
};
