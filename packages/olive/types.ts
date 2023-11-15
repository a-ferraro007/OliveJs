import { WrappedResponse } from "./src/server/wrapped-response"


export enum Mode {
    Development = "development",
    Production = "production",
    develop = "develop"
}

export type Handler = (
  req: Request,
  res: WrappedResponse,
  next?: (err?: Error) => {}
) => void | Promise<any>

export type RequestHandler = (path: string, ...handlers: Handler[]) => void

export interface RequestMethod {
  get: RequestHandler
  post: RequestHandler
  put: RequestHandler
  patch: RequestHandler
  delete: RequestHandler
  options: RequestHandler
  head: RequestHandler
}

export interface Middleware {
  path: string
  middlewareFunc: Handler
}

export type BundlerConfig = {
    outDir: string, 
    minify: boolean, 
    splitting: boolean, 
    sourcemap: "none" | "inline" | "external" | undefined, 
    format: string, 
    plugins: string[]
}

export type WatcherConfig = { 
  mode: string, 
  buildDirectory: string,
  appDirectory: string
}

export type OliveConfig = {
  port: number,
  mode: Mode, 
  buildDirectory: string, 
  appDirectory: string,
  entrypoints: string[], 
  publicPath: string, 
  outDir: string, 
  minify: boolean, 
  splitting: boolean, 
  sourcemap: "none" | "inline" | "external" | undefined, 
  format:  "esm" | undefined, 
  plugins: string[]
}
