import path from "node:path";
import fs from "node:fs/promises";
import chokidar from "chokidar";
import type { Bundler } from "./bundler";
import type { WatcherConfig } from "../../types";

export class Watcher {
	private config: WatcherConfig;
	private bundler: Bundler;

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	constructor(config: any, bundler: any) {
		this.config = config;
		this.bundler = bundler;
	}

	startWatcher = async () => {
		await this.resetbuildDir();
		const watcher = chokidar.watch([`./${this.config.rootDir}/**`], {
			ignored: [
				/(^|[\/\\])\../,
				"*/node_modules/**",
				`./${this.config.buildDir}/index.html`,
				`./${this.config.buildDir}/*.js`,
				`./${this.config.buildDir}/*.js.map`,
				`./${this.config.buildDir}/*.css`,
			],
			persistent: true,
			ignoreInitial: true,
		});

		watcher.on("all", async (_, stats) => {
			this.bundler.stats = stats;
			await this.resetbuildDir();
			await this.bundler.bundle();
		});
	};

	private resetbuildDir = async () => {
		const outPath = path.resolve(this.config.buildDir);
		try {
			await fs.rm(outPath, { recursive: true });
			await fs.mkdir(outPath);
		} catch (e) {
			console.error(e);
		}
	};
}
