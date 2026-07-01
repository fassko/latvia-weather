import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppToolbarProps {
  className?: string;
}

export function AppToolbar({ className = "" }: AppToolbarProps) {
  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`.trim()}>
      <Suspense fallback={null}>
        <LanguageSwitcher />
      </Suspense>
      <ThemeToggle />
    </div>
  );
}
