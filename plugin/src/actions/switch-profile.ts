import streamDeck, { action, KeyAction, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";

interface SwitchProfileSettings {
  [key: string]: string | number | boolean | null;
  profileName: string;
}

@action({ UUID: "com.johnhammerlund.discordadminbot.switch-profile" })
export class SwitchProfile extends SingletonAction<SwitchProfileSettings> {
  private instances = new Map<string, KeyAction>();

  override async onWillAppear(ev: WillAppearEvent<SwitchProfileSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    this.instances.set(ev.action.id, ev.action);
    const name = ev.payload.settings.profileName || "Discord Voice";
    await ev.action.setTitle(name);
  }

  override async onWillDisappear(ev: WillDisappearEvent<SwitchProfileSettings>): Promise<void> {
    this.instances.delete(ev.action.id);
  }

  override async onKeyDown(ev: KeyDownEvent<SwitchProfileSettings>): Promise<void> {
    const profileName = ev.payload.settings.profileName || "Discord Voice";
    await streamDeck.profiles.switchToProfile(ev.action.device.id, profileName);
  }
}
