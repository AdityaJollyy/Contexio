import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";
import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkText: string;
  footerLinkTo: string;
}

export function AuthLayout({
  children,
  title,
  subtitle,
  footerText,
  footerLinkText,
  footerLinkTo,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-125 h-125 rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-125 h-125 rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm relative"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center mb-8">
          <Logo size="lg" />
        </Link>

        {/* Card */}
        <div className="bg-bg-card border border-border rounded-xl p-8">
          <div className="mb-6">
            <h1 className="text-foreground text-xl font-semibold mb-1">
              {title}
            </h1>
            <p className="text-muted text-sm">{subtitle}</p>
          </div>

          {children}
        </div>

        <p className="text-center text-muted text-sm mt-4">
          {footerText}{" "}
          <Link
            to={footerLinkTo}
            className="text-accent hover:text-accent-hover transition-colors"
          >
            {footerLinkText}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
