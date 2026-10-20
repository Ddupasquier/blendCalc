import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { resolve } from "node:path";
import { once } from "node:events";
import { stripVTControlCharacters } from "node:util";
import {
	LOCAL_HTTP_HEADER_BYTES,
	localViteNodeArguments,
} from "../../scripts/operations/environment/run_local_vite.mjs";
import { createCleanProcessEnvironment } from "../../scripts/lib/environment/runtime_environment.mjs";

const get = (origin, cookieBytes) =>
	new Promise((resolveResponse, reject) => {
		const req = request(
			origin,
			{ headers: { cookie: `synthetic=${"x".repeat(cookieBytes)}` } },
			(response) => {
				let body = "";
				response.on("data", (chunk) => (body += chunk));
				response.on("end", () =>
					resolveResponse({ status: response.statusCode, body }),
				);
			},
		);
		req.on("error", reject);
		req.end();
	});

describe("local Vite HTTP headers", () => {
	it("rejects commands that do not start a local server", () => {
		expect(() => localViteNodeArguments(["build"])).toThrow("dev or preview");
	});

	it.each(["dev", "preview"])(
		"%s accepts shared localhost cookies and keeps a finite parser limit",
		async (command) => {
			mkdirSync(".cache", { recursive: true });
			const directory = mkdtempSync(resolve(".cache/vite-header-test-"));
			const html = "<html><body>Local header fixture</body></html>";
			writeFileSync(`${directory}/index.html`, html);
			mkdirSync(`${directory}/dist`);
			writeFileSync(`${directory}/dist/index.html`, html);
			const config = `${directory}/vite.fixture.config.mjs`;
			writeFileSync(
				config,
				`export default { root: ${JSON.stringify(directory)}, server: { port: 0, strictPort: true }, preview: { port: 0, strictPort: true } };`,
			);
			const child = spawn(
				process.execPath,
				localViteNodeArguments([
					command,
					"--config",
					config,
					"--host",
					"127.0.0.1",
					"--strictPort",
				]),
				{
					cwd: directory,
					env: createCleanProcessEnvironment(),
					stdio: ["ignore", "pipe", "pipe"],
				},
			);
			try {
				const origin = await new Promise((resolveOrigin, reject) => {
					let output = "";
					const timer = setTimeout(
						() => reject(new Error(`Vite startup timed out: ${output}`)),
						20_000,
					);
					const finish = (error, url) => {
						clearTimeout(timer);
						if (error) reject(error);
						else resolveOrigin(url);
					};
					child.on("error", (error) => finish(error));
					child.on("exit", (code) =>
						finish(new Error(`Vite exited ${code}: ${output}`)),
					);
					child.stderr.on("data", (chunk) => (output += chunk));
					child.stdout.on("data", (chunk) => {
						output += chunk;
						const url = stripVTControlCharacters(output).match(
							/http:\/\/127\.0\.0\.1:\d+\//,
						)?.[0];
						if (url) finish(null, url);
					});
				});
				for (const bytes of [0, 20_000, LOCAL_HTTP_HEADER_BYTES - 1024]) {
					const response = await get(origin, bytes);
					expect(response.status).toBe(200);
					expect(response.body).toContain("Local header fixture");
				}
				expect((await get(origin, LOCAL_HTTP_HEADER_BYTES + 1024)).status).toBe(
					431,
				);
			} finally {
				if (child.exitCode === null && child.signalCode === null) {
					const exited = once(child, "exit");
					child.kill("SIGTERM");
					await exited;
				}
				rmSync(directory, { recursive: true, force: true });
			}
		},
		30_000,
	);
});
