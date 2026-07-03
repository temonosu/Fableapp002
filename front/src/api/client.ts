// API 通信はすべてこのモジュール経由で行う(コンポーネントから直接 fetch しない)

const BASE_URL: string = import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function buildUrl(path: string): string {
  return `${BASE_URL.replace(/\/$/, "")}/api/v1/${path.replace(/^\//, "")}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(buildUrl(path));
  if (!response.ok) {
    throw new ApiError(response.status, `GET ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : null,
  });
  if (!response.ok) {
    throw new ApiError(response.status, `POST ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

/** WebSocket 用の URL(http(s) → ws(s) に読み替え) */
export function buildWsUrl(path: string): string {
  return buildUrl(path).replace(/^http/, "ws");
}
