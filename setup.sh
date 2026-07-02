#!/usr/bin/env bash
# テンプレートから新プロジェクトを始めるための初期化スクリプト
#
# 使い方:
#   ./setup.sh <プロジェクト名>
#
# やること:
#   1. プレースホルダー "myapp" をプロジェクト名に一括置換
#   2. .env.example から .env を作成
#
# プロジェクト名は英小文字・数字・ハイフンのみ(DB名やパッケージ名に使われるため)

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "使い方: ./setup.sh <プロジェクト名>" >&2
    exit 1
fi

NAME="$1"

if ! echo "$NAME" | grep -Eq '^[a-z][a-z0-9-]*$'; then
    echo "エラー: プロジェクト名は英小文字始まり、英小文字・数字・ハイフンのみ使えます" >&2
    exit 1
fi

# DB名・Pythonパッケージ名にはハイフンが使えないためアンダースコアに変換した名前を使う
NAME_SNAKE="${NAME//-/_}"

cd "$(dirname "$0")"

echo "==> 'myapp' を '$NAME' に置換します"
TARGETS=$(git grep -l 'myapp' -- ':!setup.sh' ':!README.md' || true)
for f in $TARGETS; do
    # DB接続文字列・DB名・パッケージ名はスネークケース、それ以外はそのまま
    sed -i \
        -e "s/postgresql+psycopg:\/\/myapp:myapp@\([^/]*\)\/myapp/postgresql+psycopg:\/\/${NAME_SNAKE}:${NAME_SNAKE}@\1\/${NAME_SNAKE}/g" \
        -e "s/POSTGRES_USER=myapp/POSTGRES_USER=${NAME_SNAKE}/g" \
        -e "s/POSTGRES_PASSWORD=myapp/POSTGRES_PASSWORD=${NAME_SNAKE}/g" \
        -e "s/POSTGRES_DB=myapp/POSTGRES_DB=${NAME_SNAKE}/g" \
        -e "s/-U myapp -d myapp/-U ${NAME_SNAKE} -d ${NAME_SNAKE}/g" \
        -e "s/myapp:myapp@db/${NAME_SNAKE}:${NAME_SNAKE}@db/g" \
        -e "s/myapp/${NAME}/g" \
        "$f"
    echo "    $f"
done

if [ ! -f .env ]; then
    echo "==> .env を作成します"
    cp .env.example .env
else
    echo "==> .env は既に存在するためスキップします"
fi

echo ""
echo "完了しました。次のステップ:"
echo "  1. README.md をこのプロジェクトの説明に書き換える(テンプレの説明のため置換対象外)"
echo "  2. docs/spec/ に最初の機能の仕様を書く (docs/spec/README.md 参照)"
echo "  3. docker-compose up で起動確認"
echo "  4. このスクリプト (setup.sh) は削除してよい"
