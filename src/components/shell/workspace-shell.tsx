"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LumoraLogo } from "@/components/brand/lumora-logo";
import { listNotebooks } from "@/lib/api/notebooks";
import { cn } from "@/lib/utils";

function Rail({
  activeId,
  close,
  collapsed,
}: {
  activeId?: string;
  close?: () => void;
  collapsed?: boolean;
}) {
  const notebooks = useQuery({
    queryKey: ["notebooks"],
    queryFn: listNotebooks,
    retry: false,
  });
  return (
    <nav
      aria-label="Notebooks"
      className={cn(
        "flex h-full min-h-0 flex-col border-r bg-[var(--surface-muted)] p-3",
        collapsed && "items-center px-2",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <Link aria-label="Lumora home" href="/">
          <LumoraLogo decorative size="sm" wordmark={!collapsed} />
        </Link>
        {close && (
          <button
            aria-label="Close notebook navigation"
            className="grid min-h-10 min-w-10 place-items-center rounded-[var(--radius)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            onClick={close}
            type="button"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <Link
        className="mt-5 flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--accent)] px-3 text-sm font-medium text-white hover:bg-[#8a70ff]"
        href="/notebooks#new"
        onClick={close}
      >
        <Plus size={16} />
        <span className={cn(collapsed && "sr-only")}>New notebook</span>
      </Link>
      <div aria-live="polite" className="mt-5 min-h-0 flex-1 overflow-y-auto">
        <p
          className={cn(
            "px-2 pb-2 text-xs font-medium tracking-[0.12em] text-[var(--muted)] uppercase",
            collapsed && "sr-only",
          )}
        >
          Notebooks
        </p>
        {notebooks.isPending && (
          <p className="px-2 text-sm text-[var(--muted)]">Loading…</p>
        )}
        {notebooks.isError && (
          <p className="px-2 text-sm text-[var(--destructive)]">
            Notebooks unavailable.
          </p>
        )}
        {notebooks.data?.length === 0 && (
          <p
            className={cn(
              "px-2 text-sm text-[var(--muted)]",
              collapsed && "sr-only",
            )}
          >
            No notebooks yet.
          </p>
        )}
        <div className="grid gap-1">
          {notebooks.data?.map((notebook) => {
            const active = notebook.id === activeId;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-10 items-center gap-2 rounded-[var(--radius)] px-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                  active &&
                    "border border-[var(--border-hover)] bg-[var(--surface-active)] font-medium text-[var(--foreground)]",
                )}
                href={`/notebooks/${notebook.id}`}
                key={notebook.id}
                onClick={close}
                title={notebook.name}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    active ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
                  )}
                />
                <span className={cn("truncate", collapsed && "sr-only")}>
                  {notebook.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeId = pathname.match(/^\/notebooks\/([^/]+)$/)?.[1];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasDrawerOpen = useRef(false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (wasDrawerOpen.current && !drawerOpen) trigger.current?.focus();
    wasDrawerOpen.current = drawerOpen;
  }, [drawerOpen]);
  return (
    <div className="h-[100dvh] overflow-hidden bg-[var(--background)]">
      <div className="hidden h-full md:grid md:grid-cols-[auto_1fr]">
        <aside
          className={cn(
            "transition-[width] duration-200",
            collapsed ? "w-16" : "w-72",
          )}
        >
          <Rail activeId={activeId} collapsed={collapsed} />
        </aside>
        <section className="grid min-w-0 grid-rows-[auto_1fr]">
          <header
            className="flex min-h-16 items-center justify-between border-b bg-[var(--background)] px-5"
            role="banner"
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label={
                  collapsed ? "Expand notebook rail" : "Collapse notebook rail"
                }
                className="grid min-h-10 min-w-10 place-items-center rounded-[var(--radius)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                onClick={() => setCollapsed((value) => !value)}
                type="button"
              >
                {collapsed ? (
                  <PanelLeftOpen size={18} />
                ) : (
                  <PanelLeftClose size={18} />
                )}
              </button>
              <div className="min-w-0">
                <p className="text-xs text-[var(--muted)]">Workspace</p>
                <h1 className="truncate text-sm font-semibold">
                  {activeId ? "Notebook" : "All notebooks"}
                </h1>
              </div>
            </div>
            <span className="text-xs text-[var(--muted)]">
              Knowledge workspace
            </span>
          </header>
          <main className="min-h-0 overflow-y-auto" id="workspace-content">
            {children}
          </main>
        </section>
      </div>
      <div className="grid h-full grid-rows-[auto_1fr] md:hidden">
        <header
          className="flex min-h-16 items-center justify-between border-b px-4"
          role="banner"
        >
          <button
            aria-controls="mobile-notebook-rail"
            aria-expanded={drawerOpen}
            aria-label="Open notebook navigation"
            className="grid min-h-10 min-w-10 place-items-center rounded-[var(--radius)] hover:bg-[var(--surface-hover)]"
            onClick={() => setDrawerOpen(true)}
            ref={trigger}
            type="button"
          >
            <Menu size={19} />
          </button>
          <LumoraLogo decorative size="sm" wordmark />
          <span className="w-10" />
        </header>
        <main className="min-h-0 overflow-y-auto">{children}</main>
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-[var(--overlay)]"
            onClick={() => setDrawerOpen(false)}
          >
            <aside
              aria-modal="true"
              className="h-full w-[min(18rem,86vw)] bg-[var(--surface-muted)] shadow-[var(--shadow-overlay)]"
              id="mobile-notebook-rail"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <Rail activeId={activeId} close={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
