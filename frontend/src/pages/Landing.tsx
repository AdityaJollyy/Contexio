import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Brain, Search, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { demoLogin } from "@/lib/api";
import { saveAuth } from "@/lib/auth";
import { useState } from "react";
import axios from "axios";

const features = [
  {
    icon: <Brain size={18} />,
    title: "Save Anything",
    description:
      "YouTube videos, tweets, GitHub repos, articles, or plain notes — everything in one place.",
  },
  {
    icon: <Sparkles size={18} />,
    title: "AI Enrichment",
    description:
      "Every item is automatically summarized and embedded by AI in the background.",
  },
  {
    icon: <Search size={18} />,
    title: "Ask Your Brain",
    description:
      "Search semantically or chat with your entire knowledge base using natural language.",
  },
];

const contentTypes = ["YouTube", "Twitter", "GitHub", "Notes", "Links"];

export default function Landing() {
  const navigate = useNavigate();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");

  const handleDemo = async () => {
    setDemoError("");
    setIsDemoLoading(true);
    try {
      const data = await demoLogin();
      saveAuth(data.token, data.user);
      navigate("/dashboard");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setDemoError(err.response?.data?.message ?? "Failed to start demo");
      } else {
        setDemoError("Something went wrong");
      }
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-150 h-150 rounded-full bg-accent/5 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-150 h-150 rounded-full bg-accent/5 blur-[140px]" />
      </div>

      {/* Navbar */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full flex items-center justify-between px-6 py-4 border-b border-border"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-accent flex items-center justify-center text-background text-xs font-bold shrink-0">
            SB
          </div>
          <span className="text-foreground font-medium tracking-tight">
            Second Brain
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/signin")}>
            Sign In
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/signup")}
          >
            Get Started
          </Button>
        </div>
      </motion.header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="flex flex-col items-center gap-6 max-w-2xl"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-bg-card text-muted text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            AI-powered knowledge base
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
            Your Second Brain,
            <br />
            <span className="text-muted">Simplified.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-muted text-base sm:text-lg leading-relaxed max-w-xl">
            Save links, videos, notes and tweets. Let AI summarize and index
            everything. Then search or chat with your entire knowledge base
            instantly.
          </p>

          {/* Content type pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {contentTypes.map((type) => (
              <span
                key={type}
                className="px-3 py-1 rounded-full border border-border bg-bg-card text-muted text-xs font-mono"
              >
                {type}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate("/signup")}
              className="sm:w-auto w-full"
            >
              Get Started Free
              <ArrowRight size={15} />
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleDemo}
              isLoading={isDemoLoading}
              className="sm:w-auto w-full"
            >
              Try Demo
            </Button>
          </div>

          {demoError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-destructive text-sm"
            >
              {demoError}
            </motion.p>
          )}
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-24 w-full max-w-3xl"
        >
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-bg-card text-left"
            >
              <div className="text-accent">{feature.icon}</div>
              <h3 className="text-foreground text-sm font-medium">
                {feature.title}
              </h3>
              <p className="text-muted text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
          className="mt-16 flex flex-col items-center gap-3"
        >
          <p className="text-muted text-sm">
            No credit card required. Free to use.
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="text-accent hover:text-accent-hover text-sm flex items-center gap-1.5 transition-colors"
          >
            Start building your brain
            <ArrowRight size={13} />
          </button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 py-4 flex items-center justify-between">
        <span className="text-muted text-xs font-mono">Second Brain</span>
        <span className="text-muted text-xs font-mono">Built with AI</span>
      </footer>
    </div>
  );
}
