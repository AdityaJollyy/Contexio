import axios from "axios";

/**
 * Extracts a user-friendly error message from an API error
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return "Something went wrong";
}
