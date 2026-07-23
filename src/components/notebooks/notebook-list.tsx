"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createNotebook, listNotebooks } from "@/lib/api/notebooks";
import { createNotebookSchema } from "@/lib/validation/notebook";

type FormValues = { name: string; description: string };

export function NotebookList() {
  const queryClient = useQueryClient();
  const notebooks = useQuery({
    queryKey: ["notebooks"],
    queryFn: listNotebooks,
    retry: (count, error) => !error.message.includes("not found") && count < 2,
  });
  const form = useForm<FormValues>({
    defaultValues: { name: "", description: "" },
  });
  const create = useMutation({
    mutationFn: createNotebook,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      form.reset();
    },
  });
  const submit = (values: FormValues) => {
    const parsed = createNotebookSchema.safeParse(values);
    if (!parsed.success) {
      form.setError("name", {
        message: parsed.error.issues[0]?.message ?? "Invalid notebook.",
      });
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">Lumora</p>
        <h1 className="mt-2 text-3xl font-semibold">Notebooks</h1>
        <p className="mt-2 text-[var(--muted)]">
          Create a workspace to organize future research sources and
          conversations.
        </p>
      </header>
      <section className="mt-8 rounded-[var(--radius)] border bg-[var(--card)] p-6">
        <h2 className="font-semibold">Create a notebook</h2>
        <form className="mt-4 grid gap-3" onSubmit={form.handleSubmit(submit)}>
          <label className="grid gap-1 text-sm">
            Name
            <input
              className="rounded-md border bg-transparent px-3 py-2"
              disabled={create.isPending}
              {...form.register("name")}
            />
          </label>
          {form.formState.errors.name && (
            <p className="text-sm text-[var(--destructive)]">
              {form.formState.errors.name.message}
            </p>
          )}
          <label className="grid gap-1 text-sm">
            Description <span className="text-[var(--muted)]">(optional)</span>
            <textarea
              className="min-h-20 rounded-md border bg-transparent px-3 py-2"
              disabled={create.isPending}
              {...form.register("description")}
            />
          </label>
          {create.error && (
            <p className="text-sm text-[var(--destructive)]">
              {create.error.message}
            </p>
          )}
          <button
            className="w-fit rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-50"
            disabled={create.isPending}
            type="submit"
          >
            {create.isPending ? "Creating…" : "Create notebook"}
          </button>
        </form>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your notebooks</h2>
        {notebooks.isPending && (
          <p className="mt-4 text-[var(--muted)]">Loading notebooks…</p>
        )}
        {notebooks.isError && (
          <p className="mt-4 text-[var(--destructive)]">
            {notebooks.error.message}
          </p>
        )}
        {notebooks.data?.length === 0 && (
          <p className="mt-4 rounded-[var(--radius)] border p-5 text-[var(--muted)]">
            No notebooks yet. Create one to begin.
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {notebooks.data?.map((notebook) => (
            <Link
              className="rounded-[var(--radius)] border bg-[var(--card)] p-5 transition-colors hover:border-[var(--accent)]"
              href={`/notebooks/${notebook.id}`}
              key={notebook.id}
            >
              <h3 className="font-medium">{notebook.name}</h3>
              {notebook.description && (
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {notebook.description}
                </p>
              )}
              <p className="mt-3 text-xs text-[var(--muted)]">
                {notebook._count.sources} sources ·{" "}
                {notebook._count.conversations} conversations
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
