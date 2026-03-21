import { type InputHTMLAttributes, forwardRef, type ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, className = "", ...props }, ref) => {
    const base =
      "flex h-9 w-full rounded-[4px] border border-border bg-bg-input px-3 py-1 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:outline-none focus-visible:border-accent disabled:opacity-50 disabled:cursor-not-allowed";

    return (
      <div className="relative flex items-center w-full">
        {icon && (
          <div className="absolute left-3 text-muted pointer-events-none flex items-center">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`${base} ${icon ? "pl-9" : ""} ${className}`}
          {...props}
        />
      </div>
    );
  },
);

Input.displayName = "Input";
