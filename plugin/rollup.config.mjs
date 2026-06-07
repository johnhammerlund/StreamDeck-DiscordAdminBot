import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Node.js built-ins and optional native Discord.js deps we never want bundled
const external = [
  "assert", "buffer", "child_process", "crypto", "dns", "events", "fs",
  "http", "https", "net", "os", "path", "readline", "stream", "tls",
  "url", "util", "v8", "worker_threads", "zlib",
  "node:assert", "node:buffer", "node:child_process", "node:crypto",
  "node:dns", "node:events", "node:fs", "node:http", "node:https",
  "node:net", "node:os", "node:path", "node:readline", "node:stream",
  "node:tls", "node:url", "node:util", "node:v8", "node:worker_threads",
  "node:zlib",
  // Optional native Discord.js deps — not needed for bot API usage
  "@discordjs/opus", "opusscript", "bufferutil", "utf-8-validate",
  "erlpack", "zlib-sync", "sodium", "libsodium-wrappers",
];

const pluginNodeModules = path.resolve(__dirname, "node_modules");

export default [
  // Stream Deck plugin
  {
    input: "src/plugin.ts",
    output: {
      file: "com.johnhammerlund.discordadminbot.sdPlugin/bin/plugin.js",
      format: "cjs",
      exports: "auto",
    },
    external,
    plugins: [
      typescript({ tsconfig: "./tsconfig.json", sourceMap: false }),
      nodeResolve({ preferBuiltins: true, browser: false }),
      commonjs({ ignoreDynamicRequires: true }),
      json(),
    ],
  },
  // Bundled bot server (spawned by BotServerToggle)
  {
    input: "../bot/src/index.ts",
    output: {
      file: "com.johnhammerlund.discordadminbot.sdPlugin/bin/bot-server.js",
      format: "cjs",
      exports: "auto",
    },
    external,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.bot-bundle.json",
        sourceMap: false,
        include: ["../bot/src/**/*.ts"],
      }),
      nodeResolve({
        preferBuiltins: true,
        browser: false,
        extensions: [".ts", ".js", ".json"],
        // Resolve npm packages from plugin/node_modules since bot/ has no node_modules
        modulePaths: [pluginNodeModules],
      }),
      commonjs({ ignoreDynamicRequires: true }),
      json(),
    ],
  },
];
