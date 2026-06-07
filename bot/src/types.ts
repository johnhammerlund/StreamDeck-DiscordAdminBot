export interface VoiceMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
  selfMuted: boolean;
  selfDeafened: boolean;
  channelId: string;
}

// Commands sent from the plugin to the bot server
export type PluginCommand =
  | { op: "subscribe"; guildId: string; channelId: string }
  | { op: "unsubscribe"; guildId: string; channelId: string }
  | { op: "mute"; guildId: string; userId: string; mute: boolean }
  | { op: "deafen"; guildId: string; userId: string; deafen: boolean }
  | { op: "disconnect"; guildId: string; userId: string }
  | { op: "getMembers"; guildId: string; channelId: string };

// Events sent from the bot server to the plugin
export type BotEvent =
  | { event: "ready"; botTag: string }
  | { event: "memberList"; guildId: string; channelId: string; members: VoiceMember[] }
  | { event: "voiceStateUpdate"; guildId: string; userId: string; username: string; displayName: string; avatarUrl: string | null; muted: boolean; deafened: boolean; selfMuted: boolean; selfDeafened: boolean; channelId: string | null }
  | { event: "ack"; op: string; success: boolean; error?: string }
  | { event: "error"; code: string; message: string };
