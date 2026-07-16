import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LocationCombobox } from "@/components/LocationCombobox";
import { RefreshButton } from "@/components/RefreshButton";
import { ShareButton } from "@/components/ShareButton";
import { ThemeSegmentedToggle } from "@/components/ThemeSegmentedToggle";
import { WindUnitsToggle } from "@/components/WindUnitsToggle";

interface TopNavProps {
  locationId: string;
  locationName: string;
}

export async function TopNav({ locationId, locationName }: TopNavProps) {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/70 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <span className="flex shrink-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <BrandIcon />
          <span className="hidden sm:inline">{t("brand")}</span>
        </span>
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
