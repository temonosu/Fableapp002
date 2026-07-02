import { useEffect, useState } from "react";
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
    <main>
      <h1>myapp</h1>
      <p>スマートフォン向け Web アプリのテンプレートです。</p>
      <section aria-label="バックエンド疎通確認">
        <h2>API ステータス</h2>
        {health && (
          <p>
            API: {health.status} / DB: {health.database}
          </p>
        )}
        {error && <p role="alert">API に接続できません: {error}</p>}
        {!health && !error && <p>確認中...</p>}
      </section>
    </main>
  );
}
