import { EventEmitter } from "events";
import WebSocket from "ws";
import type { BotEvent, PluginCommand, VoiceMember } from "./types";

const RECONNECT_DELAY_MS = [1000, 2000, 4000, 8000, 16000];

class BotClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private port = 57821;
  private attemptIndex = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  /** Last-known voice state per userId */
  readonly voiceStateCache = new Map<string, VoiceMember>();

  /** Latest ordered member list per channelId */
  readonly channelMemberCache = new Map<string, VoiceMember[]>();

  get isConnected(): boolean {
    return this._connected;
  }

  setPort(port: number): void {
    this.port = port;
  }

  connect(): void {
    if (this.ws) return;
    this._tryConnect();
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this._connected = false;
  }

  send(cmd: PluginCommand): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(cmd));
    }
  }

  private _tryConnect(): void {
    const ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
    this.ws = ws;

    ws.on("open", () => {
      this.attemptIndex = 0;
      this._connected = true;
      this.emit("connected");
    });

    ws.on("message", (raw) => {
      let evt: BotEvent;
      try {
        evt = JSON.parse(raw.toString()) as BotEvent;
      } catch {
        return;
      }
      this._handleEvent(evt);
    });

    ws.on("close", () => {
      this._connected = false;
      this.ws = null;
      this.emit("disconnected");
      this._scheduleReconnect();
    });

    ws.on("error", () => {
      // close fires after error, so reconnect happens there
    });
  }

  private _handleEvent(evt: BotEvent): void {
    this.emit("event", evt);

    if (evt.event === "voiceStateUpdate") {
      if (evt.channelId) {
        this.voiceStateCache.set(evt.userId, {
          userId: evt.userId,
          username: evt.username,
          displayName: evt.displayName,
          avatarUrl: evt.avatarUrl,
          muted: evt.muted,
          deafened: evt.deafened,
          selfMuted: evt.selfMuted,
          selfDeafened: evt.selfDeafened,
          channelId: evt.channelId,
        });
      } else {
        this.voiceStateCache.delete(evt.userId);
      }
      this.emit("voiceStateUpdate", evt);
    }

    if (evt.event === "memberList") {
      this.channelMemberCache.set(evt.channelId, evt.members);
      for (const m of evt.members) this.voiceStateCache.set(m.userId, m);
      this.emit("memberList", evt);
    }

    if (evt.event === "ready") {
      this.emit("ready", evt.botTag);
    }
  }

  private _scheduleReconnect(): void {
    const delay = RECONNECT_DELAY_MS[Math.min(this.attemptIndex, RECONNECT_DELAY_MS.length - 1)];
    this.attemptIndex++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._tryConnect();
    }, delay);
  }
}

export const botClient = new BotClient();
