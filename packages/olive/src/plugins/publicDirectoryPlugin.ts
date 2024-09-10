import path from "node:path";
import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import type { Plugin, PluginBuild } from "esbuild";
const NAME = "public-directory";

export default function publicDirectoryPlugin(entry = "public"): Plugin {
	return {
		name: "public-directory",
		setup(build) {
			build.onResolve({ filter: /^public\// }, (args) => {
				console.log(args);
				// return args;
				return { path: args.path, namespace: "public" };
			});

			build.onLoad({ filter: /.*/, namespace: "public" }, (args) => {
				// Do not process the file content, just return the path
				console.log(args);
				return {
					contents: `export default "${args.path}";`,
					loader: "js",
				};
			});

			// Prevent esbuild from loading these files
			// build.onLoad({ filter: /^\/public\// }, (args) => {
			// 	return {
			// 		contents: fsSync.readFileSync(args.path),
			// 		loader: "file",
			// 	};
			// });
			// },
			// async setup(build: PluginBuild) {

			// const absPathname = (pathname: string): string => {
			// 	if (!path.isAbsolute(pathname) && build.initialOptions.absWorkingDir) {
			// 		console.log({ abs: path.join(build.initialOptions.absWorkingDir, pathname) });
			// 		return path.join(build.initialOptions.absWorkingDir, pathname);
			// 	}
			// 	return pathname;
			// };

			// const absEntry = absPathname(entry);
			// const outdir: string = absPathname(
			// 	build.initialOptions.outdir || path.dirname(build.initialOptions.outfile || ""),
			// );

			// build.onLoad({ filter: /.*$/ }, async () => {
			// 	let exists = false;
			// 	try {
			// 		await fs.access(entry);
			// 		exists = true;
			// 	} catch (err) {
			// 		return {
			// 			warnings: [{ pluginName: NAME, text: (err as Error).toString() }],
			// 		};
			// 	}
			// 	console.log({ exists, entry });
			// 	if (exists) {
			// 		const stats = await fs.stat(absEntry);
			// 		if (stats?.isDirectory()) {
			// 			console.log({ entry, outdir });
			// 			// fsSync.cpSync(outdir, entry, { recursive: true });
			// 		}
			// 	}

			// 	return null;
			// });
		},
	};
}
