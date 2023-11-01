import {EventEmitter} from "node:events"

class Bundler extends EventEmitter {
  private opts: any
  emitter: EventEmitter
  
  constructor(opts: any) {
    super()
    this.opts = opts
    this.emitter = this
  }

  bundle = async () => {
    try {
      const buildResult = await Bun.build({
        entrypoints: [`./src/index.tsx`],
        outdir: `./${this.opts.outDir}`,
        naming: "[dir]/[name]-[hash].[ext]",
        splitting: true,
        format: 'esm',
        sourcemap: 'external'
      })
      if (!buildResult.success) {
        console.error("Build failed")
        for (const message of buildResult.logs) {
          console.error(message)
        }
      }

      const buildHash = buildResult?.outputs[0].hash
      if (!buildHash) return

      const html = this.buildHTMLDocument(buildHash, this.opts.buildOpts.sourcemap === 'external')
      Bun.write(`${this.opts.outDir}/index.html`, html)
      this.emitter.emit('bundle', buildResult )
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  private buildHTMLDocument = (hash: string, sourcemap: boolean) => {
    return `
    <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="manifest" href="/out/manifest.json">
                <link rel="shortcut icon" href="/out/favicon.ico">
                <title>Your React App Title</title>
            </head>
            <body>
                <div id="root"></div>
                <script type="module" src="/${this.opts.outDir}/index-${hash}.js"></script>
               ${ sourcemap && `<script type="module" src="/${this.opts.outDir}/index-${hash}.js.map"></script>`}
                <script type="module" src="/${this.opts.outDir}/client.js"></script>
            </body>
        </html>`
  }
}

export { Bundler }