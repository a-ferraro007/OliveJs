#!/usr/bin/env bun
import { server } from "./src/server/server";
import { version } from "./package.json";
import { Mode } from "./types";

console.log(`\n🫒 olive dev v${version}\n`);
const app = await server();
const { config } = app;

app.listen(config.mode ?? Mode.Development, () => {
	console.log();
	console.log(`\x1b[42m  serve  \x1b[0m Server running on port ${config.port}`);
});
