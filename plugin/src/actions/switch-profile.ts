import streamDeck, { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";

@action({ UUID: "com.johnhammerlund.discordadminbot.switch-profile" })
export class SwitchProfile extends SingletonAction {
  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    await streamDeck.profiles.switchToProfile(ev.action.device.id, "Discord Voice");
  }
}
