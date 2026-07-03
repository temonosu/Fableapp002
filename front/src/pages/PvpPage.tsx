import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api/client";
import { TableBoard, describeEvents } from "../components/TableBoard";
import { chooseAiAction } from "../game/ai";
import { PVP_MAX_GAMES, applyPvpAction, createPvpMatch } from "../game/pvp";
import type { PvpAction, PvpState } from "../game/pvp";
import type { Action, GameEvent, PlayerId } from "../game/types";
import { decodeMessage, encodeMessage } from "../net/protocol";
import { createPeer } from "../net/rtc";
import type { PeerConnection } from "../net/rtc";
import { computeMatchSeed, makeCommitment, verifyReveal } from "../net/seed";
import type { SeedCommitment } from "../net/seed";
import { connectSignaling } from "../net/signaling";
import type { SignalingConnection } from "../net/signaling";

// P2P 対戦(docs/spec/p2p-match)。ホスト=A / ゲスト=B。
// シグナリング → WebRTC → コミット&リビール → PvpAction のロックステップ同期

type Phase = "entry" | "waitingPeer" | "connecting" | "playing" | "error";

const BASE_SECONDS = 10; // 1手の基本持ち時間
const DECISION_BONUS = 10; // こいこい判断の追加秒
const BANK_SECONDS = 45; // 予備時間

