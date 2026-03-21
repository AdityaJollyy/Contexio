import { type ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-accent text-background hover:bg-accent-hover",
  secondary:
    "bg-bg-secondary text-foreground hover:bg-bg-card border border-border",
  outline:
    "border border-border bg-transparent hover:bg-bg-card text-foreground",
  ghost: "bg-transparent hover:bg-bg-card text-foreground",
  destructive: "bg-destructive text-foreground hover:opacity-90",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-6 text-sm",
  icon: "h-8 w-8",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[4px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

  return (
    <button
      disabled={isLoading || disabled}
      className={`${base} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading && <Spinner size={14} />}
      {children}
    </button>
  );
}
