/**
 * Purpose: Preview public static documentation on loopback, without app services.
 * Run: `npm run docs -- dev [--base /blendCalc/] [--port 4178]`
 * Serves generated public docs on loopback only; rebuilds when public sources change.
 * Reads no credentials and does not start the application or any database.
 */
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, watch } from "node:fs";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeBase } from "../../lib/documentation/render_markdown.mjs";

const args = process.argv.slice(2);
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
let base = "/";
let port = 4178;
for (let index = 0; index < args.length; index += 2) {
	if (args[index] === "--base") base = normalizeBase(args[index + 1]);
	else if (args[index] === "--port") port = Number(args[index + 1]);
	else
		throw new Error(
			"Usage: npm run docs -- dev [--base /blendCalc/] [--port 4178]",
		);
}
if (!Number.isInteger(port) || port < 1024 || port > 65535)
	throw new Error("Choose a port between 1024 and 65535.");
const documentationOutput = resolve(
	repositoryRoot,
	`dist/documentation-preview-${port}`,
);
const rebuildSite = () =>
	execFileSync(
		process.execPath,
		[
			resolve(
				repositoryRoot,
				"scripts/generators/documentation/build_documentation.mjs",
			),
			"--base",
			base,
			"--preview-port",
			String(port),
		],
		{ stdio: "inherit", cwd: repositoryRoot },
	);
rebuildSite();
const types = {
	".html": "text/html; charset=utf-8",
	".md": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".txt": "text/plain; charset=utf-8",
};
// Localhost cookies span ports. The unauthenticated docs server ignores them entirely;
// a bounded header allowance avoids breaking preview alongside existing app sessions.
const server = createServer(
	{ maxHeaderSize: 64 * 1024 },
	(request, response) => {
		try {
			const pathname = decodeURIComponent(
				new URL(request.url, `http://localhost:${port}`).pathname,
			);
			if (
				!pathname.startsWith(base) ||
				!["GET", "HEAD"].includes(request.method)
			)
				throw new Error("Not found");
			let path = resolve(
				documentationOutput,
				pathname.slice(base.length) || "index.html",
			);
			if (!path.startsWith(`${documentationOutput}/`))
				throw new Error("Not found");
			if (statSync(path).isDirectory()) {
				if (!pathname.endsWith("/")) {
					response.writeHead(301, { Location: `${pathname}/` });
					response.end();
					return;
				}
				path = resolve(path, "index.html");
			}
			response.writeHead(200, {
				"Content-Type": types[extname(path)] ?? "application/octet-stream",
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
			});
			response.end(request.method === "HEAD" ? undefined : readFileSync(path));
		} catch {
			response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
			response.end(readFileSync(resolve(documentationOutput, "404.html")));
		}
	},
);
server.on("error", (error) => {
	console.error(`Docs preview could not start: ${error.message}`);
	process.exitCode = 1;
	for (const watcher of watchers) watcher.close();
});
let pending;
const rebuild = (_event, filename) => {
	if (filename && /^workspace(?:\/|$)/.test(String(filename))) return;
	clearTimeout(pending);
	pending = setTimeout(() => {
		try {
			rebuildSite();
		} catch (error) {
			console.error(
				`Docs rebuild failed; fix the source and retry: ${error.message}`,
			);
		}
	}, 200);
};
const watchers = [
	"docs",
	"config/documentation",
	"scripts/lib/documentation",
	"scripts/generators/documentation",
].map((path) =>
	watch(resolve(repositoryRoot, path), { recursive: true }, rebuild),
);
for (const path of ["README.md", "scripts/README.md", "package.json"])
	watchers.push(watch(resolve(repositoryRoot, path), rebuild));
server.listen(port, "localhost", () =>
	console.log(
		`BlendCalc docs preview: http://localhost:${port}${base}\nRefresh the browser after a source change. Ctrl+C stops only this preview.`,
	),
);
for (const signal of ["SIGINT", "SIGTERM"])
	process.once(signal, () => {
		clearTimeout(pending);
		for (const watcher of watchers) watcher.close();
		server.close();
	});
