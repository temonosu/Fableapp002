import type { SignalingConnection } from "./signaling";

// WebRTC DataChannel の確立(docs/spec/p2p-match/design.md)。
// SDP / ICE candidate はシグナリング WS 経由で交換し、確立後は P2P 直結

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export interface PeerHandlers {
  onOpen: () => void;
  onMessage: (text: string) => void;
  onClose: () => void;
}

export interface PeerConnection {
  send: (text: string) => void;
  close: () => void;
  /** シグナリング WS から受け取った SDP/ICE をここに流し込む */
  handleSignal: (data: Record<string, unknown>) => Promise<void>;
}

export function createPeer(
  isHost: boolean,
  signaling: SignalingConnection,
  handlers: PeerHandlers,
): PeerConnection {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  let channel: RTCDataChannel | null = null;

  const attachChannel = (ch: RTCDataChannel): void => {
    channel = ch;
    ch.onopen = () => handlers.onOpen();
    ch.onmessage = (event) => handlers.onMessage(String(event.data));
    ch.onclose = () => handlers.onClose();
  };

  pc.onicecandidate = (event) => {
    if (event.candidate !== null) {
      signaling.send({ kind: "ice", candidate: event.candidate.toJSON() });
    }
  };

  if (isHost) {
    attachChannel(pc.createDataChannel("game"));
  } else {
    pc.ondatachannel = (event) => attachChannel(event.channel);
  }

  const startOffer = async (): Promise<void> => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signaling.send({ kind: "offer", sdp: offer.sdp });
  };

  return {
    send: (text) => {
      if (channel !== null && channel.readyState === "open") channel.send(text);
    },
    close: () => {
      channel?.close();
      pc.close();
    },
    handleSignal: async (data) => {
      switch (data.kind) {
        case "peer-ready": // ゲスト入室 → ホストがオファーを送る
          if (isHost) await startOffer();
          break;
        case "offer":
          if (!isHost && typeof data.sdp === "string") {
            await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            signaling.send({ kind: "answer", sdp: answer.sdp });
          }
          break;
        case "answer":
          if (isHost && typeof data.sdp === "string") {
            await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
          }
          break;
        case "ice":
          if (typeof data.candidate === "object" && data.candidate !== null) {
            await pc.addIceCandidate(data.candidate as RTCIceCandidateInit);
          }
          break;
        default:
          break;
      }
    },
  };
}
