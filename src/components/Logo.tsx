import Image from "next/image";

/** Full Devx wordmark (blue → purple gradient). */
export function DevxLogo({
  height = 28,
  className,
  priority,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  // Wordmark asset is 1479 × 560 (devx lettering with a little padding).
  const width = Math.round((height * 1479) / 560);
  return (
    <Image
      src="/devx-logo.png"
      alt="Devx"
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={className}
      style={{ height, width: "auto" }}
    />
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
