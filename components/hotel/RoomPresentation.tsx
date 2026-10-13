"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";

// Zimmerdarstellung fuer Gaeste. Das Zimmer ist ein Produkt: grosses Foto,
// klare Eckdaten, Ausstattung, Preis. Verwendet auf der Hotelseite und in der
// Buchungsstrecke, damit der Gast ueberall dieselbe Darstellung sieht.
//
// Zimmernummern kommen hier bewusst nicht vor. Gebucht wird eine Kategorie.

export type ShowcaseImage = { id: number; src: string; alt: string };

export type ShowcaseAmenity = { code: string; name: string; icon: string | null };

export type ShowcaseBed = { bedType: string; label: string };

export type ShowcaseRoom = {
  roomTypeId: number;
  name: string;
  shortDescription: string | null;
  description: string | null;
  sizeSqm: number | null;
  /** Personenzahl, die hier gezeigt wird. */
  persons: number;
  maxOccupancy: number;
  images: ShowcaseImage[];
  amenities: ShowcaseAmenity[];
  bedTypes: ShowcaseBed[];
  /** Betrag als Dezimalzahl, z. B. "139.00". Null, wenn kein Preis gepflegt ist. */
  price: string | null;
  /** True, wenn der Preis ein "ab"-Preis ist. */
  priceIsFrom: boolean;
  roomsAvailable?: number;
};



const personLabel = (count: number) => `${count} ${count === 1 ? "Person" : "Personen"}`;

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[#756f64]">
      <span className="text-[#315c45]" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  );
}

const PersonIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="8" cy="5" r="2.6" />
    <path d="M2.8 14c0-2.9 2.3-4.6 5.2-4.6s5.2 1.7 5.2 4.6" />
  </svg>
);

const BedIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M1.8 12V5.5M1.8 8.6h12.4V12" />
    <path d="M4.6 8.6V6.4h4.2v2.2" />
  </svg>
);

const SizeIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1" />
    <path d="M5 11V5h6" />
  </svg>
);

/** Fallback, solange fuer eine Kategorie noch kein Foto hinterlegt ist. */
function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#e9e2d5]">
      <span className="px-6 text-center text-xs uppercase tracking-[0.3em] text-[#756f64]">
        {label}
      </span>
    </div>
  );
}

export function AmenityList({
  amenities,
  limit,
}: {
  amenities: ShowcaseAmenity[];
  limit?: number;
}) {
  if (amenities.length === 0) return null;

  const shown = limit ? amenities.slice(0, limit) : amenities;
  const rest = amenities.length - shown.length;

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2">
      {shown.map((amenity) => (
        <li key={amenity.code} className="flex items-center gap-2 text-sm">
          <span className="text-[#315c45]" aria-hidden>
            &#10003;
          </span>
          {amenity.name}
        </li>
      ))}

      {rest > 0 && <li className="text-sm text-[#756f64]">und {rest} weitere</li>}
    </ul>
  );
}

