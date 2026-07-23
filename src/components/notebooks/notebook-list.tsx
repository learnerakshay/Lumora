"use client";

import { FileText, Globe2, Plus, Upload, Video, Waves } from "lucide-react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createNotebook, listNotebooks } from "@/lib/api/notebooks";
import { createNotebookSchema } from "@/lib/validation/notebook";
import { LumoraLogo } from "@/components/brand/lumora-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type FormValues = { name: string };
const importTypes = [
  [Upload, "Document", "PDF or document"],
  [Globe2, "Website", "A page or article"],
  [FileText, "Text", "Notes or excerpts"],
  [Video, "Video", "YouTube context"],
  [Waves, "Transcript", "VTT context"],
] as const;

export function NotebookList() {
  const queryClient = useQueryClient();
  const notebooks = useQuery({
    queryKey: ["notebooks"],
    queryFn: listNotebooks,
    retry: false,
  });
  const form = useForm<FormValues>({ defaultValues: { name: "" } });
  const create = useMutation({
    mutationFn: (values: FormValues) => createNotebook(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      form.reset();
    },
  });
  const submit = (values: FormValues) => {
    const parsed = createNotebookSchema.safeParse(values);
    if (!parsed.success) {
      form.setError("name", {
        message: parsed.error.issues[0]?.message ?? "Enter a notebook name.",
      });
      return;
    }
    create.mutate(parsed.data);
  };
  return (
    <main className="mx-auto flex min-h-full max-w-6xl items-center px-[var(--page-gutter)] py-10 lg:py-16">
      <div className="w-full">
        <div className="mx-auto max-w-3xl text-center">
          <LumoraLogo
            className="justify-center"
            decorative
            size="md"
            wordmark
          />
          <p className="mt-8 text-xs font-medium tracking-[0.16em] text-[var(--accent-cyan)] uppercase">
            Your knowledge observatory
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
            Begin with the material that matters.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-pretty text-[var(--text-secondary)]">
            Create a notebook, then bring your research into one calm place for
            context, questions, and understanding.
          </p>
        </div>
        <section
          className="mx-auto mt-12 max-w-4xl"
          aria-labelledby="source-import-title"
        >
          <div className="relative overflow-hidden rounded-[calc(var(--radius-lg)+0.25rem)] border border-[var(--border-strong)] bg-[linear-gradient(145deg,var(--surface),var(--surface-muted))] p-1 shadow-[var(--shadow-raised)]">
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] px-6 py-8 sm:px-10 sm:py-10">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-medium tracking-[0.14em] text-[var(--muted)] uppercase">
                    Knowledge intake
                  </p>
                  <h2
                    className="mt-2 text-xl font-semibold tracking-[-0.025em]"
                    id="source-import-title"
                  >
                    Add the first source when you&apos;re ready.
                  </h2>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-[var(--muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-disabled)]" />
                  Import is not enabled
                </span>
              </div>
              <div className="mt-8 grid place-items-center rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-5 py-10 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--accent)]/30 bg-[var(--surface)] text-[var(--accent-cyan)]">
                  <Upload size={19} />
                </div>
                <p className="mt-4 font-medium">
                  A clear place for your research
                </p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
                  Source processing will be available in a later phase. This
                  workspace is ready for it.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {importTypes.map(([Icon, name, detail]) => (
                  <button
                    aria-describedby="source-import-title"
                    className="group min-h-20 rounded-[var(--radius)] border bg-[var(--surface-muted)] p-3 text-left opacity-75"
                    disabled
                    key={name}
                    type="button"
                  >
                    <Icon
                      aria-hidden
                      className="text-[var(--text-disabled)]"
                      size={16}
                    />
                    <span className="mt-3 block text-sm font-medium text-[var(--text-secondary)]">
                      {name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                      {detail}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section
          className="mx-auto mt-8 max-w-xl"
          id="new"
          aria-labelledby="new-notebook-title"
        >
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={form.handleSubmit(submit)}
          >
            <div className="min-w-0 flex-1">
              <label className="sr-only" htmlFor="notebook-name">
                Notebook name
              </label>
              <Input
                id="notebook-name"
                placeholder="Name your notebook"
                disabled={create.isPending}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="mt-2 text-sm text-[var(--destructive)]">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <Button loading={create.isPending} type="submit">
              <Plus aria-hidden size={16} />{" "}
              <span className="ml-1">Create notebook</span>
            </Button>
          </form>
          {create.error && (
            <p className="mt-3 text-sm text-[var(--destructive)]">
              {create.error.message}
            </p>
          )}
          {notebooks.isError && (
            <p className="mt-5 text-center text-sm text-[var(--destructive)]">
              Your notebooks could not be loaded. Please try again.
            </p>
          )}
          {notebooks.data?.length === 0 && (
            <p className="mt-5 text-center text-sm text-[var(--muted)]">
              Your notebook rail will hold the work you choose to keep close.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
