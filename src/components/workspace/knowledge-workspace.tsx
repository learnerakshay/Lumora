"use client";

import { FileText, Link2, MessageCircle, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Source = { id: string; title: string; sourceType: string; status: string };

export function KnowledgeWorkspace({ sources }: { sources: Source[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selected, setSelected] = useState<Source | null>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const wasAddOpen = useRef(false);
  const closeViewer = () => {
    setViewerOpen(false);
    setSelected(null);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAddOpen(false);
        closeViewer();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (wasAddOpen.current && !addOpen) addTrigger.current?.focus();
    wasAddOpen.current = addOpen;
  }, [addOpen]);
  return (
    <section
      aria-label="Knowledge workspace"
      className="mt-8 grid min-h-[30rem] overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface-muted)] xl:grid-cols-[17rem_minmax(0,1fr)_19rem]"
    >
      <aside
        aria-label="Sources"
        className="flex min-h-0 flex-col border-b xl:border-r xl:border-b-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Sources</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Notebook knowledge
            </p>
          </div>
          <button
            aria-expanded={addOpen}
            aria-haspopup="dialog"
            aria-label="Add source"
            className="grid min-h-10 min-w-10 place-items-center rounded-[var(--radius)] text-[var(--accent-cyan)] hover:bg-[var(--surface-hover)]"
            onClick={() => setAddOpen(true)}
            ref={addTrigger}
            type="button"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {sources.length ? (
            <div className="grid gap-1">
              {sources.map((source) => (
                <button
                  aria-current={selected?.id === source.id ? "true" : undefined}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-[var(--radius)] px-2 text-left text-sm hover:bg-[var(--surface-hover)]",
                    selected?.id === source.id &&
                      "bg-[var(--surface-active)] text-[var(--foreground)]",
                  )}
                  key={source.id}
                  onClick={() => {
                    setSelected(source);
                    setViewerOpen(true);
                  }}
                  type="button"
                >
                  <FileText aria-hidden size={15} />
                  <span className="truncate">{source.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid place-items-center px-3 py-12 text-center">
              <FileText
                aria-hidden
                className="mb-3 text-[var(--muted)]"
                size={22}
              />
              <p className="text-sm font-medium">No sources yet</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                This notebook is ready for source processing when import becomes
                available.
              </p>
            </div>
          )}
        </div>
      </aside>
      <main
        className="flex min-h-0 flex-col"
        aria-label="Notebook conversation"
      >
        <header className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Ask about this notebook</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Grounded responses will appear here.
            </p>
          </div>
          <MessageCircle
            aria-hidden
            className="text-[var(--muted)]"
            size={18}
          />
        </header>
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-[var(--accent)]/35 bg-[var(--surface)] text-[var(--accent-cyan)]">
              <MessageCircle size={18} />
            </div>
            <h3 className="mt-4 font-semibold">A quiet space for inquiry</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Notebook intelligence is not enabled yet. Sources and grounded
              conversation will connect here in a later development phase.
            </p>
          </div>
        </div>
        <div className="border-t p-4">
          <label className="sr-only" htmlFor="workspace-composer">
            Ask a question
          </label>
          <div className="flex items-end gap-2 rounded-[var(--radius)] border bg-[var(--surface)] p-2">
            <textarea
              aria-describedby="composer-note"
              className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-[var(--text-disabled)]"
              disabled
              id="workspace-composer"
              placeholder="Ask about this notebook"
            />
            <Button disabled type="button">
              Send
            </Button>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]" id="composer-note">
            Notebook intelligence is currently unavailable.
          </p>
        </div>
      </main>
      <aside
        aria-label="Source viewer"
        className={cn(
          "hidden min-h-0 flex-col border-l xl:flex",
          !viewerOpen && "bg-[var(--surface-muted)]",
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Source context</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Viewer</p>
          </div>
          {viewerOpen && (
            <button
              aria-label="Close source viewer"
              className="grid min-h-10 min-w-10 place-items-center rounded-[var(--radius)] hover:bg-[var(--surface-hover)]"
              onClick={closeViewer}
              type="button"
            >
              <X size={17} />
            </button>
          )}
        </div>
        <div className="grid flex-1 place-items-center p-5 text-center">
          <div>
            <Link2
              aria-hidden
              className="mx-auto text-[var(--muted)]"
              size={21}
            />
            <p className="mt-3 text-sm font-medium">
              {selected ? selected.title : "Select a source"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {selected
                ? "Source viewing will be enabled when processing is available."
                : "Source context will appear here."}
            </p>
          </div>
        </div>
      </aside>
      {addOpen && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[var(--overlay)] p-4"
          role="dialog"
        >
          <div
            aria-labelledby="add-source-title"
            className="w-full max-w-md rounded-[var(--radius-lg)] border bg-[var(--surface)] p-5 shadow-[var(--shadow-overlay)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold" id="add-source-title">
                  Add source
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Source ingestion will be enabled in the next development
                  phase.
                </p>
              </div>
              <button
                aria-label="Close add source"
                className="grid min-h-10 min-w-10 place-items-center rounded-[var(--radius)] hover:bg-[var(--surface-hover)]"
                onClick={() => setAddOpen(false)}
                type="button"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-5 grid gap-2">
              {[
                "PDF document",
                "Website URL",
                "Plain text",
                "YouTube video",
                "VTT transcript",
              ].map((type) => (
                <button
                  aria-disabled="true"
                  className="flex min-h-11 items-center justify-between rounded-[var(--radius)] border px-3 text-left text-sm text-[var(--text-disabled)]"
                  disabled
                  key={type}
                  type="button"
                >
                  <span>{type}</span>
                  <span className="text-xs">Unavailable</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
