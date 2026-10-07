// Geprueft am 24.09.2026: foodora und Wolt fuehren zur Filiale Grabenstrasse 12,
// 8010 Graz. Lieferando antwortet auf automatisierte Aufrufe mit 403 (Bot-Schutz),
// die Adresse stammt aus der Lieferando-Suche.
//
// `color` ist die jeweilige Markenfarbe und dient nur als Akzent. Es werden
// bewusst keine Logodateien nachgebaut, sondern die Wortmarken verwendet.
export const DELIVERY_SERVICES = [
  {
    name: "foodora",
    href: "https://www.foodora.at/restaurant/h2vj/restaurant-hendl-eck",
    color: "#D61F62",
  },
  {
    name: "Lieferando",
    href: "https://www.lieferando.at/speisekarte/restaurant-hendl-eck",
    color: "#FF8000",
  },
  {
    name: "Wolt",
    href: "https://wolt.com/en/aut/graz/restaurant/restaurant-hendl-eck",
    color: "#00C2E8",
  },
] as const;

// Kompakte Marken-Buttons fuer den Footer. Mindesthoehe 44 px, damit sie auf
// dem Handy gut zu treffen sind, und Umbruch statt Scrollen.
export function DeliveryButtons({ dark = true }: { dark?: boolean }) {
  const style = dark
    ? "border-white/15 bg-white/[0.06] text-white/85 hover:border-white/40 hover:bg-white/[0.12] hover:text-white"
    : "border-[#211f1b]/15 bg-white text-[#211f1b] hover:border-[#211f1b]/35 hover:bg-[#f0ebdf]";

  return (
    <div className="flex flex-wrap gap-2.5">
      {DELIVERY_SERVICES.map((service) => (
        <a
          key={service.name}
          href={service.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Bei ${service.name} online bestellen`}
          className={`group inline-flex min-h-[44px] items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${style}`}
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full transition group-hover:scale-125"
            style={{ backgroundColor: service.color }}
          />
          {service.name}
        </a>
      ))}
    </div>
  );
}

export function DeliveryInline({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-[#756f64] ${className}`}>
      Online bestellen:{" "}
      {DELIVERY_SERVICES.map((service, index) => (
        <span key={service.name}>
          {index > 0 && <span className="px-1.5 text-[#756f64]/50">·</span>}
          <a
            href={service.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-[#b08a4a]/50 underline-offset-4 transition hover:text-[#211f1b] hover:decoration-[#b08a4a]"
          >
            {service.name}
          </a>
        </span>
      ))}
    </p>
  );
}

export default function DeliveryLinks({ dark = false }: { dark?: boolean }) {
  return (
    <section
      className={
        dark
          ? "border-t border-white/10 bg-[#211f1b] px-6 py-20 text-[#f5f1e8] lg:px-10"
          : "border-t border-[#211f1b]/10 px-6 py-20 lg:px-10"
      }
    >
      <div className="mx-auto max-w-3xl text-center">
        <p
          className={`text-xs font-bold uppercase tracking-[0.3em] ${
            dark ? "text-[#d8c39a]" : "text-[#b08a4a]"
          }`}
        >
          Online bestellen
        </p>

        <h2 className="mt-5 font-serif text-3xl leading-tight sm:text-4xl">
          Lassen Sie sich unsere Küche
          <br />
          <span className={dark ? "italic text-[#d8c39a]" : "italic text-[#b08a4a]"}>
            nach Hause liefern.
          </span>
        </h2>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          {DELIVERY_SERVICES.map((service) => (
            <a
              key={service.name}
              href={service.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded-full border px-7 py-3.5 text-sm font-semibold transition ${
                dark
                  ? "border-white/25 text-[#f5f1e8] hover:border-[#d8c39a] hover:bg-[#d8c39a] hover:text-[#211f1b]"
                  : "border-[#211f1b]/20 text-[#211f1b] hover:border-[#b08a4a] hover:bg-[#b08a4a] hover:text-white"
              }`}
            >
              {service.name}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