/** Grosses Bild mit Vorschaubildern darunter. */
export function RoomGallery({ room }: { room: ShowcaseRoom }) {
  const [index, setIndex] = useState(0);
  const total = room.images.length;
  const current = room.images[Math.min(index, Math.max(total - 1, 0))];

  const step = useCallback(
    (delta: number) => setIndex((value) => (value + delta + total) % Math.max(total, 1)),
    [total]
  );

  if (total === 0 || !current) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden rounded-xl">
        <ImagePlaceholder label={room.name} />
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#e9e2d5]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.src}
          alt={current.alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Vorheriges Bild"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg shadow transition hover:bg-white"
            >
              &#8249;
            </button>

            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Nächstes Bild"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg shadow transition hover:bg-white"
            >
              &#8250;
            </button>

            <span className="absolute bottom-3 right-3 rounded-full bg-[#211f1b]/70 px-3 py-1 text-xs text-white">
              {Math.min(index, total - 1) + 1} / {total}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {room.images.map((image, position) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Bild ${position + 1} anzeigen`}
              aria-current={position === index}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                position === index ? "border-[#b08a4a]" : "border-transparent opacity-70"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RoomFacts({ room }: { room: ShowcaseRoom }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <Fact icon={PersonIcon}>{personLabel(room.persons)}</Fact>

      {room.bedTypes.length > 0 && (
        <Fact icon={BedIcon}>{room.bedTypes.map((bed) => bed.label).join(" oder ")}</Fact>
      )}

      {room.sizeSqm !== null && <Fact icon={SizeIcon}>{room.sizeSqm} m&sup2;</Fact>}
    </div>
  );
}

function Price({ room }: { room: ShowcaseRoom }) {
  if (!room.price) return null;

  return (
    <p className="font-serif text-2xl text-[#211f1b]">
      {room.priceIsFrom && <span className="mr-1 text-base text-[#756f64]">ab</span>}
      {formatMoney(room.price)}
      <span className="ml-1 font-sans text-sm text-[#756f64]">/ Nacht</span>
    </p>
  );
}

/** Zimmerkarte mit grossem Hauptbild. */
export function RoomCard({
  room,
  onDetails,
  onSelect,
  selectLabel = "Auswählen",
  selected = false,
  children,
}: {
  room: ShowcaseRoom;
  onDetails: () => void;
  onSelect?: () => void;
  selectLabel?: string;
  selected?: boolean;
  children?: React.ReactNode;
}) {
  const primary = room.images[0];

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white transition ${
        selected ? "border-[#b08a4a] shadow-md" : "border-[#211f1b]/10"
      }`}
    >
      <button
        type="button"
        onClick={onDetails}
        aria-label={`${room.name} ansehen`}
        className="relative aspect-[4/3] w-full overflow-hidden"
      >
        {primary ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={primary.src}
            alt={primary.alt}
            className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <ImagePlaceholder label={room.name} />
        )}

        {room.images.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-[#211f1b]/70 px-3 py-1 text-xs text-white">
            {room.images.length} Fotos
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-serif text-2xl">{room.name}</h3>

        {room.shortDescription && (
          <p className="mt-2 text-sm leading-6 text-[#756f64]">{room.shortDescription}</p>
        )}

        <div className="mt-4">
          <RoomFacts room={room} />
        </div>

        {room.amenities.length > 0 && (
          <div className="mt-4 border-t border-[#211f1b]/10 pt-4">
            <AmenityList amenities={room.amenities} limit={4} />
          </div>
        )}

        {children}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-[#211f1b]/10 pt-5">
          <div>
            <Price room={room} />

            {typeof room.roomsAvailable === "number" && (
              <p className="mt-1 text-xs text-[#756f64]">
                {room.roomsAvailable === 1
                  ? "Noch 1 Zimmer frei"
                  : `${room.roomsAvailable} Zimmer frei`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDetails}
              className="rounded-full border border-[#211f1b]/20 px-5 py-3 text-sm font-bold uppercase tracking-wider transition hover:border-[#b08a4a]"
            >
              Zimmer ansehen
            </button>

            {onSelect && (
              <button
                type="button"
                onClick={onSelect}
                className="rounded-full bg-[#211f1b] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630]"
              >
                {selectLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Detailansicht als Dialog: Galerie, Texte, Ausstattung, Preis. */
export function RoomDetail({
  room,
  onClose,
  onSelect,
  selectLabel = "Zimmer auswählen",
}: {
  room: ShowcaseRoom;
  onClose: () => void;
  onSelect?: () => void;
  selectLabel?: string;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={room.name}
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#211f1b]/70 px-4 py-8 sm:px-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto max-w-4xl rounded-2xl bg-[#f5f1e8] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#211f1b]/10 px-6 py-5 sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#315c45]">
              Hotel Alter Telegraf
            </p>
            <h2 className="mt-1 font-serif text-3xl">{room.name}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#211f1b]/20 text-lg transition hover:border-[#b08a4a]"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <RoomGallery room={room} />

          <div className="mt-6">
            <RoomFacts room={room} />
          </div>

          {(room.description || room.shortDescription) && (
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-[#756f64]">
                Über das Zimmer
              </h3>
              <p className="mt-3 whitespace-pre-line leading-7">
                {room.description ?? room.shortDescription}
              </p>
            </div>
          )}

          {room.amenities.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-[#756f64]">
                Ausstattung
              </h3>
              <div className="mt-3">
                <AmenityList amenities={room.amenities} />
              </div>
            </div>
          )}

          {room.bedTypes.length > 1 && (
            <div className="mt-6 rounded-xl border border-[#211f1b]/10 bg-white p-5">
              <p className="font-semibold">Sie bevorzugen getrennte Betten?</p>
              <p className="mt-1 text-sm leading-6 text-[#756f64]">
                Diese Kategorie gibt es als{" "}
                {room.bedTypes.map((bed) => bed.label).join(" und als ")}. Die gewünschte
                Bettkonfiguration wählen Sie bei der Buchung.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-[#211f1b]/10 pt-6">
            <div>
              <Price room={room} />
              <p className="mt-1 text-xs text-[#756f64]">
                Für {personLabel(room.persons)}, maximal {personLabel(room.maxOccupancy)}.
              </p>
            </div>

            {onSelect ? (
              <button
                type="button"
                onClick={onSelect}
                className="rounded-full bg-[#211f1b] px-7 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630]"
              >
                {selectLabel}
              </button>
            ) : (
              <a
                href="/hotel/buchen"
                className="rounded-full bg-[#211f1b] px-7 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#3a3630]"
              >
                Verfügbarkeit prüfen
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Kartengitter mit Detailansicht. */
export function RoomShowcase({
  rooms,
  columns = 3,
}: {
  rooms: ShowcaseRoom[];
  columns?: 2 | 3;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = rooms.find((room) => room.roomTypeId === openId) ?? null;

  return (
    <>
      <div
        className={`grid gap-6 ${
          columns === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {rooms.map((room) => (
          <RoomCard
            key={room.roomTypeId}
            room={room}
            onDetails={() => setOpenId(room.roomTypeId)}
          />
        ))}
      </div>

      {open && <RoomDetail room={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
