"use client";

import { DefaultChatTransport, isTextUIPart, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

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
  };
}

const exampleIcons = [
  "M4 14l5-5 4 4 7-7m0 0v5m0-5h-5",
  "M8 16a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6zM11 13h2l2-6h3m-9 6l2-6h2",
  "M8 5h8l2 3-2 2v9H8v-9L6 8l2-3z",
  "M4 13a8 8 0 0116 0H4zm8 0v5m-1 2h2",
];

const weekendDayPattern =
  /^(sat\.?|sun\.?|saturday|sunday|sestdien[aāu]?|svētdien[aāu]?)$/i;

function renderHighlightedText(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(/(sat\.?|sun\.?|saturday|sunday|sestdien[aāu]?|svētdien[aāu]?)/gi)
    .filter(Boolean)
    .map((part, index) =>
      weekendDayPattern.test(part) ? (
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
      blocks.push(
        <ul key={`list-${index}`} className="space-y-1.5">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="flex gap-2">
              <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#477dd8]" />
              <span>{renderInlineMarkdown(item, `list-${index}-${itemIndex}`)}</span>
            </li>
          ))}
        </ul>,
      );
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { locale, locationId },
      }),
    [locale, locationId],
  );
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const isStreaming = status === "submitted" || status === "streaming";

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
        <button
          type="button"
          aria-label={labels.close}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] dark:bg-slate-950/60"
        />
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={labels.open}
        className="fixed right-4 bottom-5 z-30 flex h-14 items-center gap-2 rounded-full bg-[#477dd8] px-5 text-base font-semibold text-white shadow-[0_18px_40px_rgba(71,125,216,0.35)] transition hover:bg-[#3d72cb] focus:ring-4 focus:ring-[#477dd8]/25 focus:outline-none sm:right-8 sm:bottom-7 sm:h-16 sm:px-7 sm:text-lg dark:shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
      >
        <AppWeatherIcon className="h-7 w-7 bg-none shadow-none" />
        {labels.send}
      </button>

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        className={`fixed top-0 right-0 z-50 flex h-dvh w-full transform flex-col border-l border-slate-200 bg-slate-50 shadow-2xl transition-transform duration-300 ease-out sm:max-w-md dark:border-slate-800 dark:bg-slate-950 ${
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
                  <RichWeatherText text={text} />
                ) : (
                  <p className="whitespace-pre-wrap">{text}</p>
                )}
              </div>
            );
          })}

          {isStreaming ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {labels.thinking}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
              {labels.error}
            </p>
          ) : null}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950"
        >
          <input
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
    </>
  );
}
