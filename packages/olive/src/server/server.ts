import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import fs from "node:fs";
import { Watcher } from "./watcher";
import { Bundler } from "./bundler";
import { readConfig, readPostCSSConfig } from "./config";
import { WrappedResponse } from "./wrapped-response";
import { Chain } from "./chain";
import type { Server as BunServer } from "bun";
import type { EventEmitter } from "node:events";
import { type Middleware, Mode, type OliveConfig } from "../../types";

export async function server() {
	return Server.instance;
}

const __BASE_URL__ = "http://localhost:3000";

class Server {
	private static server?: Server;
	private readonly middlewares: Middleware[] = [];
	BundlerEmitter?: EventEmitter;
	config!: OliveConfig;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	postCSSConfig: any;

	constructor() {
		if (Server.server) {
			throw new Error("Do not use constructor");
		}
		Server.server = this;
	}

	static get instance() {
		if (Server.server) return Server.server;
		return (async () => {
			Server.server = new Server();
			try {
				Server.server.config = await readConfig();
				Server.server.postCSSConfig = await readPostCSSConfig();
				return Server.server;
			} catch (error) {
				console.error(error);
				throw error;
			}
		})();
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	listen(mode: Mode, callback: () => void, options?: any) {
		if (callback) callback();
		const b = new Bundler(this.config, this.postCSSConfig);
		const w = new Watcher(
			{
				mode: mode,
				buildDir: this.config.buildDir,
				rootDir: this.config.rootDir,
			},
			b,
		);

		this.BundlerEmitter = b.emitter;
		b.bundle();
		w.startWatcher();
		return this.openServerV2(this.config.port ?? 3000, mode, options);
	}

	private async writeClientFolder() {
		const path = await import.meta.resolve("../client/client.js");
		Bun.write("public/client.js", Bun.file(path));
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	private openServerV2(port: string | number, mode: Mode, options?: any): any {
		this.writeClientFolder();
		new Elysia()
			.use(staticPlugin())
			.derive(({ request, error, set }) => {
				const path = request.url.replace(__BASE_URL__, "");
				if (path === "/") {
					set.headers["content-type"] = "text/html; charset=utf8";
					return {
						res: Bun.file(`${this.config.buildDir}/index.html`),
					};
				}
				if (!fs.existsSync(path.slice(1, path.length))) {
					return { res: error(404, "Route not found") };
				}
				return { res: Bun.file(path.slice(1, path.length)) };
			})
			.get("*", ({ res }) => res)
			.ws("/__live_reload_ws__", {
				open: async (ws) => {
					this.BundlerEmitter?.addListener("bundle", () => {
						ws.send("reload");
					});
				},
				message: () => {},
			})
			.onError(({ code }) => {
				if (code === "NOT_FOUND") console.error("Route not found :(");
			})
			.listen({
				port,
				development: mode === Mode.Development,
			});
	}

	/**
	 * @deprecated Use Elysia based openServerV2 instead
	 */
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	private openServer(port: string | number, mode: Mode, baseUrl: string, options?: any): BunServer {
		const _this = this;
		_this.middlewares.push({
			path: "/",
			middlewareFunc: this.baseMiddleware,
		});

		return Bun.serve({
			port,
			development: mode === Mode.Development,
			websocket: {
				open: async (ws) => {
					this.BundlerEmitter?.addListener("bundle", () => {
						ws.send("reload");
					});
				},
				message: () => {},
			},
			async fetch(req) {
				const path = req.url.replace(__BASE_URL__, "");
				if (path === "/__live_reload_ws__" && _this.config.mode === Mode.Development) {
					const upgraded = this.upgrade(req);
					if (!upgraded) {
						return new Response("Failed to upgrade websocket connection for live reload", { status: 400 });
					}
				}

				const res = new WrappedResponse();
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				const chain = new (Chain as any)(req, res, _this.middlewares);
				await chain.next();
				if (res.isReady()) return res.getResponse();
				if (!chain.isFinished()) throw new Error("Please call next() at the end of your middleware");
				return res.getResponse();
			},
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	baseMiddleware = async (req: Request, res: WrappedResponse, next: any) => {
		const path = req.url.replace(__BASE_URL__, "");
		if (this.config.mode === Mode.Development) {
			const path = await import.meta.resolve("../client/client.js");
			res.send(Bun.write(`${this.config.buildDir}/client.js`, Bun.file(path)));
		}

		if (path === "/") {
			res.send(Bun.file(`${this.config.buildDir}/index.html`));
			next();
			return;
		}

		if (!fs.existsSync(path.slice(1, path.length))) {
			res.send404();
			next();
			return;
		}

		const file = Bun.file(path.slice(1, path.length));
		res.send(file);
		next();
	};
}
