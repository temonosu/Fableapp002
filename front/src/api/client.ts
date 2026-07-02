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
