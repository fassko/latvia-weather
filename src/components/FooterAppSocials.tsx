const iconLinkClassName =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 sm:h-12 sm:w-12 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

const iconClassName = "h-6 w-6 sm:h-7 sm:w-7";

interface FooterAppSocialsProps {
  navLabel: string;
  instagramLabel: string;
  tiktokLabel: string;
}

export function FooterAppSocials({
  navLabel,
  instagramLabel,
  tiktokLabel,
}: FooterAppSocialsProps) {
  return (
    <nav aria-label={navLabel} className="flex items-center gap-1.5 sm:gap-2">
      <a
        href="https://www.instagram.com/latviaweather"
        className={iconLinkClassName}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={instagramLabel}
      >
        <InstagramIcon />
      </a>
      <a
        href="https://www.tiktok.com/@latviaweather.com"
        className={iconLinkClassName}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={tiktokLabel}
      >
        <TikTokIcon />
      </a>
    </nav>
  );
}

function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={iconClassName}
      aria-hidden="true"
    >
      <path d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2Zm0 7.9A3.1 3.1 0 1 1 12 8.9a3.1 3.1 0 0 1 0 6.2Zm6.3-8.15a1.12 1.12 0 1 1-2.24 0 1.12 1.12 0 0 1 2.24 0ZM12 2.5c-2.5 0-2.81.01-3.8.06-2.6.12-4.02 1.52-4.14 4.14-.05.99-.06 1.3-.06 3.8s.01 2.81.06 3.8c.12 2.61 1.53 4.02 4.14 4.14.99.05 1.3.06 3.8.06s2.81-.01 3.8-.06c2.61-.12 4.02-1.53 4.14-4.14.05-.99.06-1.3.06-3.8s-.01-2.81-.06-3.8c-.12-2.62-1.53-4.02-4.14-4.14-.99-.05-1.3-.06-3.8-.06Zm0 1.53c2.45 0 2.74.01 3.71.05 1.96.09 2.87.99 2.96 2.96.04.97.05 1.26.05 3.71s-.01 2.74-.05 3.71c-.09 1.96-.99 2.87-2.96 2.96-.97.04-1.26.05-3.71.05s-2.74-.01-3.71-.05c-1.97-.09-2.87-1-2.96-2.96-.04-.97-.05-1.26-.05-3.71s.01-2.74.05-3.71c.09-1.97 1-2.87 2.96-2.96.97-.04 1.26-.05 3.71-.05Z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={iconClassName}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.3 0 .59.04.86.12v-3.57a6.33 6.33 0 0 0-.86-.06A6.34 6.34 0 0 0 3.16 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.21a8.16 8.16 0 0 0 4.76 1.52V7.28a4.85 4.85 0 0 1-1.01-.59Z" />
    </svg>
  );
}
