export enum Mode {
	Development = "development",
	Production = "production",
}

export enum ImportMethod {
	Require = "require",
	Import = "import",
}

export type BundlerConfig = {
	outDir: string;
	minify: boolean;
	splitting: boolean;
	sourcemap: "none" | "inline" | "external" | undefined;
	format: string;
	plugins: string[];
};

export type WatcherConfig = {
	mode: string;
	buildDir: string;
	rootDir: string;
};

export type OliveConfig = {
	port: number;
	mode: Mode;
	buildDir: string;
	rootDir: string;
	entrypoints: string[];
	publicPath: string;
	outDir: string;
	minify: boolean;
	splitting: boolean;
	sourcemap: "none" | "inline" | "external" | undefined;
	format: "esm" | undefined;
	enableSPA: boolean;
	plugins: string[];
	inlineScript: string;
	// biome-ignore lint/suspicious/noExplicitAny: <probably going remove>
	bundlerConfig?: Record<string, any>;
};
