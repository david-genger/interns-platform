import Image from "next/image";

type LogoVariant = "mark" | "full";

// Intrinsic dimensions of each asset, used to preserve aspect ratio.
const ASSET: Record<LogoVariant, { src: string; width: number; height: number }> = {
  mark: { src: "/devx-logo.png", width: 1479, height: 560 }, // "devx" lettering only
  full: { src: "/logo-regular.png", width: 1450, height: 795 }, // official "devx staffing" lockup
};

/**
 * Devx logo. `variant="full"` renders the official "devx staffing" lockup
 * as-is. `variant="mark"` (default) renders just the "devx" lettering, with
 * an optional text `suffix` appended (e.g. "Interns" for the app header) —
 * use this only for product/app names, not to reconstruct the brand name.
 */
export function DevxLogo({
  height = 28,
  variant = "mark",
  className,
  priority,
  suffix,
  suffixClassName = "font-display font-semibold text-slate-500",
}: {
  height?: number;
  variant?: LogoVariant;
  className?: string;
  priority?: boolean;
  suffix?: string | null;
  suffixClassName?: string;
}) {
  const asset = ASSET[variant];
  const width = Math.round((height * asset.width) / asset.height);
  return (
    <span className={`inline-flex items-center gap-[0.4em] ${className ?? ""}`}>
      <Image
        src={asset.src}
        alt="Devx Staffing"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        style={{ height, width: "auto" }}
      />
      {suffix && (
        <span
          className={suffixClassName}
          style={{ fontSize: Math.round(height * 0.46), lineHeight: 1 }}
        >
          {suffix}
        </span>
      )}
    </span>
  );
}

/** Devx "x" logomark only — good for tight spaces / avatars. */
export function DevxMark({
  size = 32,
  className,
  priority,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/devx-mark.png"
      alt="Devx"
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={className}
      style={{ height: size, width: "auto" }}
    />
  );
}
