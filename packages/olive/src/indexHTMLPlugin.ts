import path from "node:path";
import type esbuild from "esbuild";
import type { OliveConfig } from "../types";
import { JSDOM } from "jsdom";
import type { Plugin, OnLoadResult, OnResolveResult, OnResolveArgs } from "esbuild";
type OutputFilesCollection = (esbuild.Metafile["outputs"][string] & { path: string })[];

const defaultHtmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
	<noscript>You need to enable JavaScript to run this app.</noscript>
	<div id="root"></div>
  </body>
</html>
`;

// func joinWithPublicPath(publicPath string, relPath string) string {
// 	if strings.HasPrefix(relPath, "./") {
// 		relPath = relPath[2:]

// 		// Strip any amount of further no-op slashes (i.e. ".///././/x/y" => "x/y")
// 		for {
// 			if strings.HasPrefix(relPath, "/") {
// 				relPath = relPath[1:]
// 			} else if strings.HasPrefix(relPath, "./") {
// 				relPath = relPath[2:]
// 			} else {
// 				break
// 			}
// 		}
// 	}

// 	// Use a relative path if there is no public path
// 	if publicPath == "" {
// 		publicPath = "."
// 	}

// 	// Join with a slash
// 	slash := "/"
// 	if strings.HasSuffix(publicPath, "/") {
// 		slash = ""
// 	}
// 	return fmt.Sprintf("%s%s%s", publicPath, slash, relPath)
// }

const injectFiles = async (
	dom: JSDOM,
	assets: OutputFilesCollection,
	outDir: string,
	publicPath: string,
	config: OliveConfig,
) => {
	const document = dom.window.document;
	for (const asset of assets) {
		const ext = path.extname(asset.path);
		switch (ext) {
			case ".js": {
				const scriptTag = document.createElement("script");
				if (!config.inlineScript) {
					scriptTag.textContent = await Bun.file(asset.path).text();
					document.body.append(scriptTag);
					break;
				}

				scriptTag.setAttribute("src", asset.path);
				document.body.append(scriptTag);
				break;
			}
			case ".css": {
				if (!config.inlineScript) {
					const styleSheet = document.createElement("style");
					styleSheet.textContent = await Bun.file(asset.path).text();
					document.head.append(styleSheet);
					break;
				}

				const link = document.createElement("link");
				link.setAttribute("rel", "stylesheet");
				link.setAttribute("href", asset.path);
				document.head.append(link);

				break;
			}
			default:
				console.log({ asset });
				break;
		}
	}
};

export default function indexHTMLPlugin(config: OliveConfig) {
	const buildIndexHTML: Plugin = {
		name: "html-plugin",
		setup(build) {
			build.onStart(() => {
				console.log(
					"HTML Plugin Started",
					build.initialOptions.metafile,
					build.initialOptions.outdir,
					config.outDir,
				);
				if (!build.initialOptions.metafile) {
					throw new Error("metafile is not enabled");
				}
				if (!build.initialOptions.outdir) {
					throw new Error("outdir must be set");
				}
			});
			build.onEnd(async (result) => {
				const startTime = Date.now();
				console.log();
				const configEntrypoints = config.entrypoints.map((e) => `${config.rootDir}/${e}`);
				const entrypoints = Object.entries(result?.metafile?.outputs || {})
					.filter(([_, output]) => {
						if (!output.entryPoint) return;
						return configEntrypoints.includes(output.entryPoint);
					})
					.map((e) => ({
						path: e[0],
						...e[1],
					}));

				let outputFilesCollection: OutputFilesCollection = [];

				for (const entrypoint of entrypoints) {
					const outputFilesMap = new Map();
					outputFilesMap.set(entrypoint.path, entrypoint);
					console.log(entrypoint.cssBundle);
					if (entrypoint.cssBundle) {
						outputFilesMap.set(entrypoint.cssBundle, { path: entrypoint.cssBundle });
					}

					outputFilesCollection = [...outputFilesCollection, ...outputFilesMap.values()];
				}

				// biome-ignore lint/style/noNonNullAssertion: Asserted in build.onStart()
				const outDir = build.initialOptions.outdir!;
				// biome-ignore lint/style/noNonNullAssertion: Asserted in build.onStart()
				const publicPath = build.initialOptions.publicPath!;

				const dom = new JSDOM(defaultHtmlTemplate);
				await injectFiles(dom, outputFilesCollection, outDir, publicPath, config);

				await Bun.write(`${config.outDir}/index.html`, dom.serialize());
				console.log(`  HTML Plugin Done in ${Date.now() - startTime}ms`);
			});
		},
	};
	return buildIndexHTML;
}
