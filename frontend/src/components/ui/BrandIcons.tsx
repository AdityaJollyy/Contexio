import { siYoutube, siX, siGithub } from "simple-icons";

interface BrandIconProps {
  size?: number;
  className?: string;
}

function BrandIcon({
  path,
  size = 15,
  className = "",
  title,
}: {
  path: string;
  size?: number;
  className?: string;
  title: string;
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-label={title}
      className={className}
    >
      <title>{title}</title>
      <path d={path} />
    </svg>
  );
}

export function YoutubeIcon({ size, className }: BrandIconProps) {
  return (
    <BrandIcon
      path={siYoutube.path}
      size={size}
      className={className}
      title="YouTube"
    />
  );
}

export function XIcon({ size, className }: BrandIconProps) {
  return (
    <BrandIcon path={siX.path} size={size} className={className} title="X" />
  );
}

export function GithubIcon({ size, className }: BrandIconProps) {
  return (
    <BrandIcon
      path={siGithub.path}
      size={size}
      className={className}
      title="GitHub"
    />
  );
}
