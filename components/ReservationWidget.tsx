"use client";

import { useEffect } from "react";

export default function ReservationWidget() {
  useEffect(() => {
    const existingScript = document.querySelector(
      'script[src*="static.teburio.de/w2.js"]'
    );

    if (existingScript) {
      return;
    }

    const script = document.createElement("script");

    script.src =
      "https://static.teburio.de/w2.js?id=fTTJKctq7Dv4o85PS";

    script.async = true;

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <div
      id="teburio-fTTJKctq7Dv4o85PS"
      className="mx-auto w-full"
    />
  );
}