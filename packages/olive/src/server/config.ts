import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "bun";
import { Mode, type OliveConfig } from "../../types";

const __CONFIG_FILE_NAME__ = "olive.config";
const __POSTCSS_CONFIG_NAME__ = "postcss.config";
const __CONFIG_FILE_EXT__ = ["js", "cjs", "mjs", "ts"];

const isValidMode = (mode: Mode | undefined): boolean => {
	return mode === Mode.Development || mode === Mode.Production;
};

const findConfig = (config: string) => {
	const rootDir = path.resolve(process.cwd());

	let filePath = "";
	for (const ext of __CONFIG_FILE_EXT__) {
		const p = path.join(rootDir, `${config}.${ext}`);
		if (fs.existsSync(p)) {
			filePath = p;
		}
	}

	return { exists: !!filePath, filePath: filePath };
};

const readConfig = async (): Promise<OliveConfig> => {
	const { exists, filePath } = findConfig(__CONFIG_FILE_NAME__);
	if (!exists) throw new Error("Error: olive config file not found");

	const stat = fs.statSync(filePath);
	const file = await import(`${pathToFileURL(filePath).href}?=${stat.mtimeMs}`);
	const config: OliveConfig = file?.default;
	if (!isValidMode((process.env.MODE as Mode) ?? Mode.Development)) {
		console.error(`Error: invalid mode, defaulting to ${Mode.Development} mode`);
	}

	return {
		port: config?.port ?? 3000,
		mode: (process.env.MODE as Mode) ?? Mode.Development,
		enableSPA: config?.enableSPA ?? true,
		buildDir: process.env.MODE === Mode.Production ? "build" : config?.buildDir ?? "dist",
		rootDir: config?.rootDir ?? "app",
		// if rootDir is missing from entrypoint, add it by default?
		entrypoints: config?.entrypoints ?? ["index.tsx"],
		publicPath: config?.publicPath?.replaceAll("/", "") ?? "public",
		outDir: ((mode: Mode | undefined, config: OliveConfig) => {
			if (mode === Mode.Production) return "build";
			return config?.buildDir ?? "dist";
		})(process.env.MODE as Mode, config),
		minify: false,
		// process.env.MODE === Mode.Production ||
		// (config?.bundlerConfig?.minify ?? false),
		splitting: false,
		// config?.bundlerConfig?.splitting ||
		// process.env.MODE === Mode.Production ||
		// false,
		sourcemap: ((mode: Mode | undefined) => {
			if (mode === Mode.Production) return "none";
			return config?.bundlerConfig?.sourcemap ?? "inline";
		})(process.env.MODE as Mode),
		format: config?.bundlerConfig?.format ?? "esm",
		plugins: config?.plugins ?? [],
		// Separate template config
		inlineScript: config?.inlineScript ?? true,
	};
};

const readPostCSSConfig = async () => {
	const { exists, filePath } = findConfig(__POSTCSS_CONFIG_NAME__);
	if (!exists) return undefined;
	console.log("[  info  ] found PostCSS config");

	console.time("✅ PostCSS config loaded\n");
	const postCSSConfigFile = require(filePath);
	postCSSConfigFile.plugins = Object.entries(postCSSConfigFile.plugins).map(([name, options]) => {
		const plugin = require(path.resolve(`node_modules/${name}`));
		return plugin(options);
	});
	console.timeEnd("✅ PostCSS config loaded\n");
	return postCSSConfigFile;
};

export { isValidMode, readConfig, readPostCSSConfig };
