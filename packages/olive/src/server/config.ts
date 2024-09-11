import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "bun";
import { ImportMethod, Mode, type OliveConfig } from "../../types";

const __CONFIG_FILE_NAME__ = "olive.config";
const __POSTCSS_CONFIG_NAME__ = "postcss.config";
const __CONFIG_FILE_EXT__ = ["js", "cjs", "mjs", "ts"];

const isValidMode = (mode: Mode | undefined): boolean => {
	return mode === Mode.Development || mode === Mode.Production;
};

const findFileAndImport = async (config: string, importMethod: ImportMethod, testExts = false) => {
	let filePath = "";
	const rootDir = path.resolve(process.cwd());

	const imp = async (path: string, method: ImportMethod): Promise<unknown[]> => {
		let f: unknown;
		let err: unknown;
		try {
			const stat = fs.statSync(filePath);
			switch (method) {
				case ImportMethod.Import:
					f = await import(`${pathToFileURL(path).href}?=${stat.mtimeMs}`);
					break;
				case ImportMethod.Require:
					f = await require(path);
					break;
				default:
					console.log({ f });
					break;
			}
		} catch (error) {
			err = error;
		}
		return [f, err];
	};
	if (!testExts) {
		const [file, err] = await imp(config, importMethod);
		return { file, exists: !!file, filePath: config, error: err };
	}

	for (const ext of __CONFIG_FILE_EXT__) {
		filePath = path.join(rootDir, `${config}.${ext}`);
		if (fs.existsSync(filePath)) {
			const [file, err] = await imp(filePath, importMethod);
			return { file: file, exists: !!file, filePath: filePath, error: err };
		}
	}
	return { file: undefined, exists: false, filePath: config, error: undefined };
};

const readConfig = async (): Promise<OliveConfig> => {
	const { exists, file } = await findFileAndImport(__CONFIG_FILE_NAME__, ImportMethod.Import, true);
	if (!exists) throw new Error("Error: olive config file not found");

	const config: OliveConfig = file?.default;
	if (!isValidMode((process.env.MODE as Mode) ?? Mode.Development)) {
		console.error(`Error: invalid mode, defaulting to ${Mode.Development} mode`);
	}
	return {
		port: config?.port ?? 3000,
		mode: (process.env.MODE as Mode) ?? Mode.Development,
		enableSPA: config?.enableSPA ?? true,
		buildDir: ((mode: Mode) => {
			if (mode === Mode.Production) return "build";
			return config?.buildDir ?? "dist";
		})(process.env.MODE as Mode),
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
	const {
		exists,
		file: postCSSConfigFile,
		error,
	} = await findFileAndImport(__POSTCSS_CONFIG_NAME__, ImportMethod.Require);
	if (error) {
		console.log("\x1b[42m  info   \x1b[0m PostCSS config not found: skipping loader");
	} else {
		console.log("[  info  ] found PostCSS config");
		console.time("✅ PostCSS config loaded\n");

		postCSSConfigFile.plugins = Object.entries(postCSSConfigFile.plugins).map(([name, options]) => {
			const plugin = require(path.resolve(`node_modules/${name}`));
			return plugin(options);
		});
		console.timeEnd("✅ PostCSS config loaded\n");
	}
	return postCSSConfigFile;
};

export { isValidMode, readConfig, readPostCSSConfig };
