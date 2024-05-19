import path from "node:path";
import type { Plugin, OnLoadResult } from "esbuild";
import Postcss from "postcss";

// TODO: Cache - https://esbuild.github.io/plugins/#caching-your-plugin
export default function postCSSLoader(config: any, buildDir: any) {
	const postCSSLoader: Plugin = {
		name: "postcss-plugin",
		setup(build) {
			build.onStart(() => {
				console.time("✅ compiled css");
			});
			build.onResolve({ filter: /\.css$/i }, (args) => {
				return {
					path: path.resolve(args.resolveDir, args.path),
					namespace: "css",
				};
			});
			build.onLoad({ filter: /.css/, namespace: "css" }, async (args): Promise<OnLoadResult> => {
				const postcss = Postcss(config.plugins);
				console.log("~~~~~~POSTCSSS~~~~~~");

				const cssFileString = await Bun.file(args.path).text();

				const cssHash = new Bun.CryptoHasher("blake2b256").update(cssFileString).digest("hex").slice(0, 16);
				const outPath = path.join(`${buildDir}/assets`, `${cssHash}.css`);
				const processed = await postcss.process(cssFileString, {
					from: args.path,
					to: outPath,
				});

				return {
					contents: processed.css, //outPath.slice(`${buildDir}/assets`.length),
					resolveDir: outPath,
					pluginData: { outPath },
					loader: "css",
				};
			});
			build.onEnd(() => {
				console.timeEnd("✅ compiled css");
			});
		},
	};
	return postCSSLoader;
}
