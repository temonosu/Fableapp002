import { buildWsUrl } from "../api/client";

// シグナリング WS クライアント。backend はメッセージを素通しで中継するだけなので、
// ここでは接続と JSON の送受信だけを扱う

export interface SignalingHandlers {
  onMessage: (data: Record<string, unknown>) => void;
  onClose: (code: number) => void;
}

export interface SignalingConnection {
  send: (data: Record<string, unknown>) => void;
  close: () => void;
}

export function connectSignaling(
  roomCode: string,
  handlers: SignalingHandlers,
): Promise<SignalingConnection> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(buildWsUrl(`rooms/${roomCode}/ws`));
    ws.onopen = () => {
      resolve({
        send: (data) => ws.send(JSON.stringify(data)),
        close: () => ws.close(),
      });
    };
    ws.onerror = () => reject(new Error("シグナリングサーバーに接続できない"));
    ws.onclose = (event) => handlers.onClose(event.code);
    ws.onmessage = (event) => {
      try {
        const parsed: unknown = JSON.parse(String(event.data));
        if (typeof parsed === "object" && parsed !== null) {
          handlers.onMessage(parsed as Record<string, unknown>);
        }
      } catch {
        // 不正な JSON は無視
      }
    };
  });
}
