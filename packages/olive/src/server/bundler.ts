import { EventEmitter } from "node:events"
import { Mode, OliveConfig } from "../../types"
import Postcss from "postcss"
import path from "path"
import fs from "node:fs"
import postCSSPlugin from "../../postCSSPlugin"

const transpiler = new Bun.Transpiler({ loader: "tsx" })
class Bundler extends EventEmitter {
  private config: OliveConfig
  private postCSSConfig: any
  private mode: Mode
  private entrypoints: string[]
  isFirstBundle: boolean
  stats?: string
  emitter: EventEmitter

  constructor(config: OliveConfig, postCSSConfig: any) {
    super()
    this.mode = config.mode
    this.config = config
    this.postCSSConfig = postCSSConfig ?? {plugins: []}
    this.entrypoints = this.resolveEntryPoints(
      config.entrypoints,
      config.appDirectory
    )
    this.emitter = this
    this.isFirstBundle = true
  }

  bundle = async () => {
    let timeString: string
    if (this.isFirstBundle) timeString = "🚀 built"
    else timeString = "🚀 rebuilt"

    console.time(timeString)
    if (!this.isFirstBundle)
      console.log(`\n 🫒 rebuilding... (~ ${this.stats})`)

    const { dependencies, cssImportMap } = await this.resolveDependencies(
      this.entrypoints
    )
    const cssMap = await this.buildCSS(cssImportMap)
    const c = postCSSPlugin(cssMap)

    try {
      const build = await Bun.build({
        entrypoints: this.buildClientEntrypoints(dependencies),
        root: this.config.appDirectory,
        outdir: `./${this.config.outDir}`,
        minify: this.config.minify,
        naming: "[dir]/[name]-[hash].[ext]",
        splitting: this.config.splitting,
        format: this.config.format,
        sourcemap: this.config.sourcemap,
        plugins: [c],
      })

      if (!build.success) {
        console.error("Build failed")
        for (const message of build.logs) {
          console.error(message)
        }
        return
      }

      const jsBuildHash = build?.outputs[0].hash

      const html = this.buildHTMLDocument(
        cssMap,
        jsBuildHash,
        this.config.sourcemap === "external"
      )
      Bun.write(`${this.config.outDir}/index.html`, html)
      if (this.mode === Mode.Development) this.emitter.emit("bundle", build)

      if (this.isFirstBundle) this.isFirstBundle = false
      console.timeEnd(timeString)
      return build
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  resolveDependencies = async (
    entrypoints: string[],
    ignoredFiles: Set<string> = new Set(),
    dependencies: Set<{ entrypoint: string; exports: string[] }> = new Set(),
    processedFiles: Set<string> = new Set(),
    cssImportMap: Record<string, string[]> = {},
    startingKey: string | undefined = undefined,
    depth = 0
  ): Promise<{
    dependencies: Set<{ entrypoint: string; exports: string[] }>
    cssImportMap: Record<string, string[]>
  }> => {
    if (depth > 25) {
      console.error("max dependency depth reached")
      return { dependencies, cssImportMap }
    }

    for (const entrypoint of entrypoints) {
      const entryKey = startingKey ?? entrypoint
      if (processedFiles.has(entrypoint) || entrypoint.includes(".bun")) {
        continue
      }

      // get file & read contents
      const file = await Bun.file(entrypoint)
      const contents = await file.text()

      // get import / export list
      const depScan = await transpiler.scan(contents)
      dependencies.add({ entrypoint, exports: depScan.exports })

      // keep track of processed files
      processedFiles.add(entrypoint)

      // get parent directory
      const parent = entrypoint.split("/").slice(0, -1).join("/")
      // console.log({parent});

      let resolvedDeps = (
        await Promise.all(
          // map through file imports
          depScan.imports.map(async (dep) => {
            try {
              // if a css file is encountered, add it to the map
              if (dep.path.endsWith(".css")) {
                if (!cssImportMap[entryKey]) cssImportMap[entryKey] = []

                // console.log({parent, entryKey});

                // resolve file from parent
                const resolved = await Bun.resolve(dep.path, parent)
                cssImportMap[entryKey].push(resolved)
                return
              }

              // resolve file from parent
              const resolved = await Bun.resolve(dep.path, parent)
              return resolved
            } catch (error) {
              console.error(error)
            }
          })
        )
      ).filter(Boolean) as string[]

      if (resolvedDeps.length > 0) {
        // recurse through resolved dependencies
        await this.resolveDependencies(
          resolvedDeps,
          ignoredFiles,
          dependencies,
          processedFiles,
          cssImportMap,
          entryKey,
          depth + 1
        )
      }
    }
    return { dependencies, cssImportMap }
  }

  buildCSS = async (cssImportMap: Record<string, string[]>) => {
    console.time("✅ compiled css")
    const cssImports = Array.from(Object.values(cssImportMap)).flat()
    const postcss = Postcss(this.postCSSConfig.plugins)
    const hasher = new Bun.CryptoHasher("blake2b256")
    const cssMap = new Map<string, string>()
    for (const css of cssImports) {
      const cssFileString = await Bun.file(css).text()
      hasher.update(cssFileString)
      const cssHash = hasher.digest("hex").slice(0, 16)
      const outPath = path.join(this.config.buildDirectory, `${cssHash}.css`)
      const processed = await postcss.process(cssFileString, {
        from: css,
        to: outPath,
      })
      
      await Bun.write(outPath, processed.css)
      cssMap.set(css, outPath.slice(`${this.config.buildDirectory}/`.length))
    }

    await Bun.write(
      path.join(this.config.buildDirectory, "cssmap.json"),
      JSON.stringify(Array.from(cssMap.entries()), null, 2)
    )
    console.timeEnd("✅ compiled css")
    const map = JSON.parse(
      await Bun.file(
        path.join(this.config.buildDirectory, "cssmap.json")
      ).text()
    )

    return cssMap
  }

  private buildClientEntrypoints = (
    dep: Set<{
      entrypoint: string
      exports: string[]
    }>
  ) => Array.from(dep.values()).map((dep) => dep.entrypoint)

  private buildHTMLDocument = (
    cssMap: Map<string, string>,
    jsHash: string | null,
    sourcemap: boolean
  ) => {
    // Work around for vercel deployment - vercel is serviing static build assets
    // from the root directory instead of the build directory
    const outDir =
      this.mode === Mode.Development ? `/${this.config.outDir}` : ""

    let cssLinkTags = ""
    cssMap.forEach((e) => {
      cssLinkTags =
      cssLinkTags + `<link rel="stylesheet" type="text/css" href="${outDir}/${e}" />\n`
    })

    return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="manifest" href="${outDir}/manifest.json">
                <link rel="shortcut icon" href="${outDir}/favicon.ico">

                <title>Olivejs - Sandbox</title>

                ${cssLinkTags}
                <script type="module" src="${outDir}/index-${jsHash}.js"></script>
                ${
                  sourcemap
                    ? `<script type="application/json" src="${outDir}/index.js.map"></script>`
                    : ""
                }
                ${
                  this.mode === Mode.Development
                    ? `<script type="module" src="/${this.config.outDir}/client.js"></script>`
                    : ""
                }
            </head>
            <body>
                <noscript>You need to enable JavaScript to run this app.</noscript>
                <div id="root"></div>
            </body>
        </html>`
  }

  private resolveEntryPoints = (
    entrypoints: string[],
    appDirectory: string
  ) => {
    return entrypoints.map((entry) => {
      const s = entry.replace(/\//g, "")
      return path.resolve(`${appDirectory}/${s}`)
    })
  }
}

export { Bundler }
