import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, buildUrl, buildWsUrl } from "./client";

describe("buildUrl", () => {
  it("パスを /api/v1 配下に組み立てる", () => {
    expect(buildUrl("health")).toMatch(/\/api\/v1\/health$/);
  });

  it("先頭スラッシュの重複を除去する", () => {
    expect(buildUrl("/health")).toMatch(/\/api\/v1\/health$/);
  });
});

describe("buildWsUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("絶対 URL は http(s) を ws(s) に読み替える", () => {
    // テスト環境の既定 BASE_URL は http://localhost:8000
    expect(buildWsUrl("rooms/ABC12/ws")).toBe("ws://localhost:8000/api/v1/rooms/ABC12/ws");
  });

  it("同一オリジン配信(相対パス)は window.location から組み立てる", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubGlobal("window", { location: { protocol: "https:", host: "example.run.app" } });
    vi.resetModules();
    const { buildWsUrl: relative } = await import("./client");
    expect(relative("rooms/ABC12/ws")).toBe("wss://example.run.app/api/v1/rooms/ABC12/ws");
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("apiGet", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("JSON レスポンスを返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
    );
    await expect(apiGet<{ status: string }>("health")).resolves.toEqual({ status: "ok" });
  });

  it("エラーステータスで ApiError を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    await expect(apiGet("health")).rejects.toBeInstanceOf(ApiError);
  });
});
