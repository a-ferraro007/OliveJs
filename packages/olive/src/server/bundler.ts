import { BuildArtifact } from "bun"
import {EventEmitter} from "node:events"
import {  Mode, OliveConfig } from "../../types"

class Bundler extends EventEmitter {
  private config: OliveConfig
  private mode: Mode
  emitter: EventEmitter
  
  constructor(config: OliveConfig) {
    super()
    this.mode = config.mode
    this.config = config
    this.emitter = this
  }

  bundle = async () => {
    try {
      const build = await Bun.build({
        
        entrypoints: this.createEntryPoints(),
        outdir: `./${this.config.outDir}`,
        naming: "[dir]/[name]-[hash].[ext]",
        splitting: this.config.splitting,
        format: this.config.format,
        sourcemap: this.config.sourcemap
      })

      if (!build.success) {
        console.error("Build failed")
        for (const message of build.logs) {
          console.error(message)
        }
      }
      
      const jsBuildHash = build?.outputs[0].hash
      const cssBuildHash = build?.outputs.find((artifact: BuildArtifact) =>{
        return artifact.path.includes('css')
      })?.hash

      if (!jsBuildHash || !cssBuildHash) return

      const html = this.buildHTMLDocument(jsBuildHash, cssBuildHash, this.config.sourcemap === 'external')
      Bun.write(`${this.config.outDir}/index.html`, html)
      if(this.mode === Mode.Development) this.emitter.emit('bundle', build )
      return build
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  private buildHTMLDocument = (jsHash: string, cssHash: string, sourcemap: boolean) => {
    const outDir = this.mode === Mode.Development ? `/${this.config.outDir}` : ''
    return `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="manifest" href="${outDir}/manifest.json">
                <link rel="shortcut icon" href="${outDir}/favicon.ico">

                <title>Your React App Title</title>

                <link rel="stylesheet" type="text/css" href="${outDir}/styles-${cssHash}.css" />
                <script type="module" src="${outDir}/index-${jsHash}.js"></script>
                ${sourcemap ? `<script type="application/json" src="${outDir}/index-${jsHash}.js.map"></script>` : ''}
                ${this.mode === Mode.Development ? `<script type="module" src="/${this.config.outDir}/client.js"></script>` : ''}
            </head>
            <body>
                <noscript>You need to enable JavaScript to run this app.</noscript>
                <div id="root"></div>
            </body>
        </html>`
  }

  private createEntryPoints = () => {
    const {entrypoints, appDirectory} = this.config
    return entrypoints.map((entry) => {
      const s = entry.replace(/\//g, '')
      return `${appDirectory}/${s}`
    })    
  }
}

export { Bundler }