function require(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

export const config = {
  token: require("DISCORD_TOKEN"),
  wsPort: parseInt(process.env["WS_PORT"] ?? "57821", 10),
} as const;
