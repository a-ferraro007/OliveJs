import fs from "node:fs"
import { Watcher } from "./watcher"
import { Bundler } from "./bundler"
import { Chain } from "./chain"
import { readConfig } from "./config"
import { EventEmitter } from "node:events"
import { Server as BunServer } from "bun"
import { Middleware, Mode, OliveConfig } from "../../types"
import { WrappedResponse } from "./wrapped-response"


export async function server() {
  return Server.instance
}

const __BASE_URL__ = "http://localhost:3000"

class Server {
  private static server?: Server
  private readonly middlewares: Middleware[] = []
  BundlerEmitter?: EventEmitter
  config!: OliveConfig

  constructor() {
    if (Server.server) {
      throw new Error("Do not use constructor")
    }
    Server.server = this
  }

  static get instance() {
    if (Server.server) return Server.server
    return (async () => {
      Server.server = new Server()
      try {
        Server.server.config = await readConfig()
        return  Server.server
      } catch (error) {
        throw(error)
      }
    })()
  }

  listen(port: string | number, callback: () => void, options?: any) {
    if (callback) callback()
    
    const b = new Bundler(this.config.bundlerConfig, this.config.mode)
    const w = new Watcher({
      mode: this.config.mode, 
      buildDirectory: this.config.buildDirectory, 
      appDirectory: this.config.appDirectory
    }, b)

    this.BundlerEmitter = b.emitter
    b.bundle()
    w.startWatcher()
    return this.openServer(port, __BASE_URL__, options)
  }
  
  async baseMiddleware(req: Request, res: WrappedResponse, next: any) {
    const path = req.url.replace(__BASE_URL__, "")
    if (this.config.mode === Mode.Development) {
      const path = await import.meta.resolve("../client/client.js")
      res.send(Bun.write(`${this.config.buildDirectory}/client.js`, Bun.file(path)))
    }

    if (path === "/") {
      res.send(Bun.file(`${this.config.buildDirectory}/index.html`))
      next()
      return
    }

    if (!fs.existsSync(path.slice(1, path.length))) {
      res.send404()
      next()
      return
    }

    const file = Bun.file(path.slice(1, path.length))
    res.send(file)
    next()
  }

  private openServer(
    port: string | number,
    baseUrl: string,
    options?: any
  ): BunServer {
    const _this = this
    this.middlewares.push({
      path: "/",
      middlewareFunc: this.baseMiddleware,
    })

    return Bun.serve({
      port,
      development: this.config.mode === Mode.Development,
      websocket: {
        open: async (ws) => {
          this.BundlerEmitter?.addListener("bundle", () => {
            ws.send("reload")
          })
        },
        message: () => {},
      },
      async fetch(req) {
        const path = req.url.replace(__BASE_URL__, "")
        if (path === "/__live_reload_ws__" && _this.config.mode === Mode.Development) {
          const upgraded = this.upgrade(req)
          if (!upgraded) {
            return new Response(
              "Failed to upgrade websocket connection for live reload",
              { status: 400 }
            )
          }
        }

        const res = new WrappedResponse()
        const chain = new (Chain as any)(req, res, _this.middlewares)
        await chain.next()
        if (res.isReady()) return res.getResponse()
        if (!chain.isFinished())
          throw new Error("Please call next() at the end of your middleware")
        return res.getResponse()
      },
    })
  }
}
