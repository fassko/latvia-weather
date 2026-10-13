type BrandMarkProps = {
  size?: number | string;
  className?: string;
  /** Squircle clip for UI tiles. Square keeps the full bleed. */
  shape?: "rounded" | "square";
  title?: string;
};

/** Latvia Weather mark from the brand PNG in /public/brand/icon.png. */
export function BrandMark({
  size,
  className,
  shape = "rounded",
  title,
}: BrandMarkProps) {
  const numeric = typeof size === "number" ? size : undefined;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand mark is a static public asset
    <img
      src="/brand/icon.png"
      alt={title ?? ""}
      width={numeric ?? 512}
      height={numeric ?? 512}
      className={[
        "object-cover",
        shape === "rounded" ? "rounded-[23%]" : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    />
  );
}
