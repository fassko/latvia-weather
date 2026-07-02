export interface WeatherHeaderTheme {
  card: string;
  shadow: string;
  text: string;
  muted: string;
  statLabel: string;
}

type ConditionGroup =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "rain"
  | "thunder"
  | "snow"
  | "drizzle";

function getConditionGroup(iconCode: string): ConditionGroup {
  const code = iconCode.slice(1);
  const isNight = iconCode.startsWith("2");

  if (code.startsWith("40")) return "snow";
  if (code === "304" || code === "305" || code === "306") return "thunder";
  if (code.startsWith("30")) return "rain";
  if (code.startsWith("50")) return "drizzle";
  if (code === "201" || code === "202" || code === "203" || code === "204") return "fog";
  if (code === "103" || code === "104") return "cloudy";
  if (code === "102") return "partly-cloudy";
  if (code === "101") return "clear";

  return isNight ? "cloudy" : "partly-cloudy";
}

function isNightIcon(iconCode: string): boolean {
  return iconCode.startsWith("2");
}

const themes: Record<ConditionGroup, { day: WeatherHeaderTheme; night: WeatherHeaderTheme }> = {
  clear: {
    day: {
      card: "bg-gradient-to-br from-amber-300 via-sky-400 to-sky-600 dark:from-amber-700 dark:via-sky-800 dark:to-sky-950",
      shadow: "shadow-lg shadow-sky-400/35 dark:shadow-sky-950/50",
      text: "text-white",
      muted: "text-white/90",
      statLabel: "text-white/75",
    },
    night: {
      card: "bg-gradient-to-br from-indigo-700 via-slate-800 to-slate-950 dark:from-indigo-900 dark:via-slate-900 dark:to-black",
      shadow: "shadow-lg shadow-indigo-900/40 dark:shadow-black/50",
      text: "text-white",
      muted: "text-indigo-100/90",
      statLabel: "text-indigo-200/80",
    },
  },
  "partly-cloudy": {
    day: {
      card: "bg-gradient-to-br from-sky-300 via-sky-400 to-blue-500 dark:from-sky-700 dark:via-sky-800 dark:to-blue-950",
      shadow: "shadow-lg shadow-sky-400/30 dark:shadow-sky-950/45",
      text: "text-white",
      muted: "text-sky-50/90",
      statLabel: "text-sky-100/80",
    },
    night: {
      card: "bg-gradient-to-br from-slate-600 via-slate-700 to-indigo-900 dark:from-slate-800 dark:via-slate-900 dark:to-indigo-950",
      shadow: "shadow-lg shadow-slate-700/35 dark:shadow-black/45",
      text: "text-white",
      muted: "text-slate-200/90",
      statLabel: "text-slate-300/80",
    },
  },
  cloudy: {
    day: {
      card: "bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 dark:from-slate-700 dark:via-slate-800 dark:to-slate-950",
      shadow: "shadow-lg shadow-slate-400/30 dark:shadow-slate-950/45",
      text: "text-white",
      muted: "text-slate-100/90",
      statLabel: "text-slate-200/80",
    },
    night: {
      card: "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900 dark:from-slate-800 dark:via-slate-900 dark:to-black",
      shadow: "shadow-lg shadow-slate-700/35 dark:shadow-black/50",
      text: "text-white",
      muted: "text-slate-200/90",
      statLabel: "text-slate-300/80",
    },
  },
  fog: {
    day: {
      card: "bg-gradient-to-br from-slate-300 via-violet-300 to-slate-400 dark:from-slate-600 dark:via-violet-900 dark:to-slate-900",
      shadow: "shadow-lg shadow-slate-300/35 dark:shadow-slate-900/45",
      text: "text-slate-800 dark:text-white",
      muted: "text-slate-700/90 dark:text-slate-200/90",
      statLabel: "text-slate-600/90 dark:text-slate-300/80",
    },
    night: {
      card: "bg-gradient-to-br from-slate-600 via-violet-800 to-slate-900 dark:from-slate-800 dark:via-violet-950 dark:to-black",
      shadow: "shadow-lg shadow-violet-900/30 dark:shadow-black/50",
      text: "text-white",
      muted: "text-violet-100/90",
      statLabel: "text-violet-200/80",
    },
  },
  rain: {
    day: {
      card: "bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700 dark:from-blue-800 dark:via-blue-900 dark:to-slate-950",
      shadow: "shadow-lg shadow-blue-500/35 dark:shadow-blue-950/50",
      text: "text-white",
      muted: "text-blue-50/90",
      statLabel: "text-blue-100/80",
    },
    night: {
      card: "bg-gradient-to-br from-blue-800 via-slate-800 to-slate-950 dark:from-blue-950 dark:via-slate-900 dark:to-black",
      shadow: "shadow-lg shadow-blue-900/40 dark:shadow-black/50",
      text: "text-white",
      muted: "text-blue-100/90",
      statLabel: "text-blue-200/80",
    },
  },
  thunder: {
    day: {
      card: "bg-gradient-to-br from-violet-600 via-slate-700 to-slate-800 dark:from-violet-900 dark:via-slate-900 dark:to-black",
      shadow: "shadow-lg shadow-violet-600/35 dark:shadow-black/55",
      text: "text-white",
      muted: "text-violet-100/90",
      statLabel: "text-violet-200/80",
    },
    night: {
      card: "bg-gradient-to-br from-violet-900 via-slate-900 to-black dark:from-violet-950 dark:via-black dark:to-black",
      shadow: "shadow-lg shadow-violet-950/50 dark:shadow-black/60",
      text: "text-white",
      muted: "text-violet-100/90",
      statLabel: "text-violet-200/75",
    },
  },
  snow: {
    day: {
      card: "bg-gradient-to-br from-slate-100 via-sky-200 to-blue-300 dark:from-slate-600 dark:via-slate-700 dark:to-blue-950",
      shadow: "shadow-lg shadow-sky-200/50 dark:shadow-slate-900/45",
      text: "text-slate-800 dark:text-white",
      muted: "text-slate-700/90 dark:text-sky-100/90",
      statLabel: "text-slate-600/90 dark:text-sky-200/80",
    },
    night: {
      card: "bg-gradient-to-br from-slate-600 via-blue-800 to-slate-900 dark:from-slate-800 dark:via-blue-950 dark:to-black",
      shadow: "shadow-lg shadow-blue-900/35 dark:shadow-black/50",
      text: "text-white",
      muted: "text-sky-100/90",
      statLabel: "text-sky-200/80",
    },
  },
  drizzle: {
    day: {
      card: "bg-gradient-to-br from-cyan-400 via-blue-400 to-blue-600 dark:from-cyan-800 dark:via-blue-900 dark:to-slate-950",
      shadow: "shadow-lg shadow-cyan-400/30 dark:shadow-blue-950/45",
      text: "text-white",
      muted: "text-cyan-50/90",
      statLabel: "text-cyan-100/80",
    },
    night: {
      card: "bg-gradient-to-br from-cyan-800 via-blue-900 to-slate-950 dark:from-cyan-950 dark:via-blue-950 dark:to-black",
      shadow: "shadow-lg shadow-cyan-900/40 dark:shadow-black/50",
      text: "text-white",
      muted: "text-cyan-100/90",
      statLabel: "text-cyan-200/80",
    },
  },
};

export function getWeatherHeaderTheme(iconCode: string): WeatherHeaderTheme {
  const group = getConditionGroup(iconCode);
  const period = isNightIcon(iconCode) ? "night" : "day";
  return themes[group][period];
}
