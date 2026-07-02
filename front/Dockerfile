# 開発用イメージ (Vite dev server)
# 本番用のマルチステージビルドは必要になったら追加する
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
