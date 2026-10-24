const APP_STORE_URL =
  "https://apps.apple.com/us/app/latvia-weather/id6820900202";

const iconLinkClassName =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 sm:h-12 sm:w-12 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

const iconClassName = "h-6 w-6 sm:h-7 sm:w-7";

interface FooterAppSocialsProps {
  navLabel: string;
  appStoreLabel: string;
  appStoreBadgeLine1: string;
  appStoreBadgeLine2: string;
  instagramLabel: string;
  tiktokLabel: string;
  xLabel: string;
}

export function FooterAppSocials({
  navLabel,
  appStoreLabel,
  appStoreBadgeLine1,
  appStoreBadgeLine2,
  instagramLabel,
  tiktokLabel,
  xLabel,
}: FooterAppSocialsProps) {
  return (
    <div className="flex flex-col items-start gap-3 sm:items-end">
      <a
        href={APP_STORE_URL}
        className="inline-flex h-10 w-fit items-center gap-2.5 rounded-[9px] bg-black px-3.5 text-white transition hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:h-11 sm:gap-3 sm:px-4 dark:focus-visible:ring-offset-slate-950"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={appStoreLabel}
      >
        <AppleLogo />
        <span className="flex min-w-0 flex-col items-start leading-none">
          <span className="text-[9px] font-normal tracking-wide sm:text-[10px]">
            {appStoreBadgeLine1}
          </span>
          <span className="mt-0.5 text-[17px] font-medium tracking-tight sm:text-[18px]">
            {appStoreBadgeLine2}
          </span>
        </span>
      </a>
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
        <a
          href="https://x.com/LatviaWeatherLV"
          className={iconLinkClassName}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={xLabel}
        >
          <XIcon />
        </a>
      </nav>
    </div>
  );
}

function AppleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
      aria-hidden="true"
    >
      <path d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.17-1.7 1.65-3.35 1.68-3.44-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.16-3.68 1.09-4.63 1.09Zm3.39-3.09c.83-1 1.39-2.39 1.25-3.78-1.2.05-2.65.83-3.51 1.83-.77.88-1.44 2.3-1.27 3.64 1.34.1 2.7-.69 3.53-1.69Z" />
    </svg>
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

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={iconClassName}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.822L1.254 2.25H8.08l4.251 5.622L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}
