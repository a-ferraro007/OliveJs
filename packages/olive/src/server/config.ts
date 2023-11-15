import path from "path"
import fs from "node:fs"
import { pathToFileURL } from "bun"
import { Mode, OliveConfig } from "../../types"

const __CONFIG_FILE_NAME__ = "olive.config.js"

const isValidMode = (mode: Mode | undefined): boolean =>  { 
    return  mode === Mode.Development || mode === Mode.Production
  }

  const readConfig = async () => {
    let appConfig: OliveConfig
    const rootDir = path.resolve(process.cwd())
    const filePath = path.join(rootDir, __CONFIG_FILE_NAME__)
  
    if (!fs.existsSync(filePath)) throw new Error("Error: olive config file not found")
  
    const stat = fs.statSync(filePath)
    const file = await import(pathToFileURL(filePath).href + "?=" + stat.mtimeMs)
    const config = file?.default
    if(!isValidMode(process.env.MODE as Mode)) {
      throw new Error("Error: invalid mode")
    }
  
    appConfig = {
        port: config?.port ?? 3000, 
        mode: process.env.MODE as Mode,
        buildDirectory: process.env.MODE === Mode.Production ? "build" : (config?.buildDirectory ?? "dist"),
        appDirectory: config?.appDirectory ?? "app",
        entrypoints: config?.entrypoints,
        publicPath: config?.publicPath ?? "/dist/", 
        outDir: process.env.MODE === Mode.Production ? "build" : (config?.buildDirectory ?? "dist"),
        minify: process.env.MODE === Mode.Production || config?.bundlerConfig?.minify === true, 
        splitting: process.env.MODE === Mode.Production || config?.bundlerConfig?.splitting === true, 
        sourcemap: process.env.MODE === Mode.Production ? 'none' : (config?.bundlerConfig?.sourcemap ?? 'inline' ), 
        format: config?.bundlerConfig?.format ?? 'esm', 
        plugins: config?.plugins ?? []
    }
  
    return appConfig
  }
  
  export {
    isValidMode, 
    readConfig
  }