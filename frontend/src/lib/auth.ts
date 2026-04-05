import { jwtDecode } from "jwt-decode";
import type { User } from "@/types";

interface JwtPayload {
  id: string;
  exp: number;
}

export function saveAuth(token: string, user: User): void {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function getUser(): User | null {
  const stored = localStorage.getItem("user");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  const token = getToken();
  if (!token) return false;

  try {
    const { exp } = jwtDecode<JwtPayload>(token);
    // exp is in seconds, Date.now() is in milliseconds
    return Date.now() < exp * 1000;
  } catch {
    // Token is malformed — treat as logged out and clean up
    clearAuth();
    return false;
  }
}
