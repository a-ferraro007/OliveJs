import type { Loader, OnLoadArgs, OnLoadResult, PluginBuild } from "esbuild";
import path from "node:path";

export default function globalReplacePlugin(str: string) {
	return {
		name: "globalReplace",
		setup(build: PluginBuild) {
			build.onLoad({ filter: /.*$/ }, async (args: OnLoadArgs): Promise<OnLoadResult | undefined> => {
				if (args.path.includes("node_modules")) {
					// Skip node modules but do not end processing
					return;
				}
				let contents: Uint8Array | string | undefined;
				const extension = args.path.split(".").pop();
				let loader: Loader = "file";
				if (extension) {
					if (extension.match(/css?$/)) {
						loader = "css";
						contents = (await Bun.file(args.path).text()).replace(/%PUBLIC%/g, str);
					} else if (extension.match(/jsx?$/) || extension.match(/tsx?$/)) {
						loader = "jsx";
						contents = (await Bun.file(args.path).text()).replace(/%PUBLIC%/g, str);
					}
				}
				return {
					contents,
					loader,
				};
			});
		},
	};
}
