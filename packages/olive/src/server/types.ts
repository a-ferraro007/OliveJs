import type { WrappedResponse } from "./wrapped-response";

export type Handler = (
	req: Request,
	res: WrappedResponse,
	// biome-ignore lint/complexity/noBannedTypes: <Deprecated>
	next?: (err?: Error) => {},
	// biome-ignore lint/suspicious/noExplicitAny: <Deprecated>
	// biome-ignore lint/suspicious/noConfusingVoidType: <Deprecated>
) => void | Promise<any>;

export type RequestHandler = (path: string, ...handlers: Handler[]) => void;

export interface RequestMethod {
	get: RequestHandler;
	post: RequestHandler;
	put: RequestHandler;
	patch: RequestHandler;
	delete: RequestHandler;
	options: RequestHandler;
	head: RequestHandler;
}

export interface Middleware {
	path: string;
	middlewareFunc: Handler;
}
