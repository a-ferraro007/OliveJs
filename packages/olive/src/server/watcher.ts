import chokidar from "chokidar";
import { Bundler } from "./bundler";
import fs from "node:fs";
import path from "path";
import { WatcherConfig } from "../../types";

export class Watcher {
	private config: WatcherConfig;
	private bundler: Bundler;

	constructor(config: any, bundler: any) {
		this.config = config;
		this.bundler = bundler;
	}

	// `./${this.config.buildDir}/*`
	startWatcher = () => {
		this.resetbuildDir();
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
			this.resetbuildDir();
			this.bundler.stats = stats;
			await this.bundler.bundle();
		});
	};

	private resetbuildDir = () => {
		const outPath = path.resolve(this.config.buildDir);
		try {
			fs.rmSync(outPath, { recursive: true });
			fs.mkdirSync(outPath);
		} catch (e) {
			console.log(e);
		}
	};

	private removeStaleJSBuilds = () => {
		const regex = /^index-[A-Za-z0-9]+\.js|index-[A-Za-z0-9]+\.js.map$/;
		const files = fs.readdirSync(this.config.buildDir);
		// biome-ignore lint/complexity/noForEach: <explanation>
		files.forEach(
			(name) =>
				regex.test(name) && fs.unlinkSync(`./${this.config.buildDir}/${name}`),
		);
	};

	private removeStaleCSSBuilds = () => {
		const regex = /^styles-[A-Za-z0-9]+\.css$/;
		const files = fs.readdirSync(this.config.buildDir);
		// biome-ignore lint/complexity/noForEach: <explanation>
		files.forEach(
			(name) =>
				regex.test(name) && fs.unlinkSync(`./${this.config.buildDir}/${name}`),
		);
	};
}
