import * as es from "esbuild";
import path from "node:path";
import { EventEmitter } from "node:events";
import { Mode, type OliveConfig } from "../../types";
import Postcss from "postcss";
import postCSSLoader from "../postCSSPlugin";
import indexHTMLPlugin from "../indexHTMLPlugin";

const transpiler = new Bun.Transpiler({ trimUnusedImports: true });
class Bundler {
	private config: OliveConfig;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	private postCSSConfig: any;
	private mode: Mode;
	private entrypoints: string[];
	isFirstBundle: boolean;
	stats?: string;
	emitter: EventEmitter;

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	constructor(config: OliveConfig, postCSSConfig: any) {
		this.mode = config.mode;
		this.config = config;
		this.postCSSConfig = postCSSConfig ?? { plugins: [] };
		this.entrypoints = this.resolveEntryPoints(config.entrypoints, config.rootDir);
		this.emitter = new EventEmitter();
		this.isFirstBundle = true;
	}

	bundle = async () => {
		const timeString = ((first) => (first ? "🚀 built" : "🚀 rebuilt"))(this.isFirstBundle);
		console.time(timeString);

		if (!this.isFirstBundle) console.log(`\n 🫒 rebuilding... (~ ${this.stats})`);
		const { dependencies } = await this.resolveDependencies(this.entrypoints);
		const entryPoints = this.config.enableSPA ? this.entrypoints : this.buildClientEntrypoints(dependencies);

		try {
			const esBuild = await es.build({
				entryPoints,
				bundle: true,
				outdir: `./${this.config.outDir}`,
				sourceRoot: this.config.rootDir,
				metafile: true,
				loader: {
					".jpg": "file",
					".jpeg": "file",
					".png": "file",
					".gif": "file",
					".svg": "file",
					".webp": "file",
				},
				assetNames: "assets/[name]-[hash]",
				publicPath: this.config.publicPath,
				write: true, // figure out how to avoid writing to disk for dev mode
				plugins: [postCSSLoader(this.postCSSConfig, this.config.buildDir), indexHTMLPlugin(this.config)],
			});

			/*
			  Bun build is throwing bus error when importing and using images in
			  .tsx files. Falling back to esbuild until I figure out how to resolve this.

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

			/**
			 	Move this into a plugin loader to handle creating the HTML file while bundling?
			 **/
			const html = this.buildHTMLDocument({}, "", this.config.sourcemap === "external");
			// Bun.write(`${this.config.outDir}/index.html`, html);

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
	};

	resolveDependencies = async (
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
			const depScan = await transpiler.scan(contents);
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
				// recurse through resolved dependencies
				await this.resolveDependencies(
					resolvedDeps,
					ignoredFiles,
					dependencies,
					processedFiles,
					cssImportMap,
					assetImportMap,
					entryKey,
					depth + 1,
				);
			}
		}
		return { dependencies, cssImportMap };
	};

	/**
	 * Possibly move this into the postCSS plugin
	 */
	// buildCSS = async (cssImportMap: Record<string, string[]>) => {
	// 	console.time("✅ compiled css");
	// 	const cssImports = Array.from(Object.values(cssImportMap)).flat();
	// 	const postcss = Postcss(this.postCSSConfig.plugins);
	// 	const hasher = new Bun.CryptoHasher("blake2b256");
	// 	const cssMap = new Map<string, string>();
	// 	for (const css of cssImports) {
	// 		const cssFileString = await Bun.file(css).text();
	// 		hasher.update(cssFileString);
	// 		const cssHash = hasher.digest("hex").slice(0, 16);
	// 		const outPath = path.join(this.config.buildDir, `${cssHash}.css`);
	// 		const processed = await postcss.process(cssFileString, {
	// 			from: css,
	// 			to: outPath,
	// 		});
	// 		await Bun.write(outPath, processed.css);
	// 		cssMap.set(css, outPath.slice(`${this.config.buildDir}/`.length));
	// 	}

	// 	await Bun.write(
	// 		path.join(this.config.buildDir, "cssmap.json"),
	// 		JSON.stringify(Array.from(cssMap.entries()), null, 2),
	// 	);
	// 	console.timeEnd("✅ compiled css");
	// 	return cssMap;
	// };

	private buildClientEntrypoints = (
		dep: Set<{
			entrypoint: string;
			exports: string[];
		}>,
	) => Array.from(dep.values()).map((dep) => dep.entrypoint);

	private buildHTMLDocument = (cssMap: Map<string, string>, jsHash: string | null, sourcemap: boolean) => {
		// Work around for vercel deployment - vercel is serviing static build assets
		// from the root directory instead of the build directory
		const outDir = this.mode === Mode.Development ? `/${this.config.outDir}` : "";

		let cssLinkTags = "";
		// for (const [_, value] of cssMap) {
		cssLinkTags += `<link rel="stylesheet" type="text/css" href="${outDir}/${""}" />\n`;
		// }
		return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="manifest" href="${outDir}/manifest.json">
                <link rel="shortcut icon" href="${outDir}/favicon.ico">

                <title>Olivejs - Sandbox</title>

                ${cssLinkTags}
                <script type="module" src="${outDir}/index.js"></script>
                ${sourcemap ? `<script type="application/json" src="${outDir}/index.js.map"></script>` : ""}
                ${
									this.mode === Mode.Development
										? `<script type="module" src="/public/client.js"></script>`
										: ""
								}
            </head>
            <body>
                <noscript>You need to enable JavaScript to run this app.</noscript>
                <div id="root"></div>
            </body>
        </html>`;
	};

	private resolveEntryPoints = (entrypoints: string[], rootDir: string) => {
		return entrypoints.map((entry) => {
			const s = entry.replace(/\//g, "");
			return path.resolve(`${rootDir}/${s}`);
		});
	};
}

export { Bundler };
