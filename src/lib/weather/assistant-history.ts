import type { UIMessage } from "ai";

export const ASSISTANT_HISTORY_STORAGE_KEY = "latvia-weather-assistant-history";
export const ASSISTANT_HISTORY_CHAT_ID = "forecast-mate";
const MAX_STORED_MESSAGES = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUIMessage(value: unknown): value is UIMessage {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (value.role !== "user" && value.role !== "assistant" && value.role !== "system") {
    return false;
  }
  return Array.isArray(value.parts);
}

function compactForecastToolOutput(output: unknown): unknown {
  if (!isRecord(output)) return output;

  const location = isRecord(output.location)
    ? {
        id: typeof output.location.id === "string" ? output.location.id : undefined,
        name:
          typeof output.location.name === "string" ? output.location.name : undefined,
      }
    : undefined;

  return {
    sourceCaption:
      typeof output.sourceCaption === "string" ? output.sourceCaption : undefined,
    location,
    trendStrip:
      typeof output.trendStrip === "string" ? output.trendStrip : undefined,
  };
}

function compactMessagePart(part: unknown): unknown {
  if (!isRecord(part) || typeof part.type !== "string") return part;

  if (
    part.type === "tool-get_current_page_forecast" ||
    part.type === "tool-get_weather_forecast" ||
    part.type === "tool-get_named_location_forecast"
  ) {
    return {
      ...part,
      output: "output" in part ? compactForecastToolOutput(part.output) : part.output,
    };
  }

  if (part.type.startsWith("tool-") && "output" in part) {
    // Drop bulky list/search payloads; text answers are enough to restore the UI.
    return Object.fromEntries(
      Object.entries(part).filter(([key]) => key !== "output"),
    );
  }

  return part;
}

function compactMessagesForStorage(messages: UIMessage[]): UIMessage[] {
  return messages.slice(-MAX_STORED_MESSAGES).map((message) => ({
    ...message,
    parts: message.parts.map((part) => compactMessagePart(part) as typeof part),
  }));
}

export function parseAssistantHistory(raw: string | null): UIMessage[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isUIMessage).slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

export function serializeAssistantHistory(messages: UIMessage[]): string {
  return JSON.stringify(compactMessagesForStorage(messages));
}

export function loadAssistantHistory(): UIMessage[] {
  if (typeof window === "undefined") return [];

  try {
    return parseAssistantHistory(
      window.localStorage.getItem(ASSISTANT_HISTORY_STORAGE_KEY),
    );
  } catch {
    return [];
  }
}

export function saveAssistantHistory(messages: UIMessage[]): void {
  if (typeof window === "undefined") return;

  try {
    if (messages.length === 0) {
      window.localStorage.removeItem(ASSISTANT_HISTORY_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      ASSISTANT_HISTORY_STORAGE_KEY,
      serializeAssistantHistory(messages),
    );
  } catch {
    // Ignore quota / private-mode failures; chat still works in-memory.
  }
}
