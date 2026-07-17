import { THEME_STORAGE_KEY } from "@/lib/theme";

const themeScript = `
(function () {
  try {
    var locale = location.pathname.split("/")[1];
    if (locale === "en" || locale === "lv") {
      document.documentElement.lang = locale;
    }
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var useDark =
      stored === "dark" ||
      ((stored === "system" || !stored) && prefersDark);
    if (useDark) {
      document.documentElement.classList.add("dark");
    }
  } catch (_) {}
})();
`.trim();

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
