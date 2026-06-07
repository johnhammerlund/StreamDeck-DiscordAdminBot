import { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { botClient } from "../bot-client";

interface BotServerSettings {
  [key: string]: string | number | boolean | null;
  port: number;
  token: string;
  botServerPath: string;
}

const STATE_STOPPED = 0;
const STATE_RUNNING = 1;

// bin/plugin.js lives in the same directory as bin/bot-server.js
const PLUGIN_BIN_DIR = path.dirname(path.resolve(process.argv[1] ?? "plugin.js"));

@action({ UUID: "com.johnhammerlund.discordadminbot.bot-server" })
export class BotServerToggle extends SingletonAction<BotServerSettings> {
  private botProcess: ChildProcess | null = null;
  private instances = new Map<string, KeyAction>();

  constructor() {
    super();

    botClient.on("connected", () => {
      for (const a of this.instances.values()) {
        a.setState(STATE_RUNNING);
        a.setTitle("Bot On");
      }
    });

    botClient.on("disconnected", () => {
      if (this.botProcess) return; // process still running; wait for exit event
      for (const a of this.instances.values()) {
        a.setState(STATE_STOPPED);
        a.setTitle("Bot Off");
      }
    });
  }

  override async onWillAppear(ev: WillAppearEvent<BotServerSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    this.instances.set(ev.action.id, ev.action);

    const port = Number(ev.payload.settings.port) || 57821;
    botClient.setPort(port);
    botClient.connect();

    await ev.action.setState(botClient.isConnected ? STATE_RUNNING : STATE_STOPPED);
    await ev.action.setTitle(botClient.isConnected ? "Bot On" : "Bot Off");
  }

  override async onWillDisappear(ev: WillDisappearEvent<BotServerSettings>): Promise<void> {
    this.instances.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<BotServerSettings>): Promise<void> {
    if (botClient.isConnected || this.botProcess) {
      await this.stopBot(ev.action);
    } else {
      await this.startBot(ev.action, ev.payload.settings);
    }
  }

  private async startBot(action: KeyAction, settings: BotServerSettings): Promise<void> {
    const token = settings.token;
    if (!token) {
      await action.setTitle("No token!");
      return;
    }

    const port = Number(settings.port) || 57821;
    await action.setTitle("Starting…");

    const serverPath = settings.botServerPath || path.join(PLUGIN_BIN_DIR, "bot-server.js");

    const child = spawn(process.execPath, [serverPath], {
      env: { ...process.env, DISCORD_TOKEN: token, WS_PORT: String(port) },
      stdio: "pipe",
      detached: false,
    });

    this.botProcess = child;
    child.stdout?.on("data", (d: Buffer) => process.stdout.write(d));
    child.stderr?.on("data", (d: Buffer) => process.stderr.write(d));

    child.on("error", async (err: Error) => {
      console.error("[bot-server-toggle] Failed to start bot:", err.message);
      this.botProcess = null;
      await action.setState(STATE_STOPPED);
      await action.setTitle("Start failed");
    });

    child.on("exit", (code: number | null) => {
      console.log(`[bot-server-toggle] Bot exited with code ${code}`);
      this.botProcess = null;
      action.setState(STATE_STOPPED);
      action.setTitle("Bot Off");
    });

    botClient.setPort(port);
    botClient.connect();
  }

  private async stopBot(action: KeyAction): Promise<void> {
    botClient.disconnect();
    if (this.botProcess) {
      this.botProcess.kill("SIGTERM");
      this.botProcess = null;
    }
    await action.setState(STATE_STOPPED);
    await action.setTitle("Bot Off");
  }
}
