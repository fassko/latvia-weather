"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { RefreshButton } from "@/components/RefreshButton";
import { ShareButton } from "@/components/ShareButton";
import { ThemeSegmentedToggle } from "@/components/ThemeSegmentedToggle";
import { WindUnitsToggle } from "@/components/WindUnitsToggle";

/** Desktop: inline controls. Mobile: overflow menu so the sticky header stays one row. */
export function NavControls() {
  return (
    <>
      <div className="ml-auto hidden items-center justify-end gap-2 sm:flex">
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
      <div className="ml-auto sm:hidden">
        <NavOverflowMenu />
      </div>
    </>
  );
}

function NavOverflowMenu() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("closeControls") : t("moreControls")}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <CloseIcon /> : <MoreIcon />}
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={t("moreControls")}
          className="absolute right-0 z-50 mt-2 flex w-[min(100vw-2rem,18rem)] flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton />
            <WindUnitsToggle />
            <Suspense fallback={null}>
              <ShareButton />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
          <ThemeSegmentedToggle />
        </div>
      ) : null}
    </div>
  );
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
