export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function apiRequest<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        error: data.error || "Die Aktion konnte nicht ausgeführt werden.",
      };
    }

    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Die Verbindung zum Server ist fehlgeschlagen." };
  }
}

export function toFormValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

// Temporal.PlainTime wird als "16:00:00" serialisiert.
export function toTimeValue(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}
