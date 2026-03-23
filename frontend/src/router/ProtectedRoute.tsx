import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isLoggedIn, clearAuth } from "@/lib/auth";
import { getMe } from "@/lib/api";
import { ContentProvider } from "@/store/ContentProvider";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const hasToken = isLoggedIn();

  const { isLoading, isError } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    enabled: hasToken,
    retry: false,
  });

  if (!hasToken) {
    return <Navigate to="/signin" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-purple-600" />
      </div>
    );
  }

  if (isError) {
    clearAuth();
    return <Navigate to="/signin" replace />;
  }

  return <ContentProvider>{children}</ContentProvider>;
}
