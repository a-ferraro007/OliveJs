import type { BunPlugin, OnLoadResult } from "bun";

export default function postCSSLoader(cssMap: Map<string, string>) {
	const postCSSLoader: BunPlugin = {
		name: "postcss-plugin",
		setup(build) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			build.onLoad({ filter: /\.css/ }, async (args): Promise<OnLoadResult> => {
				if (!cssMap.has(args.path)) throw new Error("Can't resolve css path");
				const contents = cssMap.get(args.path);

				return {
					contents: contents ?? "",
					loader: "text",
				};
			});
		},
	};
	return postCSSLoader;
}
