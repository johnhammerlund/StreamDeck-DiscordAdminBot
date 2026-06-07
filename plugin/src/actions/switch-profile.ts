import streamDeck, { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";

interface SwitchProfileSettings {
  [key: string]: string | number | boolean | null;
  back: boolean;
}

@action({ UUID: "com.johnhammerlund.discordadminbot.switch-profile" })
export class SwitchProfile extends SingletonAction<SwitchProfileSettings> {
  override async onKeyDown(ev: KeyDownEvent<SwitchProfileSettings>): Promise<void> {
    if (ev.payload.settings.back) {
      await streamDeck.profiles.switchToProfile(ev.action.device.id);
    } else {
      await streamDeck.profiles.switchToProfile(ev.action.device.id, "Discord Voice");
    }
  }
}
