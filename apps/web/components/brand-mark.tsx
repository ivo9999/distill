import { cn } from "@/lib/utils";

/**
 * Brand droplet — the canonical Distill symbol. Inlined SVG so it inherits
 * `text-brand` colour, scales cleanly at any size, and doesn't require a
 * network hop for the asset. Path matches public/icon.svg and the brand
 * sheet exactly so all surfaces stay on-spec.
 *
 * Sizing: pass any Tailwind h-* / w-* class via className. The viewBox is
 * 90×130 (the droplet is taller than wide), so prefer h-* and let width
 * follow with w-auto.
 */
export function BrandMark({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <svg
      viewBox="0 0 90 130"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn("text-brand", className)}
    >
      <path
        d="M 45 0 C 65 25, 90 55, 90 80 A 45 45 0 1 1 0 80 C 0 55, 25 25, 45 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}
