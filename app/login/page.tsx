"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Anmeldung fehlgeschlagen.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Die Anmeldung konnte nicht durchgeführt werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold tracking-[0.18em] text-[#211f1b]">
            ALTER TELEGRAF
          </p>

          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-[#b08a4a]">
            Administration
          </p>
        </div>

        <div className="border border-[#211f1b]/10 bg-white p-8 shadow-sm sm:p-10">
          <h1 className="text-3xl text-[#211f1b]">
            Willkommen zurück.
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#756f64]">
            Melden Sie sich an, um Ihre Website zu verwalten.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-[#211f1b]"
              >
                E-Mail-Adresse
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ihre@email.at"
                autoComplete="email"
                required
                className="w-full border border-[#211f1b]/15 bg-[#f5f1e8] px-4 py-3.5 text-sm text-[#211f1b] outline-none transition placeholder:text-[#756f64]/60 focus:border-[#b08a4a]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-[#211f1b]"
              >
                Passwort
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full border border-[#211f1b]/15 bg-[#f5f1e8] px-4 py-3.5 text-sm text-[#211f1b] outline-none transition placeholder:text-[#756f64]/60 focus:border-[#b08a4a]"
              />
            </div>

            {error && (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#211f1b] px-6 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Anmeldung läuft..." : "Anmelden"}
            </button>
          </form>
        </div>

        <a
          href="/"
          className="mt-6 block text-center text-sm text-[#756f64] transition hover:text-[#b08a4a]"
        >
          ← Zur Website
        </a>
      </div>
    </main>
  );
}