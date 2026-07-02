# front

フロントエンド (React + Vite + TypeScript)。

```bash
npm install
npm run dev    # 開発サーバ (http://localhost:5173)
npm test       # Vitest
npm run lint   # ESLint
```

設計方針は `docs/spec/foundation/design.md`、コーディング制約はルートの `CLAUDE.md` を参照。
API 通信は `src/api/` に集約する。
