import { WrappedResponse } from "./wrapped-response"

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
