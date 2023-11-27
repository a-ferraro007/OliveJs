import chokidar from "chokidar"
import { Bundler } from "./bundler"
import fs from "node:fs"
import path from "path"
import { WatcherConfig } from "../../types"

export class Watcher {
  private config: WatcherConfig
  private bundler: Bundler

  constructor(config: any, bundler: any) {
    this.config = config
    this.bundler = bundler
  }

  // `./${this.config.buildDirectory}/*`
  startWatcher = () => {
    this.resetbuildDirectory()
    const watcher = chokidar.watch([`./${this.config.appDirectory}/**`], {
      ignored: [
        /(^|[\/\\])\../,
        "*/node_modules/**",
        `./${this.config.buildDirectory}/index.html`,
        `./${this.config.buildDirectory}/*.js`,
        `./${this.config.buildDirectory}/*.js.map`,
        `./${this.config.buildDirectory}/*.css`
      ],
      persistent: true,
      ignoreInitial: true,
    })

    watcher.on("all", async (_, stats) => {
      this.resetbuildDirectory()
      this.bundler.stats = stats
      await this.bundler.bundle()
    })
  }

  private resetbuildDirectory = () => {
    const outPath = path.resolve(this.config.buildDirectory)
    try {
      fs.rmSync(outPath, { recursive: true })
      fs.mkdirSync(outPath)
    } catch (e) {
      console.log(e)
    }
  }

  private removeStaleJSBuilds = () => {
    const regex = /^index-[A-Za-z0-9]+\.js|index-[A-Za-z0-9]+\.js.map$/
    const files = fs.readdirSync(this.config.buildDirectory)
    files.forEach(
      (name) =>
        regex.test(name) && fs.unlinkSync(`./${this.config.buildDirectory}/${name}`)
    )
  }

  private removeStaleCSSBuilds = () => {
    const regex = /^styles-[A-Za-z0-9]+\.css$/
    const files = fs.readdirSync(this.config.buildDirectory)
    files.forEach(
      (name) =>
        regex.test(name) && fs.unlinkSync(`./${this.config.buildDirectory}/${name}`)
    )
  }
}