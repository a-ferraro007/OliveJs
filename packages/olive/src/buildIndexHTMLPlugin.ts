import type { Plugin, OnLoadResult } from "esbuild";
export default function buildIndexHTML() {
	const buildIndexHTML: Plugin = {
		name: "postcss-plugin",
		setup(build) {
			build.onLoad({ filter: /\.css|.js/i }, async (args): Promise<OnLoadResult> => {
				// if (!cssMap.has(args.path)) throw new Error("Can't resolve css path");
				const contents = args.path;
				console.log(args);

				// return {
				// 	contents: contents ?? "",
				// 	loader: "text",
				// };
			});
		},
	};
	return buildIndexHTML;
}
