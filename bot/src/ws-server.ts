import { WebSocketServer, WebSocket } from "ws";
import type { DiscordBot } from "./discord-bot.js";
import type { BotEvent, PluginCommand, VoiceMember } from "./types.js";

interface Subscription {
  guildId: string;
  channelId: string;
}

export class WsServer {
  private wss: WebSocketServer;
  private subscriptions = new Map<WebSocket, Subscription[]>();

  constructor(private bot: DiscordBot, port: number) {
    this.wss = new WebSocketServer({ port });

    this.wss.on("listening", () => {
      console.log(`[ws] Listening on port ${port}`);
    });

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("[ws] Plugin connected");
      this.subscriptions.set(ws, []);

      ws.on("message", (raw: Buffer | string) => this.handleCommand(ws, raw.toString()));
      ws.on("close", () => {
        this.subscriptions.delete(ws);
        console.log("[ws] Plugin disconnected");
      });
      ws.on("error", (err: Error) => console.error("[ws] Client error:", err));
    });

    // Forward voice state updates to subscribed clients
    bot.on("voiceStateUpdate", (guildId: string, member: VoiceMember, oldChannelId: string | null) => {
      const event: BotEvent = {
        event: "voiceStateUpdate",
        guildId,
        userId: member.userId,
        username: member.username,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        muted: member.muted,
        deafened: member.deafened,
        selfMuted: member.selfMuted,
        selfDeafened: member.selfDeafened,
        channelId: member.channelId || null,
      };

      // Channels affected: the new channel and the channel they left
      const affectedChannels = new Set<string>();
      if (member.channelId) affectedChannels.add(member.channelId);
      if (oldChannelId) affectedChannels.add(oldChannelId);

      for (const [ws, subs] of this.subscriptions) {
        const relevant = subs.some(
          (s) => s.guildId === guildId && affectedChannels.has(s.channelId)
        );
        if (!relevant || ws.readyState !== WebSocket.OPEN) continue;

        this.send(ws, event);

        // Also push a fresh member list for each affected subscribed channel
        // so slot-based displays stay in sync when users join/leave
        for (const sub of subs) {
          if (sub.guildId === guildId && affectedChannels.has(sub.channelId)) {
            this.pushMemberList(ws, sub.guildId, sub.channelId);
          }
        }
      }
    });

    bot.on("ready", (botTag: string) => {
      this.broadcast({ event: "ready", botTag });
    });
  }

  private handleCommand(ws: WebSocket, raw: string): void {
    let cmd: PluginCommand;
    try {
      cmd = JSON.parse(raw) as PluginCommand;
    } catch {
      this.send(ws, { event: "error", code: "PARSE_ERROR", message: "Invalid JSON" });
      return;
    }

    switch (cmd.op) {
      case "subscribe":
        this.handleSubscribe(ws, cmd.guildId, cmd.channelId);
        break;
      case "unsubscribe":
        this.handleUnsubscribe(ws, cmd.guildId, cmd.channelId);
        break;
      case "getMembers":
        this.pushMemberList(ws, cmd.guildId, cmd.channelId);
        break;
      case "mute":
        this.bot
          .serverMute(cmd.guildId, cmd.userId, cmd.mute)
          .then(() => this.send(ws, { event: "ack", op: "mute", success: true }))
          .catch((e) => this.send(ws, { event: "ack", op: "mute", success: false, error: String(e) }));
        break;
      case "deafen":
        this.bot
          .serverDeafen(cmd.guildId, cmd.userId, cmd.deafen)
          .then(() => this.send(ws, { event: "ack", op: "deafen", success: true }))
          .catch((e) => this.send(ws, { event: "ack", op: "deafen", success: false, error: String(e) }));
        break;
      case "disconnect":
        this.bot
          .disconnectUser(cmd.guildId, cmd.userId)
          .then(() => this.send(ws, { event: "ack", op: "disconnect", success: true }))
          .catch((e) => this.send(ws, { event: "ack", op: "disconnect", success: false, error: String(e) }));
        break;
      default:
        this.send(ws, { event: "error", code: "UNKNOWN_OP", message: `Unknown op: ${(cmd as PluginCommand).op}` });
    }
  }

  private handleSubscribe(ws: WebSocket, guildId: string, channelId: string): void {
    const subs = this.subscriptions.get(ws) ?? [];
    if (!subs.some((s) => s.guildId === guildId && s.channelId === channelId)) {
      subs.push({ guildId, channelId });
      this.subscriptions.set(ws, subs);
    }
    this.pushMemberList(ws, guildId, channelId);
  }

  private handleUnsubscribe(ws: WebSocket, guildId: string, channelId: string): void {
    const subs = this.subscriptions.get(ws) ?? [];
    this.subscriptions.set(
      ws,
      subs.filter((s) => !(s.guildId === guildId && s.channelId === channelId))
    );
  }

  private pushMemberList(ws: WebSocket, guildId: string, channelId: string): void {
    const members = this.bot.getVoiceChannelMembers(guildId, channelId);
    this.send(ws, { event: "memberList", guildId, channelId, members });
  }

  private send(ws: WebSocket, event: BotEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  private broadcast(event: BotEvent): void {
    const payload = JSON.stringify(event);
    for (const ws of this.wss.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

}
