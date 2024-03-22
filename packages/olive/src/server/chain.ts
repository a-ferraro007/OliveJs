import { Middleware } from "./types";
import { WrappedResponse } from "./wrapped-response";

export function Chain(
	req: Request,
	res: WrappedResponse,
	middlewares: Middleware[],
) {
	this.middlewares = middlewares.map((middleware) => {
		return async (): Promise<boolean> => {
			middleware.middlewareFunc(req, res, this.next);
			return res.isReady();
		};
	});

	this.isReady = false;
	this.next = async (err: Error) => {
		if (err) {
			throw err;
		}

		if (this.isFinished()) {
			return;
		}

		const curr = this.middlewares.shift();
		const currResp = curr();
		if (currResp instanceof Promise) {
			this.ready = await currResp;
		} else {
			this.isReady = currResp;
		}

		if (this.isReady) {
			return;
		}
	};

	this.isFinished = () => {
		return this.middlewares.length === 0;
	};
}
