# CLAUDE.md — StreamDeck-DiscordAdminBot

Context for AI-assisted development on this project.

---

## What this plugin does

A Stream Deck plugin that gives a Discord server admin physical control over voice channels. A local Discord bot (bundled inside the plugin) connects to the server via discord.js. The plugin communicates with the bot over a localhost WebSocket.

**Actions available:**
- **Bot Server** — starts/stops the bot child process; configures the Discord token, guild ID, and WS port
- **Mute User** — toggle server-mute for a specific user (by User ID)
- **Deafen User** — toggle server-deafen for a specific user
- **Disconnect User** — force-disconnect a user from their voice channel
- **Voice Channel User** (SD+ encoder) — shows a voice channel slot on the touch strip; dial press = mute, touch = deafen, long touch = disconnect
- **Switch Profile** — switches to the bundled "Discord Voice" profile (or back to the previous profile when `settings.back === true`)

**Bundled profile "Discord Voice"** (SD+ only, DeviceType 7):
- `0,0` — Switch Profile (back button)
- `1,0` — Mute Me
- `2,0` — Deafen Me
- `0,2`–`3,2` — Voice Channel User encoders, slots 1–4

---

## Repository layout

```
StreamDeck-DiscordAdminBot/
├── Makefile                   # build + package for release
├── bot/src/                   # Discord bot (TypeScript)
│   ├── index.ts               # entry point
│   ├── config.ts              # reads DISCORD_TOKEN + WS_PORT from process.env
│   ├── discord-bot.ts         # discord.js client, voice state operations
│   ├── ws-server.ts           # WebSocket server the plugin connects to
│   └── types.ts               # shared WS message protocol
└── plugin/                    # Stream Deck plugin (TypeScript, SDK v2)
    ├── rollup.config.mjs      # two-entry-point build
    ├── tsconfig.json          # plugin + bot source included
    ├── tsconfig.bot-bundle.json
    ├── src/
    │   ├── plugin.ts          # registers actions, inits global settings
    │   ├── bot-client.ts      # singleton WS client with reconnect loop
    │   ├── global-settings.ts # cache for global settings (guildId)
    │   ├── types.ts
    │   └── actions/
    │       ├── bot-server-toggle.ts
    │       ├── mute-user.ts
    │       ├── deafen-user.ts
    │       ├── hangup-user.ts
    │       ├── user-volume.ts
    │       └── switch-profile.ts
    └── com.johnhammerlund.discordadminbot.sdPlugin/
        ├── manifest.json
        ├── bin/               # rollup output (gitignored)
        ├── imgs/              # SVG icons (actions + states)
        ├── profiles/
        │   └── Discord Voice.sdProfile
        └── ui/                # property inspector HTML (one per action)
```

---

## Build

```bash
# From repo root:
make build
# Produces:
#   dist/com.johnhammerlund.discordadminbot.streamDeckPlugin  ← double-click to install
#   dist/com.johnhammerlund.discordadminbot.zip               ← GitHub Release upload
#     (the .zip wraps the .streamDeckPlugin, not the raw folder)

# Plugin-only rebuild (faster during dev):
cd plugin
node ./node_modules/.bin/rollup -c --bundleConfigAsCjs
# node is at ~/.nvm/versions/node/v24.16.0/bin/node on this machine
# npm/npx are not on PATH without sourcing nvm — use the node binary directly
```

The build produces two bundles:
- `bin/plugin.js` — the Stream Deck action code
- `bin/bot-server.js` — the Discord bot, spawned as a child process at runtime

---

## Stream Deck SDK v2 essentials

**Runtime:** Node.js 24 managed by Stream Deck (declared in `manifest.json` → `"Nodejs": { "Version": "24" }`). Stream Deck ships its own Node.js; `process.execPath` inside the plugin points to it.

