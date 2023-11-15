import fs from "node:fs"
import path from "path"
import { Bundler } from "./src/server/bundler"
import { readConfig } from "./src/server/config"

(async () => {
    const config = await readConfig()
    console.log({config}) 
    const rootDir = path.resolve(process.cwd())
    const filePath = path.join(rootDir, config.buildDirectory)
  
    if (fs.existsSync(filePath)) fs.rmSync(config.buildDirectory, {recursive: true, force: true})  
    const bundler = new Bundler(config)
    bundler.bundle()
})() 