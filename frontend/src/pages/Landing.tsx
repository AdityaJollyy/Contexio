import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Brain, Search, Sparkles, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

const features = [
  {
    icon: <Brain size={18} />,
    title: "Save Anything",
    description:
      "One organized space for all your research, watchlists, and notes.\nSimple, clean, and always accessible.",
  },
  {
    icon: <Sparkles size={18} />,
    title: "Smart AI Search",
    description:
      "Forgot something you saved?\nNo worries. Just type what you remember and we will bring it back.",
  },
  {
    icon: <Search size={18} />,
    title: "Find Faster",
    description:
      "No folders. No mess.\nSearch your saved content as easily as you search your thoughts.",
  },
];

const contentTypes = [
  "YouTube Videos",
  "Social Posts",
  "GitHub",
  "Notes",
  "Web Links",
];

export default function Landing() {
  const navigate = useNavigate();

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
        <Logo size="lg" />

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
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
            Contexio
            <br />
            <span className="text-muted">Your AI Knowledge Base.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-muted text-base sm:text-lg leading-relaxed max-w-xl">
            No more scrolling through bookmarks or trying to remember where you
            saw something. Everything you save is easy to find when you need it.
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
          </div>
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
              <p className="text-muted text-sm leading-relaxed whitespace-pre-line">
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
            className="text-accent hover:text-accent-hover text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            Start building your brain
            <ArrowRight size={13} />
          </button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 py-4 flex items-center justify-between">
        <Logo size="sm" />
        <span className="text-muted text-xs font-mono">
          AI-powered knowledge base
        </span>
      </footer>
    </div>
  );
}
