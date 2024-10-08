import path from "node:path";
import { JSDOM } from "jsdom";
import type esbuild from "esbuild";
import type { OliveConfig } from "../../types";
import type { Plugin } from "esbuild";

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

const joinWithPublicPath = (publicPath: string, relPath: string) => {
	let rel = relPath;
	const pub = publicPath === "" ? "." : publicPath;
	if (rel.startsWith("./")) {
		rel = rel.split("./")[1];
		while (true) {
			if (rel.startsWith("/")) {
				rel = rel.slice(1, rel.length - 1);
			} else if (rel.startsWith("./")) {
				rel = rel.slice(2, rel.length - 1);
			} else {
				break;
			}
		}
	}

	const slash = pub.endsWith("/") ? "" : "/";
	return `${pub}${slash}${rel}`;
};

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
		const targetPath = asset.path;
		const ext = path.extname(targetPath);
		const manifestTest = /manifest\.json/;
		const faviconTest = /favicon\.ico/;
		// if (publicPath) {
		// 	let targetPath = joinWithPublicPath(publicPath, path.relative(outDir, filepath));
		// }

		if (faviconTest.test(targetPath)) {
			const link = document.createElement("link");
			link.setAttribute("rel", "icon");
			link.setAttribute("href", targetPath);
			document.head.append(link);
			continue;
		}
		if (manifestTest.test(targetPath)) {
			const link = document.createElement("link");
			link.setAttribute("rel", "manifest");
			link.setAttribute("href", targetPath);
			document.head.append(link);
			continue;
		}

		switch (ext) {
			case ".js": {
				const scriptTag = document.createElement("script");
				if (config.inlineScript) {
					scriptTag.textContent = await Bun.file(asset.path).text();
					document.body.append(scriptTag);
					break;
				}

				scriptTag.setAttribute("src", targetPath);
				document.body.append(scriptTag);
				break;
			}
			case ".css": {
				if (config.inlineScript) {
					const styleSheet = document.createElement("style");
					styleSheet.textContent = await Bun.file(targetPath).text();
					document.head.append(styleSheet);
					break;
				}

				const link = document.createElement("link");
				link.setAttribute("rel", "stylesheet");
				link.setAttribute("href", targetPath);
				document.head.append(link);
				break;
			}
			default:
				break;
		}
	}
};

export default function indexHTMLPlugin(config: OliveConfig) {
	const buildIndexHTML: Plugin = {
		name: "html-plugin",
		setup(build) {
			build.onStart(() => {
				if (!build.initialOptions.metafile) {
					throw new Error("metafile is not enabled");
				}
				if (!build.initialOptions.outdir) {
					throw new Error("outdir must be set");
				}
				if (!build.initialOptions.outdir) {
					throw new Error("outdir must be set");
				}
			});

			build.onEnd(async (result) => {
				// const startTime = Date.now();
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
					if (entrypoint.cssBundle) {
						outputFilesMap.set(entrypoint.cssBundle, { path: entrypoint.cssBundle });
					}

					outputFilesCollection = [...outputFilesCollection, ...outputFilesMap.values()];
				}

				// fallback to config for now
				const outDir = build.initialOptions.outdir ?? config.outDir;
				const publicPath = config.publicPath;

				let faviconPath = "/favicon.ico";
				let manifestPath = "/manifest.json";
				if (publicPath) {
					faviconPath = joinWithPublicPath(publicPath, "favicon.ico");
					manifestPath = joinWithPublicPath(publicPath, "manifest.json");
				}

				outputFilesCollection = [
					...outputFilesCollection,
					...([{ path: faviconPath }, { path: manifestPath }] as OutputFilesCollection),
				];

				const dom = new JSDOM(defaultHtmlTemplate);
				await injectFiles(dom, outputFilesCollection, outDir, publicPath, config);

				await Bun.write(`${config.outDir}/index.html`, dom.serialize());

				// console.log(
				// 	`\x1b[1m\x1b[90m[${(Date.now() - startTime).toFixed(2)}ms]\x1b[0m`,
				// 	"built index.html ✅",
				// );
			});
		},
	};
	return buildIndexHTML;
}
