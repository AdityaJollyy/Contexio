import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import Landing from "@/pages/Landing";
import Signin from "@/pages/Signin";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Search from "@/pages/Search";
import { isLoggedIn } from "@/lib/auth";

function RootRedirect() {
  return isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Landing />;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/signin"
          element={
            <AuthRedirect>
              <Signin />
            </AuthRedirect>
          }
        />
        <Route
          path="/signup"
          element={
            <AuthRedirect>
              <Signup />
            </AuthRedirect>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Search />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
