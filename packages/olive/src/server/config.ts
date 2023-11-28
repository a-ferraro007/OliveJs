import path from "path"
import fs from "node:fs"
import { pathToFileURL } from "bun"
import { Mode, OliveConfig } from "../../types"

const __CONFIG_FILE_NAME__ = "olive.config"
const __POSTCSS_CONFIG_NAME__ = "postcss.config"
const __CONFIG_FILE_EXT__ = ["js", "cjs", "mjs", "ts"]

const isValidMode = (mode: Mode | undefined): boolean => {
  return mode === Mode.Development || mode === Mode.Production
}

const findConfig = (config: string) => {
  const rootDir = path.resolve(process.cwd())

  let filePath = ''
  __CONFIG_FILE_EXT__.forEach((ext) => {
    const p = path.join(rootDir, `${config}.${ext}`)
    if (fs.existsSync(p)) {
      filePath = p
    }
  })

  return { exists: !!filePath, filePath: filePath }
}

const readConfig = async () => {
  let appConfig: OliveConfig
  const { exists, filePath } = findConfig(__CONFIG_FILE_NAME__)
  if (!exists) throw new Error("Error: olive config file not found")

  const stat = fs.statSync(filePath)
  const file = await import(pathToFileURL(filePath).href + "?=" + stat.mtimeMs)
  const config = file?.default
  if (!isValidMode(process.env.MODE as Mode)) {
    throw new Error("Error: invalid mode")
  }

  appConfig = {
    port: config?.port ?? 3000,
    mode: process.env.MODE as Mode,
    buildDirectory:
      process.env.MODE === Mode.Production
        ? "build"
        : config?.buildDirectory ?? "dist",
    appDirectory: config?.appDirectory ?? "app",
    entrypoints: config?.entrypoints ?? "index.tsx",
    publicPath: config?.publicPath ?? "/dist/",
    outDir:
      process.env.MODE === Mode.Production
        ? "build"
        : config?.buildDirectory ?? "dist",
    minify:
      process.env.MODE === Mode.Production ||
      (config?.bundlerConfig?.minify ?? false),
    splitting:
      process.env.MODE === Mode.Production ||
      (config?.bundlerConfig?.splitting ?? false),
    sourcemap:
      process.env.MODE === Mode.Production
        ? "none"
        : config?.bundlerConfig?.sourcemap ?? "inline",
    format: config?.bundlerConfig?.format ?? "esm",
    plugins: config?.plugins ?? [],
  }

  return appConfig
}

const readPostCSSConfig = async () => {
  const { exists, filePath } = findConfig(__POSTCSS_CONFIG_NAME__)
  if(!exists) return undefined
  console.log("[  info  ] found PostCSS config")

  console.time("✅ PostCSS config loaded\n")
  const postCSSConfigFile = require(filePath)
  postCSSConfigFile.plugins = Object.entries(postCSSConfigFile.plugins).map(
    ([name, options]) => {
      const plugin = require(path.resolve("node_modules/" + name))
      return plugin(options)
    }
  )
  console.timeEnd("✅ PostCSS config loaded\n")
  return postCSSConfigFile
}

export { isValidMode, readConfig, readPostCSSConfig }
