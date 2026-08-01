"use client";

import {
  DefaultChatTransport,
  getToolName,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { useChat } from "@ai-sdk/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ASSISTANT_HISTORY_CHAT_ID,
  loadAssistantHistory,
  saveAssistantHistory,
} from "@/lib/weather/assistant-history";
import {
  isWeekendDayToken,
  splitWeekendDayParts,
} from "@/lib/weather/weekend-highlight";

interface WeatherAssistantProps {
  locale: string;
  locationId: string;
  labels: {
    title: string;
    subtitle: string;
    placeholder: string;
    inputPlaceholder: string;
    send: string;
    stop: string;
    user: string;
    assistant: string;
    thinking: string;
    error: string;
    examples: string[];
    close: string;
    open: string;
    sourceCaption: string;
  };
}

const exampleIcons = [
  "M4 14l5-5 4 4 7-7m0 0v5m0-5h-5",
  "M8 16a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6zM11 13h2l2-6h3m-9 6l2-6h2",
  "M8 5h8l2 3-2 2v9H8v-9L6 8l2-3z",
  "M4 13a8 8 0 0116 0H4zm8 0v5m-1 2h2",
];

function renderHighlightedText(text: string, keyPrefix: string): ReactNode[] {
  return splitWeekendDayParts(text).map((part, index) =>
    isWeekendDayToken(part) ? (
      <span
        key={`${keyPrefix}-weekend-${index}`}
        className="font-bold text-red-600 dark:text-red-400"
      >
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong
            key={`${keyPrefix}-strong-${index}`}
            className="font-bold text-slate-950 dark:text-white"
          >
            {renderHighlightedText(part.slice(2, -2), `${keyPrefix}-${index}`)}
          </strong>
        );
      }

      return renderHighlightedText(part, `${keyPrefix}-${index}`);
    });
}

function isSourceCaption(text: string): boolean {
  return /^(source|avots):\s+/i.test(text);
}

function isForecastToolOutput(output: unknown): output is {
  sourceCaption?: string;
  location?: { name?: string };
} {
  return typeof output === "object" && output !== null;
}

function getForecastSourceCaption(message: UIMessage): string | null {
  for (const part of message.parts) {
    if (!isToolUIPart(part)) continue;

    const toolName = getToolName(part);
    if (
      toolName !== "get_current_page_forecast" &&
      toolName !== "get_weather_forecast" &&
      toolName !== "get_named_location_forecast"
    ) {
      continue;
    }

    if (!("output" in part) || !isForecastToolOutput(part.output)) continue;
    if (typeof part.output.sourceCaption === "string") {
      return part.output.sourceCaption;
    }
  }

  return null;
}

function RichWeatherText({ text }: { text: string }) {
  const lines = text.trim().split("\n");
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) continue;

    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      blocks.push(
        <h3
          key={`heading-${index}`}
          className="mt-1 text-base font-bold text-slate-950 first:mt-0 dark:text-white"
        >
          {renderInlineMarkdown(heading[1], `heading-${index}`)}
        </h3>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      index -= 1;
      const weatherItems = items.filter((item) => !isSourceCaption(item));

      blocks.push(
        <div key={`list-${index}`} className="space-y-2">
          {weatherItems.length > 0 ? (
            <div className="space-y-2">
              {weatherItems.map((item, itemIndex) => (
                <p key={`${item}-${itemIndex}`}>
                  {renderInlineMarkdown(item, `list-${index}-${itemIndex}`)}
                </p>
              ))}
            </div>
          ) : null}
        </div>,
      );
      continue;
    }

    if (isSourceCaption(trimmed)) {
      continue;
    }

    const paragraphLines = [trimmed];
    while (
      index + 1 < lines.length &&
      lines[index + 1].trim() &&
      !/^#{1,3}\s+/.test(lines[index + 1].trim()) &&
      !/^[-*]\s+/.test(lines[index + 1].trim())
    ) {
      index += 1;
      paragraphLines.push(lines[index].trim());
    }

    blocks.push(
      <p key={`paragraph-${index}`}>
        {renderInlineMarkdown(paragraphLines.join(" "), `paragraph-${index}`)}
      </p>,
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}

function getMessageText(message: UIMessage) {
  return (
    message.parts
      ?.filter(isTextUIPart)
      .map((part) => part.text)
      .join("") ?? ""
  );
}

function getAssistantErrorMessage(
  error: Error | undefined,
  fallback: string,
): string {
  if (!error?.message) return fallback;

  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    // The AI SDK also uses plain text error messages for stream errors.
  }

  return error.message;
}

