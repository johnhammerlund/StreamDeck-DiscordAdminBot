import streamDeck from "@elgato/streamdeck";

export interface GlobalSettings {
  [key: string]: string | number | boolean | null;
  guildId: string;
}

export const globalSettings: GlobalSettings = { guildId: "" };

export function initGlobalSettings(): void {
  streamDeck.settings.getGlobalSettings<GlobalSettings>();
  streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
    Object.assign(globalSettings, ev.settings);
  });
}
