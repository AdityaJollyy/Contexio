import { type InputHTMLAttributes, forwardRef, type ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ rightIcon, className = "", ...props }, ref) => {
    const base =
      "flex h-9 w-full rounded-[4px] border border-border bg-bg-input px-3 py-1 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:border-accent disabled:opacity-50 disabled:cursor-not-allowed";

    return (
      <div className="relative flex items-center w-full">
        <input
          ref={ref}
          className={`${base} ${rightIcon ? "pr-10" : ""} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 flex items-center">{rightIcon}</div>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
