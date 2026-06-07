# Discord Admin Bot — Stream Deck Plugin

Physical admin controls for a Discord voice channel, powered by a local bot server and your Stream Deck.

## Actions

| Action | Type | What it does |
|--------|------|-------------|
| **Bot Server** | Key | Start / stop the local bot server. Green = running, gray = stopped. |
| **Mute User** | Key | Toggle server mute for a configured user. Icon reflects live mute state. |
| **Deafen User** | Key | Toggle server deafen for a configured user. |
| **Disconnect User** | Key | Kick a user out of their current voice channel. Icon reflects connection state. |
| **Voice Channel User** | SD+ Encoder | Shows one user slot from a voice channel. Press = mute, touch = deafen, long-touch = disconnect. |

> **Note on volume:** Discord's bot API does not support per-user volume adjustment (that's client-side only). The SD+ encoder dials are reserved for a future [Discord RPC](https://discord.com/developers/docs/topics/rpc) integration that could wire dial rotation to actual volume.

---

## Architecture

```
Stream Deck Plugin  ──WebSocket──►  Bot Server (local Node.js)
                    (port 57821)        │
                                        ├── discord.js (Bot API)
                                        └── Guild operations: mute/deafen/disconnect
```

The plugin bundles the bot server (`bin/bot-server.js`) and spawns it as a child process when you press the **Bot Server** action. Token and port are configured in the action's property inspector — no `.env` file needed.

---

## Setup

### 1. Create a Discord Application & Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Under **Bot**, click **Add Bot** and copy the **Token** (keep it secret)
3. Under **OAuth2 → URL Generator**, select scopes: `bot`
4. Bot permissions required:
   - `Mute Members`
   - `Deafen Members`
   - `Move Members`
5. Use the generated URL to invite the bot to your server

### 2. Enable Developer Mode in Discord

Settings → Advanced → **Developer Mode** ON

Right-click a server icon → **Copy Server ID** (Guild ID)  
Right-click a user → **Copy User ID**

### 3. Build the Plugin

Requires [Node.js 24+](https://nodejs.org/).

```bash
cd plugin
npm install
npm run build
```

This produces `plugin/com.johnhammerlund.discordadminbot.sdPlugin/bin/plugin.js` and `bin/bot-server.js`.

### 4. Install the Plugin

```bash
# Link for development (auto-reloads on rebuild)
streamdeck link plugin/com.johnhammerlund.discordadminbot.sdPlugin

# Or double-click the .sdPlugin folder in Finder
```

### 5. Configure Actions

1. Add a **Bot Server** action to a key
2. In the property inspector:
   - Paste your Discord **Bot Token**
   - Set the **WS Port** (default: 57821)
3. Press the key — the bot logs in and the key turns green
4. Add **Mute User / Deafen User / Disconnect User** actions and paste Guild ID + User ID
5. For SD+: add **Voice Channel User** to each encoder slot, configure Guild ID + Channel ID + Slot number

---

## Development

```bash
cd plugin
npm run watch   # rebuilds on save + restarts the plugin in Stream Deck
```

Bot server standalone (useful for debugging):
```bash
cd bot
npm install
cp .env.example .env   # fill in DISCORD_TOKEN
npm run build
npm start
```

---

## Project Structure

```
plugin/         Stream Deck plugin (TypeScript, @elgato/streamdeck SDK v2)
  src/
    plugin.ts               Entry point
    bot-client.ts           WebSocket client + voice state cache
    actions/
      bot-server-toggle.ts  Spawn/kill bot process
      mute-user.ts
      deafen-user.ts
      hangup-user.ts
      user-volume.ts        SD+ encoder action
  com.johnhammerlund.discordadminbot.sdPlugin/
    manifest.json
    imgs/                   SVG icons (replace with PNGs for production)
    ui/                     Property inspector HTML

bot/            Discord bot server (discord.js 14, standalone deployable)
  src/
    index.ts                Entry: starts bot + WS server
    discord-bot.ts          discord.js client + guild operations
    ws-server.ts            WebSocket server (plugin connects here)
    types.ts                Shared WS message protocol
    config.ts               Env-var loading
```

---

## WebSocket Protocol

Plugin → Bot (commands):
```json
{ "op": "subscribe",   "guildId": "...", "channelId": "..." }
{ "op": "mute",        "guildId": "...", "userId": "...", "mute": true }
{ "op": "deafen",      "guildId": "...", "userId": "...", "deafen": true }
{ "op": "disconnect",  "guildId": "...", "userId": "..." }
{ "op": "getMembers",  "guildId": "...", "channelId": "..." }
```

Bot → Plugin (events):
```json
{ "event": "ready",            "botTag": "MyBot#1234" }
{ "event": "memberList",       "guildId": "...", "channelId": "...", "members": [...] }
{ "event": "voiceStateUpdate", "guildId": "...", "userId": "...", "muted": false, "deafened": false, "channelId": "..." }
{ "event": "ack",              "op": "mute", "success": true }
```
