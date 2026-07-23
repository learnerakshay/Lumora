import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <Link className="mt-3 inline-block text-[var(--accent)]" href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
