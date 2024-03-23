import type { BunPlugin } from "bun";

export default function postCSSPlugin(cssMap: Map<string, string>) {
	const postCSS: BunPlugin = {
		name: "postcss",
		setup(build) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			build.onLoad({ filter: /\.css/ }, async (args): Promise<any> => {
				if (!cssMap.has(args.path)) throw new Error("Can't resolve css path");
				const contents = cssMap.get(args.path);
				return {
					contents,
					loader: "text",
				};
			});
		},
	};
	return postCSS;
}