**Action pattern:**
```typescript
import { action, SingletonAction, KeyDownEvent } from "@elgato/streamdeck";

interface MySettings {
  [key: string]: string | number | boolean | null; // required index signature
  someField: string;
}

@action({ UUID: "com.example.plugin.my-action" })
export class MyAction extends SingletonAction<MySettings> {
  override async onKeyDown(ev: KeyDownEvent<MySettings>): Promise<void> { ... }
}
```

**Settings must satisfy `JsonObject`** — the index signature `[key: string]: string | number | boolean | null` is required on every settings interface or TypeScript will reject it.

**Controller type guards:** `ev.action.isKey()` and `ev.action.isDial()` narrow the action type before calling key-only or encoder-only methods.

**SD+ encoder feedback** (`$B1` layout — title + value + indicator bar):
```typescript
encoder.setFeedback({ title: "Name", value: "● Live", indicator: 100 });
```
Layout `$B1` exposes `title`, `value`, and `indicator`. Layout `$A1` omits `value`.

**Profile switching:**
```typescript
// Switch to a bundled profile by name:
await streamDeck.profiles.switchToProfile(deviceId, "Discord Voice");
// Return to previous profile (no second arg):
await streamDeck.profiles.switchToProfile(deviceId);
```
Plugins can only switch to profiles declared in `manifest.json` → `"Profiles"[]`. They cannot access user-created profiles.

**Global settings** (shared across all action instances):
```typescript
streamDeck.settings.getGlobalSettings<GlobalSettings>();
streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
  // ev.settings has the global values
});
```
Call `getGlobalSettings()` at startup to trigger the first `onDidReceiveGlobalSettings` callback.

**Log file locations:**
- macOS: `~/Library/Application Support/com.elgato.StreamDeck/logs/`
- Windows: `%APPDATA%\Elgato\StreamDeck\logs\`
- File: `com.johnhammerlund.discordadminbot0.log`

---

## Property Inspector (PI) — critical gotchas

**Always use `sdpi-components.js`.** Do NOT implement the WebSocket connection manually.

```html
<script src="https://sdpi-components.dev/releases/v4/sdpi-components.js"></script>
```

This library handles `connectElgatoStreamDeckSocket` (the function Stream Deck calls to hand off the WebSocket connection), settings persistence via `setSettings`/`didReceiveSettings`, and consistent styling. The old manual approach with `connectElgato(lang, port, ...)` is wrong — the function signature changed in SDK v2 and the old form is never called.

**Available components:** `<sdpi-textfield>`, `<sdpi-select>`, `<sdpi-range>`, `<sdpi-checkbox>`, `<sdpi-password>`, etc. Settings bind automatically via the `setting` attribute:
```html
<sdpi-item label="User ID">
  <sdpi-textfield setting="userId" placeholder="Right-click user → Copy User ID"></sdpi-textfield>
