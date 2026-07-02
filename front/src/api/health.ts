import { apiGet } from "./client";

export interface HealthResponse {
  status: "ok";
  database: "ok" | "unavailable";
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>("health");
}
