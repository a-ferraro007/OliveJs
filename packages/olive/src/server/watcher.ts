import chokidar from "chokidar"
import { Bundler } from "./bundler"
import fs from "node:fs"

export class Watcher {
  private opts: any
  private bundler: Bundler

  constructor(opts: any, bundler: any) {
    this.opts = opts
    this.bundler = bundler
  }

  startWatcher = () => {
    const watcher = chokidar.watch([`./${this.opts.srcDir}/**`, `./${this.opts.outDir}/*`], {
      ignored: [
        /(^|[\/\\])\../,
        "*/node_modules/**",
        `./${this.opts.outDir}/index.html`,
        `./${this.opts.outDir}/*.js`,
        `./${this.opts.outDir}/*.js.map`,
      ],
      persistent: true,
      ignoreInitial: true,
    })

    watcher.on("all", async (event, stats) => {
      this.removeStaleJSBuilds()
      console.log(`\n Change detected - ${stats}`)
      console.log("🫒 Rebuilding...")
      await this.bundler.bundle()
    })
  }

  private removeStaleJSBuilds = () => {
    const regex = /^index-[A-Za-z0-9]+\.js|index-[A-Za-z0-9]+\.js.map$/
    const files = fs.readdirSync(this.opts.outDir)
    files.forEach(
      (name) =>
        regex.test(name) && fs.unlinkSync(`./${this.opts.outDir}/${name}`)
    )
  }
}