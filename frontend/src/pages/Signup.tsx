import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { signup, signin } from "@/lib/api";
import { saveAuth } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Eye, EyeOff } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      await signup({ email, username, password });
      
      // Signup succeeded, now try to sign in
      try {
        const data = await signin({ email, password });
        saveAuth(data.token, data.user);
        navigate("/dashboard");
      } catch (signinErr) {
        // Signup succeeded but signin failed - redirect to signin page with helpful message
        setError("Account created successfully! Please sign in.");
        setTimeout(() => navigate("/signin"), 2000);
      }
    } catch (signupErr) {
      setError(getApiErrorMessage(signupErr, "Failed to sign up"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Start building your second brain"
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkTo="/signin"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-muted text-sm">Email</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-muted text-sm">Username</label>
          <Input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-muted text-sm">Password</label>
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Min 8 chars, upper, lower, number, symbol"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="text-muted hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-destructive text-sm"
          >
            {error}
          </motion.p>
        )}

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-1"
          isLoading={isLoading}
        >
          Create Account
        </Button>
      </form>
    </AuthLayout>
  );
}
