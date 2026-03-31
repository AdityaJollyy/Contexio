interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = {
  sm: { container: "w-5 h-5", text: "text-xs" },
  md: { container: "w-6 h-6", text: "text-[14px]" },
  lg: { container: "w-7 h-7", text: "text-base" },
};

export function Logo({ size = "md", showText = true }: LogoProps) {
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <div className={`${s.container} shrink-0`}>
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <circle cx="16" cy="16" r="4" fill="#d4a853" />
          <circle cx="16" cy="6" r="2.5" fill="#d4a853" />
          <circle cx="8" cy="10" r="2" fill="#d4a853" />
          <circle cx="24" cy="10" r="2" fill="#d4a853" />
          <circle cx="16" cy="26" r="2.5" fill="#d4a853" />
          <circle cx="9" cy="22" r="2" fill="#d4a853" />
          <circle cx="23" cy="22" r="2" fill="#d4a853" />
          <circle cx="6" cy="16" r="2" fill="#d4a853" />
          <circle cx="26" cy="16" r="2" fill="#d4a853" />
          <line
            x1="16"
            y1="12"
            x2="16"
            y2="8.5"
            stroke="#d4a853"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1="14"
            y1="13"
            x2="10"
            y2="11"
            stroke="#d4a853"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1="18"
            y1="13"
            x2="22"
            y2="11"
            stroke="#d4a853"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1="16"
            y1="20"
            x2="16"
            y2="23.5"
            stroke="#d4a853"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1="14"
            y1="19"
            x2="10.5"
            y2="21"
            stroke="#d4a853"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1="18"
            y1="19"
            x2="21.5"
            y2="21"
            stroke="#d4a853"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1="12"
            y1="16"
            x2="8"
            y2="16"
            stroke="#d4a853"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1="20"
            y1="16"
            x2="24"
            y2="16"
            stroke="#d4a853"
            strokeWidth="1.5"
            opacity="0.6"
          />
        </svg>
      </div>
      {showText && (
        <span className={`text-foreground font-medium tracking-tight ${s.text}`}>
          Contexio
        </span>
      )}
    </div>
  );
}
