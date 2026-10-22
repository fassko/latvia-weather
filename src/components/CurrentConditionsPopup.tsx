"use client";

import { useId, useRef, type ReactNode } from "react";

interface CurrentConditionsPopupProps {
  title: string;
  closeLabel: string;
  triggers: ReactNode[];
  triggerClassName: string;
  children: ReactNode;
}

export function CurrentConditionsPopup({ title, closeLabel, triggers, triggerClassName, children }: CurrentConditionsPopupProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const titleId = useId();

  return (
    <>
      {triggers.map((trigger, index) => (
        <button
          key={index}
          type="button"
          className={triggerClassName}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          onClick={() => dialogRef.current?.showModal()}
        >
          {trigger}
          <svg
            viewBox="0 0 16 16"
            className="ml-0.5 h-3.5 w-3.5 shrink-0 opacity-70"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      ))}
      <dialog
        id={dialogId}
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/65 sm:w-[calc(100%-3rem)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-950">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <form method="dialog">
            <button
              type="submit"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-sky-500 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label={closeLabel}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </form>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </dialog>
    </>
  );
}
