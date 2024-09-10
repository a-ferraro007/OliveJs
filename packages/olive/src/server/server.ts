import fs from "node:fs/promises";
import { sep, resolve } from "node:path";
import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
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
	async listen(mode: Mode, callback: () => void, options?: any) {
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

		/**
		 * TODO: use esbuild watch?
		 */
		w.startWatcher();
		this.BundlerEmitter = b.emitter;
		await b.bundle();
		return this.openServerV2(this.config.port ?? 3000, mode, options);
	}

	private async listFiles(dir: string) {
		const files = await fs.readdir(dir);
		return (
			await Promise.all(
				files.map(async (name): Promise<string[]> => {
					console.log({ name });
					const file = dir + sep + name;
					const stats = await fs.stat(file);
					if (stats?.isDirectory()) {
						return this.listFiles(file);
					}
					return [resolve(dir, file)];
				}),
			)
		).flat();
	}
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	private openServerV2(port: string | number, mode: Mode, options?: any): any {
		new Elysia()
			.use(staticPlugin())
			.derive(async ({ request, set, error }) => {
				const path = request.url.replace(__BASE_URL__, "");
				if (path === "/") {
					set.headers["content-type"] = "text/html; charset=utf8";
					return {
						res: Bun.file(`${this.config.outDir}/index.html`),
					};
				}
				if (!(await fs.exists(path.slice(1, path.length)))) {
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
}
