import Image from "next/image";

// The official "devx staffing" lockup. Two color treatments, same artwork:
//   light  -> dark "staffing" text, for light backgrounds
//   dark   -> white "staffing" text, for dark backgrounds
const LOCKUP = {
  light: "/logo-regular.png",
  dark: "/logo-white.png",
  width: 1450,
  height: 795,
} as const;

/**
 * Devx "devx staffing" logo. Pass `theme="dark"` on dark backgrounds so the
 * "staffing" text stays legible. Height controls size; width is derived from
 * the artwork's aspect ratio so it never crops or distorts.
 */
export function DevxLogo({
  height = 32,
  theme = "light",
  className,
  priority,
}: {
  height?: number;
  theme?: "light" | "dark";
  className?: string;
  priority?: boolean;
}) {
  const width = Math.round((height * LOCKUP.width) / LOCKUP.height);
  return (
    <Image
      src={theme === "dark" ? LOCKUP.dark : LOCKUP.light}
      alt="Devx Staffing"
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}

/** Devx "x" logomark only — for tight spaces / avatars. */
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
