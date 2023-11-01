import fs from "node:fs"
import { EventEmitter } from "node:events"
import { Server as BunServer } from "bun"
import { Watcher } from "./watcher"
import { Bundler } from "./bundler"
import { Middleware } from "./types"
import { WrappedResponse } from "./wrapped-response"
import { Chain } from "./chain"

export function server() {
  return Server.instance
}

var mediaType = {
  "text/html": "html",
  "text/plain": "plain",
  "application/json": "json",
}

const __MODE__ = "development"
const __OUTDIR__ = "dist"
const __BASE_URL__ = "http://localhost:3000"
const __BUILD_OPTS_DEV__ = {
  entrypoints: ["src/index.tsx"],
  outdir: `./${__OUTDIR__}`,
  naming: "[dir]/[name]-[hash].[ext]",
  splitting: true,
  sourcemap: 'external'
}

const __Bundler_OPTS__ = {
  mode: "development",
  outDir: __OUTDIR__,
  buildOpts: __BUILD_OPTS_DEV__,
}

const __WATCHER_OPTS__ = {
  mode: "development",
  outDir: __OUTDIR__,
  srcDir: "src",
}

class Server {
  private static server?: Server
  BundlerEmitter: EventEmitter | undefined

  constructor() {
    if (Server.server) {
      throw new Error("Do not use constructor")
    }
    Server.server = this
  }

  static get instance() {
    return Server.server ?? (Server.server = new Server())
  }

  listen(port: string | number, callback: () => void, options?: any) {
    if (callback) callback()
    const c = new Bundler(__Bundler_OPTS__)
    const w = new Watcher(__WATCHER_OPTS__, c)

    this.BundlerEmitter = c.emitter
    c.bundle()
    w.startWatcher()
    return this.openServer(port, __BASE_URL__, options)
  }

  private readonly middlewares: Middleware[] = []
  async baseMiddleware(req: Request, res: WrappedResponse, next: any) {
    const path = req.url.replace(__BASE_URL__, "")

    if (path === "/") {
      res.send(Bun.file(`${__OUTDIR__}/index.html`))
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
      development: __MODE__ === "development",
      websocket: {
        open: async (ws) => {
          this.BundlerEmitter?.addListener("bundle", (buildResult) => {
            ws.send("reload")
          })
        },
        message: () => {},
      },
      async fetch(req) {
        const path = req.url.replace(__BASE_URL__, "")
        if (path === "/__live_reload_ws__" && __MODE__ === "development") {
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
