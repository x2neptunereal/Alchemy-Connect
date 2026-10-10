// Renders an SVG as a solid silhouette in the current text color (white in dark, near-black in light).
export default function Logo({
  src,
  label = "Alchemy",
  className = "",
}: {
  src: string;
  label?: string;
  className?: string;
}) {
  const mask = `url(${src}) center / contain no-repeat`;
  return (
    <span
      role="img"
      aria-label={label}
      className={`block shrink-0 bg-fg ${className}`}
      style={{ mask, WebkitMask: mask }}
    />
  );
}
