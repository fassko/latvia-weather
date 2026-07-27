import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocationCombobox } from "@/components/LocationCombobox";
import { RefreshButton } from "@/components/RefreshButton";
import { ShareButton } from "@/components/ShareButton";
import { ThemeSegmentedToggle } from "@/components/ThemeSegmentedToggle";
import { WindUnitsToggle } from "@/components/WindUnitsToggle";
import { Link } from "@/i18n/navigation";

interface TopNavProps {
  locationId: string;
  locationName: string;
  active?: "home" | "map";
}

export async function TopNav({
  locationId,
  locationName,
  active = "home",
}: TopNavProps) {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/70 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"
        >
          <BrandIcon />
          <span className="hidden sm:inline">{t("brand")}</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm" aria-label={t("brand")}>
          <NavLink href="/" label={t("home")} isActive={active === "home"} />
          <NavLink href="/map" label={t("map")} isActive={active === "map"} />
        </nav>
        <div className="min-w-0">
          <LocationCombobox selectedId={locationId} selectedName={locationName} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <RefreshButton />
          <WindUnitsToggle />
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
          <ThemeSegmentedToggle />
          <Suspense fallback={null}>
            <ShareButton />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  label,
  isActive,
}: {
  href: "/" | "/map";
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        isActive
          ? "rounded-md bg-sky-100 px-2.5 py-1.5 font-medium text-sky-800 dark:bg-sky-950/80 dark:text-sky-200"
          : "rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
      }
      aria-current={isActive ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

function BrandIcon() {
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-lg text-base shadow-sm"
      style={{ background: "linear-gradient(135deg, #0ea5e9, #0369a1)" }}
      aria-hidden="true"
    >
      🌤️
    </span>
  );
}
