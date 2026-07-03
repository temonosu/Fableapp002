import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHealth, type HealthResponse } from "../api/health";

export function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="mx-auto max-w-[640px] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <h1 className="text-2xl font-bold">myapp</h1>
      <p className="mt-2">スマートフォン向け Web アプリのテンプレートです。</p>
      <Link
        to="/run"
        className="mt-4 block rounded bg-rose-700 py-3 text-center font-bold text-white active:bg-rose-800"
      >
        旅打ちに出る(ラン)
      </Link>
      <Link
        to="/match"
        className="mt-3 block rounded border border-rose-700 py-3 text-center font-bold text-rose-700 active:bg-rose-50"
      >
        腕試し(単発対局)
      </Link>
      <section aria-label="バックエンド疎通確認" className="mt-6">
        <h2 className="text-lg font-semibold">API ステータス</h2>
        {health && (
          <p className="mt-1">
            API: {health.status} / DB: {health.database}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-red-700">
            API に接続できません: {error}
          </p>
        )}
        {!health && !error && <p className="mt-1 text-neutral-500">確認中...</p>}
      </section>
    </main>
  );
}