</sdpi-item>
```

**Global settings in the PI** — add the `global` attribute to share a value across all action instances:
```html
<sdpi-textfield setting="guildId" global placeholder="..."></sdpi-textfield>
```
Global fields are stored via `setGlobalSettings`, not `setSettings`. The plugin side reads them via `onDidReceiveGlobalSettings`. Currently `guildId` is the only global setting; it's set once in the Bot Server PI and shared with all other actions.

**`type="password"` is broken on Windows.** `sdpi-textfield` with `type="password"` routes storage through the Windows Credential Manager (CredRead/CredWrite). On Windows, CredRead returns error 1168 (not found) when reading it back, so the token arrives as empty string in the plugin. **Do not use `type="password"`** — leave it as plain text. The bot token field in `bot-server-toggle.html` deliberately omits `type="password"` for this reason.

**sdpi-components stores all values as strings**, even for number-type fields. Parse defensively: `Number(settings.port) || 57821`, `Number(settings.slot) || 1`.

---

## Bot architecture

The Discord bot runs as a **child process** spawned by the `BotServerToggle` action:
```typescript
spawn(process.execPath, [serverPath], {
  env: { ...process.env, DISCORD_TOKEN: token, WS_PORT: String(port) },
  stdio: "pipe",
});
```

`process.execPath` is the Stream Deck–managed Node.js binary. `serverPath` defaults to `path.join(PLUGIN_BIN_DIR, "bot-server.js")` where `PLUGIN_BIN_DIR = path.dirname(path.resolve(process.argv[1]))`.

The bot reads config **only from `process.env`** — no `.env` file. `config.ts` throws if `DISCORD_TOKEN` is missing.

**WS protocol** (plugin → bot commands):
```
{ op: "subscribe",   guildId, channelId }
{ op: "unsubscribe", guildId, channelId }
{ op: "mute",        guildId, userId, mute: boolean }
{ op: "deafen",      guildId, userId, deafen: boolean }
{ op: "disconnect",  guildId, userId }
{ op: "getMembers",  guildId, channelId }
```

**WS protocol** (bot → plugin events):
```
{ event: "ready",            botTag }
{ event: "memberList",       guildId, channelId, members: VoiceMember[] }
{ event: "voiceStateUpdate", guildId, userId, displayName, muted, deafened, ... }
{ event: "ack",              op, success, error? }
```

`botClient.ts` maintains an exponential-backoff reconnect loop (1→2→4→8→16s) and two caches: `voiceStateCache` (userId → VoiceMember) and `channelMemberCache` (channelId → VoiceMember[]). The "disconnected" log event only fires on a genuine connected→disconnected transition to avoid flooding the log with reconnect noise.

**Bot intents required:** `Guilds`, `GuildVoiceStates`, `GuildMembers`. All three must be enabled in the Discord Developer Portal for the bot application.

---

## Rollup build — two entry points

The bot has no `node_modules` of its own; it relies on `plugin/node_modules`. The bot bundle's `nodeResolve` plugin needs `modulePaths: [path.resolve(__dirname, "node_modules")]` to find discord.js and ws:

```js
// rollup.config.mjs (bot bundle section)
nodeResolve({
  preferBuiltins: true, browser: false,
  extensions: [".ts", ".js", ".json"],
  modulePaths: [pluginNodeModules],  // ← critical for discord.js resolution
})
```

Node built-ins and optional native discord.js addons (`@discordjs/opus`, `bufferutil`, `sodium`, etc.) are in the `external` list so they're not bundled. The optional native addons are never needed for bot API usage.

`tsconfig.bot-bundle.json` configures TypeScript to find types for the bot's npm deps from `plugin/node_modules` instead of the (nonexistent) `bot/node_modules`.

---

## Bundled profile format (SD+)

Profile file: `sdPlugin/profiles/Discord Voice.sdProfile`

Must also be declared in `manifest.json`:
```json
"Profiles": [{
  "Name": "Discord Voice",
  "DeviceType": 7,
  "DontAutoSwitchWhenInstalled": true,
  "Readonly": false
}]
```

**DeviceType 7 = Stream Deck+.** Position format is `"col,row"`:
- Rows 0–1, columns 0–3: the 8 key buttons
- Row 2, columns 0–3: the 4 encoders/dials

```json
{
  "DeviceType": 7,
  "Name": "Discord Voice",
  "Pages": {
    "0": {
      "Actions": {
        "0,0": { "UUID": "...", "Settings": {}, "State": 0 }
      }
    }
  }
}
```

---

## Settings architecture

| Setting | Scope | Where set |
|---|---|---|
| `guildId` | **Global** (shared) | Bot Server PI (`global` attribute) |
| `token` | Bot Server action only | Bot Server PI |
| `port` | Bot Server action only | Bot Server PI |
| `userId` | Per-action | Mute / Deafen / Disconnect PIs |
| `channelId` | Per-action | Voice Channel User PI |
| `slot` | Per-action | Voice Channel User PI |
| `label` | Per-action | Mute / Deafen / Disconnect PIs |
| `back` | Hardcoded in profile JSON | Switch Profile action |

Actions read `guildId` from `globalSettings` (imported from `global-settings.ts`), not from `ev.payload.settings`.

---

## Versioning

The user controls all version tags. Never auto-tag. Commit freely; only tag when explicitly told `tag vX.Y.Z`.
