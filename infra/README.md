# infra

インフラ定義 (IaC・デプロイ設定)。

デプロイ先は未定 (`docs/spec/foundation/requirements.md` の未決事項を参照)。
決定後、新しい spec(例: `docs/spec/deploy/`)を書いてから IaC をここに追加する。

P2P 対戦(`docs/spec/p2p-match/`)を実装する際は、シグナリング用に backend の
WebSocket を公開する構成が必要になる点に注意。
