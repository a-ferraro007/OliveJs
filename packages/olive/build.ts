import fs from "node:fs"
import path from "path"
import { Bundler } from "./src/server/bundler"
import { readConfig, readPostCSSConfig } from "./src/server/config"


;(async () => {
  console.log("\n🫒 olive prod\n")
  const config = await readConfig()
  const postcss = await readPostCSSConfig()

  const rootDir = path.resolve(process.cwd())
  const filePath = path.join(rootDir, config.buildDirectory)

  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true })
    fs.mkdirSync(filePath)
  } else {
    fs.mkdirSync(filePath)
  }

  const bundler = new Bundler(config, postcss)
  await bundler.bundle()
})()
