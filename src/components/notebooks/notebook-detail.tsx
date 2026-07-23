"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteNotebook,
  getNotebook,
  updateNotebook,
} from "@/lib/api/notebooks";
import { updateNotebookSchema } from "@/lib/validation/notebook";

type FormValues = { name: string; description: string };

export function NotebookDetail({ notebookId }: { notebookId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const notebook = useQuery({
    queryKey: ["notebooks", notebookId],
    queryFn: () => getNotebook(notebookId),
    retry: false,
  });
  const form = useForm<FormValues>({
    values: notebook.data
      ? {
          name: notebook.data.name,
          description: notebook.data.description ?? "",
        }
      : undefined,
  });
  const update = useMutation({
    mutationFn: (values: FormValues) => updateNotebook(notebookId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      void queryClient.invalidateQueries({
        queryKey: ["notebooks", notebookId],
      });
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteNotebook(notebookId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      router.push("/notebooks");
    },
  });
  const submit = (values: FormValues) => {
    const parsed = updateNotebookSchema.safeParse(values);
    if (!parsed.success) {
      form.setError("name", {
        message: parsed.error.issues[0]?.message ?? "Invalid update.",
      });
      return;
    }
    update.mutate(values);
  };
  if (notebook.isPending)
    return (
      <main className="grid min-h-screen place-items-center text-[var(--muted)]">
        Loading notebook…
      </main>
    );
  if (notebook.isError)
    return (
      <main className="mx-auto max-w-4xl p-8">
        <Link className="text-[var(--accent)]" href="/notebooks">
          ← Back to notebooks
        </Link>
        <p className="mt-6 text-[var(--destructive)]">
          {notebook.error.message}
        </p>
      </main>
    );
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <Link className="text-sm text-[var(--accent)]" href="/notebooks">
        ← Back to notebooks
      </Link>
      <header className="mt-6">
        <p className="text-sm text-[var(--muted)]">
          Updated {new Date(notebook.data.updatedAt).toLocaleDateString()}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{notebook.data.name}</h1>
        {notebook.data.description && (
          <p className="mt-2 text-[var(--muted)]">
            {notebook.data.description}
          </p>
        )}
      </header>
      <section className="mt-8 rounded-[var(--radius)] border bg-[var(--card)] p-6">
        <h2 className="font-semibold">Notebook details</h2>
        <form className="mt-4 grid gap-3" onSubmit={form.handleSubmit(submit)}>
          <label className="grid gap-1 text-sm">
            Name
            <input
              className="rounded-md border bg-transparent px-3 py-2"
              disabled={update.isPending}
              {...form.register("name")}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Description
            <textarea
              className="min-h-20 rounded-md border bg-transparent px-3 py-2"
              disabled={update.isPending}
              {...form.register("description")}
            />
          </label>
          {(form.formState.errors.name || update.error) && (
            <p className="text-sm text-[var(--destructive)]">
              {form.formState.errors.name?.message ?? update.error?.message}
            </p>
          )}
          <button
            className="w-fit rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-50"
            disabled={update.isPending}
            type="submit"
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius)] border p-5">
          <h2 className="font-semibold">Sources</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {notebook.data.sources.length
              ? `${notebook.data.sources.length} metadata record(s) available.`
              : "Source ingestion will be added in a later phase."}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border p-5">
          <h2 className="font-semibold">Conversations</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Chat and grounded responses will be added in a later phase.
          </p>
        </div>
      </section>
      <section className="mt-8 border-t pt-6">
        <h2 className="font-semibold text-[var(--destructive)]">
          Delete notebook
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          This permanently removes its owned records.
        </p>
        {remove.error && (
          <p className="mt-3 text-sm text-[var(--destructive)]">
            {remove.error.message}
          </p>
        )}
        <button
          className="mt-4 rounded-md border border-[var(--destructive)] px-4 py-2 text-[var(--destructive)] disabled:opacity-50"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm("Delete this notebook and its owned data?"))
              remove.mutate();
          }}
          type="button"
        >
          {remove.isPending ? "Deleting…" : "Delete notebook"}
        </button>
      </section>
    </main>
  );
}
