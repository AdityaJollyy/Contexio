interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = {
  sm: { box: "w-5 h-5", text: "text-[10px]", label: "text-xs" },
  md: { box: "w-6 h-6", text: "text-xs", label: "text-[14px]" },
  lg: { box: "w-7 h-7", text: "text-xs", label: "text-base" },
};

export function Logo({ size = "md", showText = true }: LogoProps) {
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${s.box} rounded bg-accent flex items-center justify-center text-background font-bold shrink-0 ${s.text}`}
      >
        SB
      </div>
      {showText && (
        <span className={`text-foreground font-medium tracking-tight ${s.label}`}>
          Second Brain
        </span>
      )}
    </div>
  );
}
