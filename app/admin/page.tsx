import LogoutButton from "@/components/LogoutButton";

export default function AdminPage() {
    return (
        <main className="min-h-screen bg-[#f5f1e8] text-[#211f1b]">

            {/* Header */}
            <header className="border-b border-[#211f1b]/10 bg-[#211f1b] text-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">

                    <div>
                        <p className="text-sm font-semibold tracking-[0.18em]">
                            ALTER TELEGRAF
                        </p>

                        <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[#c9a96a]">
                            Administration
                        </p>
                    </div>

                    <div className="flex items-center gap-6">
                        <a
                            href="/"
                            className="text-sm text-white/60 transition hover:text-white"
                        >
                            ← Website
                        </a>

                        <LogoutButton />
                    </div>

                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">

                {/* Page heading */}
                <div>
                    <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#b08a4a]">
                        Dashboard
                    </p>

                    <h1 className="mt-3 text-4xl sm:text-5xl">
                        Guten Tag.
                    </h1>

                    <p className="mt-4 max-w-2xl text-[#756f64]">
                        Verwalten Sie hier die wichtigsten Inhalte Ihrer Website.
                    </p>
                </div>

                {/* Dashboard cards */}
                <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

                    {/* Tagesmenü */}
                    <a
                        href="/admin/tagesmenue"
                        className="group rounded-2xl border border-[#211f1b]/10 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9e2d5] text-xl">
                            🍽️
                        </div>

                        <h2 className="mt-6 text-2xl">
                            Tagesmenü
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-[#756f64]">
                            Tagesgerichte, Beschreibung und Preis verwalten.
                        </p>

                        <span className="mt-6 inline-block text-sm font-bold text-[#b08a4a]">
                            Bearbeiten →
                        </span>
                    </a>

                    {/* Speisekarte */}
                    <div className="rounded-2xl border border-[#211f1b]/10 bg-white p-7 opacity-70 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9e2d5] text-xl">
                            📖
                        </div>

                        <h2 className="mt-6 text-2xl">
                            Speisekarte
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-[#756f64]">
                            Gerichte, Kategorien und Preise verwalten.
                        </p>

                        <span className="mt-6 inline-block text-xs font-bold uppercase tracking-wider text-[#756f64]">
                            Bald verfügbar
                        </span>
                    </div>

                    {/* Website */}
                    <a
                        href="/"
                        className="group rounded-2xl border border-[#211f1b]/10 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9e2d5] text-xl">
                            🌐
                        </div>

                        <h2 className="mt-6 text-2xl">
                            Website ansehen
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-[#756f64]">
                            Öffnen Sie die öffentliche Website.
                        </p>

                        <span className="mt-6 inline-block text-sm font-bold text-[#b08a4a]">
                            Website öffnen →
                        </span>
                    </a>

                </div>

                {/* Info */}
                <div className="mt-10 rounded-2xl border border-[#b08a4a]/20 bg-[#e9e2d5] p-6 sm:p-7">
                    <p className="text-sm font-bold text-[#211f1b]">
                        Einfach verwalten
                    </p>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#756f64]">
                        Die Verwaltung wird bewusst einfach gehalten, damit Inhalte
                        auch ohne technische Kenntnisse schnell geändert werden können.
                    </p>
                </div>

            </div>

        </main>
    );
}