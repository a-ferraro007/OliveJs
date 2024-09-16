import * as es from "esbuild";
import path from "node:path";
import { EventEmitter } from "node:events";
import { postCSSLoader, indexHTMLPlugin, globalReplacePlugin } from "../plugins";
import { Mode, type OliveConfig } from "../../types";
import type { Transpiler } from "bun";

class Bundler {
	private config: OliveConfig;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	private postCSSConfig: any;
	private mode: Mode;
	private entrypoints: string[];
	private transpiler: Transpiler;
	isFirstBundle: boolean;
	stats?: string;
	emitter: EventEmitter;

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	constructor(config: OliveConfig, postCSSConfig: any) {
		this.mode = config.mode;
		this.config = config;
		this.isFirstBundle = true;
		this.postCSSConfig = postCSSConfig ?? { plugins: [] };
		this.entrypoints = this.resolveEntryPoints(config.entrypoints, config.rootDir);
		this.emitter = new EventEmitter();
		this.transpiler = new Bun.Transpiler({ trimUnusedImports: true });
	}

	bundle = async () => {
		const timeString = ((first) => (first ? "built ✅" : "rebuilt ✅"))(this.isFirstBundle);
		console.time(timeString);

		if (!this.isFirstBundle) console.log(`\n 🫒 rebuilding... (~ ${this.stats})`);
		else console.log("\n 🫒 building...");
		const { dependencies } = await this.resolveDependencies(this.entrypoints);
		const entryPoints = this.config.enableSPA ? this.entrypoints : this.buildClientEntrypoints(dependencies);

		try {
			const esBuild = await es.build({
				entryPoints,
				bundle: true,
				outdir: `${this.config.outDir}`,
				sourceRoot: this.config.rootDir,
				metafile: true,
				/**
				 *
				 * publicPath property needs to match the outDir so imported images
				 * have the right file path after bundling
				 */
				publicPath: this.config.outDir,
				assetNames: "assets/[name]-[hash]",
				/**
				 * TODO: avoid writing to disk in dev mode
				 */
				write: true,
				loader: {
					".jpg": "file",
					".jpeg": "file",
					".png": "file",
					".gif": "file",
					".svg": "dataurl",
					".webp": "file",
				},
				external: [`${this.config.publicPath}/*`],
				plugins: [
					globalReplacePlugin(`${this.config.publicPath}`),
					postCSSLoader(this.postCSSConfig, this.config.buildDir),
					indexHTMLPlugin(this.config),
				],
			});

			/**
			 * 	 Bun build is throwing a bus error when importing and using images in
			 * .tsx files. Swapping with esbuild until I figure out how to resolve this.
			const build = await Bun.build({
				entrypoints: this.buildClientEntrypoints(dependencies),
				root: this.config.rootDir,
				outdir: `./${this.config.outDir}`,
				minify: this.config.minify,
				naming: "[dir]/[name]-[hash].[ext]",
				splitting: this.config.splitting,
				format: "esm",
				sourcemap: this.config.sourcemap,
				publicPath: "/dist/",
				plugins: [postCSSLoader(cssMap)],

				if (!build.success) {
				console.error("Build failed");
				console.log(build.outputs);
				for (const message of build.logs) {
					console.error(message);
				}
				return;
			}
			});
			*/

			if (esBuild.errors.length) {
				console.error("Build failed");
				for (const message of esBuild.errors) {
					console.error(message);
				}
				return;
			}

			if (this.config.mode === Mode.Development) {
				Bun.write(
					`${this.config.outDir}/client.js`,
					Bun.file(await import.meta.resolve("../client/client.js")),
				);
			}

			if (this.mode === Mode.Development) this.emitter.emit("bundle", esBuild);
			if (this.isFirstBundle) this.isFirstBundle = false;

			console.timeEnd(timeString);
			return esBuild;
		} catch (error) {
			console.error(error);
		}
		return true;
	};

	private resolveDependencies = async (
		entrypoints: string[],
		ignoredFiles: Set<string> = new Set(),
		dependencies: Set<{ entrypoint: string; exports: string[] }> = new Set(),
		processedFiles: Set<string> = new Set(),
		cssImportMap: Record<string, string[]> = {},
		assetImportMap: Record<string, string[]> = {},
		startingKey: string | undefined = undefined,
		depth = 0,
	): Promise<{
		dependencies: Set<{ entrypoint: string; exports: string[] }>;
		cssImportMap: Record<string, string[]>;
	}> => {
		if (depth > 25) {
			console.error("max dependency depth reached");
			return { dependencies, cssImportMap };
		}

		for (const entrypoint of entrypoints) {
			const entryKey = startingKey ?? entrypoint;
			if (processedFiles.has(entrypoint) || entrypoint.match(/\.(jpeg|jpg|png|gif|svg|bun)$/i)) {
				continue;
			}

			// get file & read contents
			const file = await Bun.file(entrypoint);

			// get import / export list
			const contents = await file.text();
			const depScan = this.transpiler.scan(contents);
			dependencies.add({ entrypoint, exports: depScan.exports });

			// keep track of processed files
			processedFiles.add(entrypoint);

			// get parent directory
			const parent = entrypoint.split("/").slice(0, -1).join("/");

			const resolvedDeps = (
				await Promise.all(
					// map through file imports
					depScan.imports.map(async (dep) => {
						try {
							// Creating a css import path might be redundant, moving
							//this into the postcss plugin might work.
							// if a css file is encountered, add it to the map
							if (dep.path.match(/\.(css|scss)$/i)) {
								if (!cssImportMap[entryKey]) cssImportMap[entryKey] = [];

								// resolve file from parent
								const resolved = await Bun.resolve(dep.path, parent);
								cssImportMap[entryKey].push(resolved);
								return;
							}

							if (dep.path.match(/\.(jpeg|jpg|png|gif|svg)$/i)) {
								if (!assetImportMap[entryKey]) assetImportMap[entryKey] = [];

								// resolve file from parent
								const resolved = await Bun.resolve(dep.path, parent);
								assetImportMap[entryKey].push(resolved);
								return;
							}

							// resolve file from parent
							const resolved = await Bun.resolve(dep.path, parent);
							return resolved;
						} catch (error) {
							console.error(error);
						}
					}),
				)
			).filter(Boolean) as string[];

			if (resolvedDeps.length > 0) {
				//TODO: Use or delete
				// recurse through resolved dependencies
				// await this.resolveDependencies(
				//     resolvedDeps,
				//     ignoredFiles,
				//     dependencies,
				//     processedFiles,
				//     cssImportMap,
				//     assetImportMap,
				//     entryKey,
				//     depth + 1
				// );
			}
		}
		return { dependencies, cssImportMap };
	};

	private buildClientEntrypoints = (
		dep: Set<{
			entrypoint: string;
			exports: string[];
		}>,
	) => Array.from(dep.values()).map((dep) => dep.entrypoint);

	private resolveEntryPoints = (entrypoints: string[], rootDir: string) => {
		return entrypoints.map((entry) => {
			const s = entry.replace(/\//g, "");
			return path.resolve(`${rootDir}/${s}`);
		});
	};
}

export { Bundler };