export function PvpPage() {
  const [phase, setPhase] = useState<Phase>("entry");
  const [roomCode, setRoomCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [self, setSelf] = useState<PlayerId | null>(null);
  const [pvp, setPvp] = useState<PvpState | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const phaseRef = useRef<Phase>("entry");
  const signalingRef = useRef<SignalingConnection | null>(null);
  const peerRef = useRef<PeerConnection | null>(null);
  const isHostRef = useRef(false);
  const myCommitRef = useRef<SeedCommitment | null>(null);
  const theirCommitRef = useRef<string | null>(null);
  const revealSentRef = useRef(false);
  const theirSeedRef = useRef<number | null>(null);
  const seqOutRef = useRef(0);
  const seqInRef = useRef(0);
  const pvpRef = useRef<PvpState | null>(null);
  const bankRef = useRef(BANK_SECONDS);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const failMatch = useCallback(
    (message: string) => {
      setErrorMessage(message);
      changePhase("error");
    },
    [changePhase],
  );

  const names = useCallback((): Record<PlayerId, string> => {
    const me: PlayerId = isHostRef.current ? "A" : "B";
    return { A: me === "A" ? "あなた" : "相手", B: me === "B" ? "あなた" : "相手" };
  }, []);

  const commitState = useCallback(
    (state: PvpState, events: GameEvent[]) => {
      pvpRef.current = state;
      setPvp(state);
      const lines = describeEvents(state.table, events, names());
      if (lines.length > 0) setLog((prev) => [...prev, ...lines].slice(-6));
    },
    [names],
  );

  const dispatchLocal = useCallback(
    (action: PvpAction) => {
      const current = pvpRef.current;
      if (current === null) return;
      const result = applyPvpAction(current, action);
      if (!result.ok) return;
      peerRef.current?.send(encodeMessage({ v: 1, t: "pvp", seq: seqOutRef.current, action }));
      seqOutRef.current += 1;
      commitState(result.state, result.events);
    },
    [commitState],
  );
  const dispatchLocalRef = useRef(dispatchLocal);
  dispatchLocalRef.current = dispatchLocal;

  const maybeStartMatch = useCallback(() => {
    const mine = myCommitRef.current;
    const theirs = theirSeedRef.current;
    if (mine === null || theirs === null || !revealSentRef.current) return;
    if (pvpRef.current !== null) return;
    const hostSeed = isHostRef.current ? mine.seed : theirs;
    const guestSeed = isHostRef.current ? theirs : mine.seed;
    const match = createPvpMatch(computeMatchSeed(hostSeed, guestSeed));
    pvpRef.current = match;
    setPvp(match);
    setLog(["対戦開始! 1局目(レート1文)"]);
    changePhase("playing");
  }, [changePhase]);

  const maybeReveal = useCallback(() => {
    const mine = myCommitRef.current;
    if (mine === null || theirCommitRef.current === null || revealSentRef.current) return;
    revealSentRef.current = true;
    peerRef.current?.send(encodeMessage({ v: 1, t: "reveal", seed: mine.seed, nonce: mine.nonce }));
    maybeStartMatch();
  }, [maybeStartMatch]);

  const onNetMessage = useCallback(
    (text: string) => {
      const message = decodeMessage(text);
      if (message === null) {
        failMatch("不正なメッセージを受信したため対局を中断した");
        return;
      }
      switch (message.t) {
        case "commit":
          theirCommitRef.current = message.hash;
          maybeReveal();
          break;
        case "reveal":
          void (async () => {
            const hash = theirCommitRef.current;
            if (hash === null || !(await verifyReveal(hash, message.seed, message.nonce))) {
              failMatch("相手のシード検証に失敗した(山札の仕込みの疑い)");
              return;
            }
            theirSeedRef.current = message.seed;
            maybeStartMatch();
          })();
          break;
        case "pvp": {
          if (message.seq !== seqInRef.current) {
            failMatch("同期ずれを検出したため対局を中断した");
            return;
          }
          seqInRef.current += 1;
          const current = pvpRef.current;
          if (current === null) return;
          const result = applyPvpAction(current, message.action);
          if (!result.ok) {
            failMatch(`相手の不正な操作を拒否した: ${result.reason}`);
            return;
          }
          commitState(result.state, result.events);
          break;
        }
        case "bye":
          failMatch("相手が退出した");
          break;
      }
    },
    [commitState, failMatch, maybeReveal, maybeStartMatch],
  );

  const openRoom = useCallback(
    async (code: string, isHost: boolean) => {
      isHostRef.current = isHost;
      setSelf(isHost ? "A" : "B");
      try {
        const signaling = await connectSignaling(code, {
          onMessage: (data) => {
            if (data.type === "peer-joined") {
              changePhase("connecting");
              void peerRef.current?.handleSignal({ kind: "peer-ready" });
              return;
            }
            if (data.type === "peer-left") {
              if (phaseRef.current === "playing") failMatch("相手との接続が切れた");
              return;
            }
            void peerRef.current?.handleSignal(data);
          },
          onClose: (closeCode) => {
            if (closeCode === 4404) failMatch("ルームが見つからない(コードを確認)");
            else if (closeCode === 4403) failMatch("ルームは満室");
            else if (phaseRef.current === "waitingPeer" || phaseRef.current === "connecting") {
              failMatch("シグナリングサーバーとの接続が切れた");
            }
          },
        });
        signalingRef.current = signaling;
        peerRef.current = createPeer(isHost, signaling, {
          onOpen: () => {
            void (async () => {
              myCommitRef.current = await makeCommitment();
              peerRef.current?.send(
                encodeMessage({ v: 1, t: "commit", hash: myCommitRef.current.hash }),
              );
              maybeReveal();
            })();
          },
          onMessage: onNetMessage,
          onClose: () => {
            if (phaseRef.current === "playing" && pvpRef.current?.result == null) {
              failMatch("相手との接続が切れた");
            }
          },
        });
        changePhase(isHost ? "waitingPeer" : "connecting");
      } catch {
        failMatch("シグナリングサーバーに接続できない(backend は起動している?)");
      }
    },
    [changePhase, failMatch, maybeReveal, onNetMessage],
  );

  const createRoom = useCallback(async () => {
    try {
      const room = await apiPost<{ code: string }>("rooms");
      setRoomCode(room.code);
      await openRoom(room.code, true);
    } catch {
      failMatch("ルームを作成できない(backend は起動している?)");
    }
  }, [failMatch, openRoom]);

  const joinRoom = useCallback(async () => {
    const code = joinInput.trim().toUpperCase();
    if (code.length === 0) return;
    setRoomCode(code);
    await openRoom(code, false);
  }, [joinInput, openRoom]);

  // 離脱時のクリーンアップ
  useEffect(() => {
    return () => {
      peerRef.current?.send(encodeMessage({ v: 1, t: "bye" }));
      peerRef.current?.close();
      signalingRef.current?.close();
    };
  }, []);

  // 持ち時間: 自分の手番で自走し、切れたら安全手(AI の手)を自動で打つ
  useEffect(() => {
    if (pvp === null || pvp.result !== null || self === null) {
      setSecondsLeft(null);
      return;
    }
    const round = pvp.table.round;
    if (round === null || round.turn !== self || round.phase === "roundOver") {
      setSecondsLeft(null);
      return;
    }
    const base = round.phase === "awaitDecision" ? BASE_SECONDS + DECISION_BONUS : BASE_SECONDS;
    const total = base + bankRef.current;
    const started = Date.now();
    setSecondsLeft(total);
    const timer = setInterval(() => {
      const left = total - Math.floor((Date.now() - started) / 1000);
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        bankRef.current = 0;
        const auto = chooseAiAction(pvp.table, self, { aggression: 0.2 });
        if (auto !== null) dispatchLocalRef.current({ type: "table", action: auto });
      }
    }, 500);
    return () => {
      clearInterval(timer);
      const elapsed = Math.floor((Date.now() - started) / 1000);
      if (elapsed > base) bankRef.current = Math.max(0, bankRef.current - (elapsed - base));
    };
  }, [pvp, self]);

  const round = pvp?.table.round ?? null;
  const isHost = isHostRef.current;

  return (
    <main className="mx-auto max-w-[640px] p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between text-xs">
        <Link to="/" className="py-2 text-neutral-500">
          ← 帰る
        </Link>
        {pvp !== null && (
          <span className="text-neutral-600">
            {pvp.gameIndex}局目/{PVP_MAX_GAMES} / レート{pvp.table.config.rate}文
            {secondsLeft !== null && (
              <span className={`ml-2 font-bold ${secondsLeft <= 5 ? "text-red-600" : ""}`}>
                ⏱ {secondsLeft}s
              </span>
            )}
          </span>
        )}
      </header>

      {phase === "entry" && (
        <div className="mt-4 space-y-4">
          <h1 className="text-xl font-bold">P2P 対戦(素のこいこい)</h1>
          <p className="text-sm text-neutral-600">
            両者30文・レートは局ごとに上がる。相手を飛ばすか、5局終了時に残文が多い方の勝ち。
          </p>
          <button
            type="button"
            onClick={() => void createRoom()}
            className="w-full rounded bg-rose-700 py-3 font-bold text-white active:bg-rose-800"
          >
            ルームを作る(ホスト)
          </button>
          <div className="flex gap-2">
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="ルームコード"
              maxLength={5}
              className="min-w-0 flex-1 rounded border border-neutral-400 px-3 py-3 uppercase"
            />
            <button
              type="button"
              onClick={() => void joinRoom()}
              className="rounded bg-neutral-800 px-4 py-3 font-bold text-white active:bg-neutral-900"
            >
              参加
            </button>
          </div>
        </div>
      )}

      {(phase === "waitingPeer" || phase === "connecting") && (
        <div className="mt-8 text-center">
          <p className="text-sm text-neutral-500">ルームコード</p>
          <p className="text-4xl font-bold tracking-widest">{roomCode}</p>
          <p className="mt-4 animate-pulse text-sm text-neutral-600">
            {phase === "waitingPeer" ? "相手の参加を待っています…" : "P2P 接続中…"}
          </p>
        </div>
      )}

      {phase === "playing" && pvp !== null && self !== null && (
        <>
          <TableBoard
            table={pvp.table}
            self={self}
            opponentName="相手"
            onAction={(action: Action) => dispatchLocal({ type: "table", action })}
            log={log}
          />
          {round?.phase === "roundOver" && pvp.result === null && (
            <div className="mt-3">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => dispatchLocal({ type: "nextGame" })}
                  className="w-full rounded bg-emerald-600 py-3 font-bold text-white active:bg-emerald-700"
                >
                  {pvp.gameIndex >= PVP_MAX_GAMES ? "決着へ" : "次の局へ"}
                </button>
              ) : (
                <p className="animate-pulse text-center text-sm text-neutral-600">
                  ホストの進行を待っています…
                </p>
              )}
            </div>
          )}
          {pvp.result !== null && (
            <div className="mt-3 rounded bg-neutral-800 p-4 text-center text-white">
              <p className="text-lg font-bold">
                {pvp.result.winner === null
                  ? "引き分け"
                  : pvp.result.winner === self
                    ? "勝ち!"
                    : "負け…"}
                ({pvp.result.kind === "bust" ? "飛ばし" : "残文勝負"})
              </p>
              <p className="mt-1 text-sm">
                あなた {pvp.table.chips[self]}文 / 相手 {pvp.table.chips[self === "A" ? "B" : "A"]}
                文
              </p>
              <Link
                to="/"
                className="mt-3 block w-full rounded bg-white py-3 font-bold text-neutral-900 active:bg-neutral-200"
              >
                退出する
              </Link>
            </div>
          )}
        </>
      )}

      {phase === "error" && (
        <div className="mt-8 rounded border border-red-300 bg-red-50 p-4 text-center">
          <p className="font-semibold text-red-700">{errorMessage}</p>
          <Link
            to="/pvp"
            reloadDocument
            className="mt-3 block w-full rounded bg-neutral-800 py-3 font-bold text-white active:bg-neutral-900"
          >
            入口に戻る
          </Link>
        </div>
      )}
    </main>
  );
}
