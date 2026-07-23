"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-[var(--background)] p-6 text-[var(--foreground)]">
        <main>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <button className="mt-4 rounded-md border px-3 py-2" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
