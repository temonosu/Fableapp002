import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, buildUrl } from "./client";

describe("buildUrl", () => {
  it("パスを /api/v1 配下に組み立てる", () => {
    expect(buildUrl("health")).toMatch(/\/api\/v1\/health$/);
  });

  it("先頭スラッシュの重複を除去する", () => {
    expect(buildUrl("/health")).toMatch(/\/api\/v1\/health$/);
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
