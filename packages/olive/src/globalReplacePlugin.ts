import type { Loader, OnLoadArgs, OnLoadResult, PluginBuild } from "esbuild";

export default function globalReplacePlugin(str: string) {
	return {
		name: "globalReplace",
		setup(build: PluginBuild) {
			build.onLoad({ filter: /.*$/ }, async (args: OnLoadArgs): Promise<OnLoadResult | undefined> => {
				if (args.path.includes("node_modules")) {
					// Skip node modules but do not end processing
					return;
				}
				console.log("Processing path: ", args.path);
				let contents = await Bun.file(args.path).text();
				const extension = args.path.split(".").pop();
				let loader: Loader = "file";
				if (extension) {
					if (extension.match(/css?$/)) {
						loader = "css";
						contents = contents.replace(/%PUBLIC%/g, "/public");
					} else if (extension.match(/jsx?$/) || extension.match(/tsx?$/)) {
						loader = "jsx";
						contents = contents.replace(/%PUBLIC%/g, "/public");
					}
				}
				console.log(`Using loader: ${loader} for path: ${args.path}`);

				return {
					contents,
					loader,
				};
			});
		},
	};
}
