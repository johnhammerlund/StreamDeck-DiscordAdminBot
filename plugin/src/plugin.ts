import streamDeck from "@elgato/streamdeck";
import { BotServerToggle } from "./actions/bot-server-toggle";
import { DeafenUser } from "./actions/deafen-user";
import { HangupUser } from "./actions/hangup-user";
import { MuteUser } from "./actions/mute-user";
import { SwitchProfile } from "./actions/switch-profile";
import { UserVolume } from "./actions/user-volume";
import { botClient } from "./bot-client";

streamDeck.actions.registerAction(new BotServerToggle());
streamDeck.actions.registerAction(new MuteUser());
streamDeck.actions.registerAction(new DeafenUser());
streamDeck.actions.registerAction(new HangupUser());
streamDeck.actions.registerAction(new UserVolume());
streamDeck.actions.registerAction(new SwitchProfile());

botClient.on("connected", () => streamDeck.logger.info("[bot-client] Connected to bot server"));
botClient.on("disconnected", () => streamDeck.logger.info("[bot-client] Disconnected from bot server"));

streamDeck.connect();
