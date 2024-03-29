import type { BunPlugin } from "bun";

export default function assetLoader() {
	return {
		name: "assetloader-plugin",
		setup({ onLoad, onResolve }) {
			// onResolve({ filter: /\.(jpeg|jpg|png|gif|svg)$/i }, (args) => {
			// 	console.log({ args });
			// 	return { path: args.path, namespace: "image-ns" };
			// });
			// { filter: /.*/, namespace: "image-ns" }

			onLoad({ filter: /\.(jpeg|jpg|png|gif|svg)$/i }, async (args) => {
				const f = await Bun.file(args.path);
				const mimeType = f.type;
				const base64Encoded = Buffer.from(await f.arrayBuffer()).toString("base64");
				console.log({ f });
				console.log(args);

				return {
					contents: `export default "data:${mimeType};base64,${base64Encoded}"`,
					loader: "js", // special loader for JS objects
				};
			});
		},
	} as BunPlugin;
}
// /\.(jpeg|jpg|png|gif|svg)$/i