function AppWeatherIcon({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-800 shadow-sm ${className}`}
    >
      <span className="translate-y-[1px] text-[1.65em] leading-none">🌤️</span>
    </span>
  );
}

export function WeatherAssistant({
  locale,
  locationId,
  labels,
}: WeatherAssistantProps) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [initialMessages] = useState<UIMessage[]>(() => loadAssistantHistory());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { locale, locationId },
      }),
    [locale, locationId],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id: ASSISTANT_HISTORY_CHAT_ID,
    messages: initialMessages,
    transport,
  });
  const isStreaming = status === "submitted" || status === "streaming";
  const errorMessage = getAssistantErrorMessage(error, labels.error);

  useEffect(() => {
    if (status !== "ready" && status !== "error") return;
    saveAssistantHistory(messages);
  }, [messages, status]);

  useEffect(() => {
    if (!isOpen) return;

    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    scrollArea.scrollTo({
      top: scrollArea.scrollHeight,
      behavior: "smooth",
    });
  }, [error, isOpen, isStreaming, messages]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Move focus into the panel on open and hand it back to the launcher on
  // close, so keyboard users are never left on a hidden element.
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      const panelHasFocus = document.activeElement.closest(
        "[data-assistant-panel]",
      );
      if (panelHasFocus) openButtonRef.current?.focus();
    }
  }, [isOpen]);

  function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setIsOpen(true);
    sendMessage({ text: trimmed });
    setInput("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage(input);
  }

  return (
    <>
      {isOpen ? (
        // The dialog already exposes a labelled close button, so the backdrop
        // is a pointer-only convenience.
        <div
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] dark:bg-slate-950/60"
        />
      ) : null}

      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setIsOpen(true)}
        // Keeps the visible text at the start of the accessible name so voice
        // control users can say what they see.
        aria-label={`${labels.send} · ${labels.title}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="fixed right-4 bottom-5 z-30 flex h-14 items-center gap-2 rounded-full bg-[#477dd8] px-5 text-base font-semibold text-white shadow-[0_18px_40px_rgba(71,125,216,0.35)] transition hover:bg-[#3d72cb] focus-visible:ring-4 focus-visible:ring-[#477dd8]/25 focus-visible:outline-none sm:right-8 sm:bottom-7 sm:h-16 sm:px-7 sm:text-lg dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      >
        <AppWeatherIcon className="h-7 w-7 bg-none shadow-none" />
        {labels.send}
      </button>

      {/* The closed panel is parked a full viewport width off-canvas so it can
          slide in. iOS Safari counts that off-screen fixed box as scrollable
          page width, so it has to be clipped by an ancestor; clipping only the
          x axis keeps the panel free to use the dynamic viewport height. */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-x-clip">
        <aside
          data-assistant-panel=""
          role="dialog"
          aria-modal="true"
          aria-label={labels.title}
          // A closed panel is still in the layout for the slide animation, so it
          // must be removed from the tab order and the accessibility tree.
          inert={!isOpen}
          className={`pointer-events-auto absolute top-0 right-0 flex h-dvh w-full transform flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out sm:max-w-md dark:border-slate-800 dark:bg-slate-950 ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="flex items-center gap-4 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
            <AppWeatherIcon className="h-14 w-14 text-2xl" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold text-slate-950 dark:text-slate-50">
                {labels.title}
              </h2>
              <p className="truncate text-base text-slate-600 dark:text-slate-400">
                {labels.subtitle}
              </p>
            </div>
            <button
              type="button"
              aria-label={labels.close}
              onClick={() => setIsOpen(false)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900 shadow-sm transition hover:bg-slate-100 focus:ring-4 focus:ring-[#477dd8]/20 focus:outline-none dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div
            ref={scrollAreaRef}
            aria-live="polite"
            aria-atomic="false"
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-6"
          >
            {messages.length === 0 ? (
              <>
                <p className="text-xl leading-8 text-slate-600 dark:text-slate-300">
                  {labels.placeholder}
                </p>
                <div className="flex flex-col gap-3">
                  {labels.examples.map((example, index) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => submitMessage(example)}
                      className="flex min-h-16 items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-lg font-semibold text-slate-950 shadow-sm transition hover:border-[#477dd8]/45 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800"
                      disabled={isStreaming}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-6 w-6 shrink-0 text-[#477dd8]"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      >
                        <path d={exampleIcons[index % exampleIcons.length]} />
                      </svg>
                      <span>{example}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {messages.map((message) => {
              const text = getMessageText(message);
              if (!text) return null;
              const sourceCaption =
                message.role === "assistant"
                  ? (getForecastSourceCaption(message) ?? labels.sourceCaption)
                  : null;

              return (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[86%] rounded-2xl bg-[#477dd8] px-4 py-3 text-sm leading-6 text-white shadow-sm"
                      : "mr-auto max-w-[86%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  }
                >
                  <p className="mb-1 text-xs font-semibold opacity-70">
                    {message.role === "user" ? labels.user : labels.assistant}
                  </p>
                  {message.role === "assistant" ? (
                    <>
                      <RichWeatherText text={text} />
                      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {sourceCaption}
                      </p>
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap">{text}</p>
                  )}
                </div>
              );
            })}

            {isStreaming ? (
              <p
                role="status"
                className="text-sm text-slate-500 dark:text-slate-400"
              >
                {labels.thinking}
              </p>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
              >
                {errorMessage}
              </p>
            ) : null}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder={labels.inputPlaceholder}
              aria-label={labels.inputPlaceholder}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-[#477dd8] focus:ring-4 focus:ring-[#477dd8]/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                className="flex h-14 min-w-16 items-center justify-center rounded-2xl bg-slate-600 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 focus:ring-4 focus:ring-slate-400/25 focus:outline-none"
              >
                {labels.stop}
              </button>
            ) : (
              <button
                type="submit"
                aria-label={labels.send}
                className="flex h-14 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-600 text-white transition hover:bg-slate-700 focus:ring-4 focus:ring-slate-400/25 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!input.trim()}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="currentColor"
                >
                  <path d="M3 11.7l17.4-8.2-5.7 17.8-3.4-7.2L3 11.7zm8.9.6l1.8 3.8 2.8-8.8-8.5 4 3.9 1z" />
                </svg>
              </button>
            )}
          </form>
        </aside>
      </div>
    </>
  );
}
