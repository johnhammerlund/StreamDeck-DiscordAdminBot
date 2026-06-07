import { config } from "./config.js";
import { DiscordBot } from "./discord-bot.js";
import { WsServer } from "./ws-server.js";

const bot = new DiscordBot(config.token);
new WsServer(bot, config.wsPort);
