// Thin client-side fetch helper. Server: use direct DB calls / runners.

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string | null,
    public readonly details: unknown = null,
    public readonly status: number = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toApiError(res: Response, data: any): ApiError {
  return new ApiError(
    data?.error?.message ?? res.statusText ?? "Request failed",
    data?.error?.code ?? null,
    data?.error?.details ?? null,
    res.status,
  );
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw toApiError(res, data);
  }
  return data.data as T;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw toApiError(res, data);
  }
  return data.data as T;
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw toApiError(res, data);
  }
  return data.data as T;
}

export async function apiDelete<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw toApiError(res, data);
  }
  return data.data as T;
}
