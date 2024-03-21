import { BunPlugin } from "bun"

export default function bundleCSS(cssMap: Map<string, string>) {
  const bundleCSS: BunPlugin = {
    name: "css-bundle",
    async setup(build) {
      build.onLoad({ filter: /\.css/ }, (args) => {
        const path = cssMap.get("args.path") ?? args.path
        return {
          contents: `export default '${path}'`,
          loader: "js",
        }
      })
    },
  }
  return bundleCSS
}
