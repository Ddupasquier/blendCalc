import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const factoryUrl = pathToFileURL(
	resolve("src/lib/server/ocr/createOwnedTesseractWorker.server.ts"),
).href;

describe("owned server OCR worker lifecycle", () => {
	let directory: string;
	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), "blendcalc-ocr-worker-test-"));
	});
	afterEach(() => rmSync(directory, { recursive: true, force: true }));

	const run = (body: string) =>
		spawnSync(
			process.execPath,
			[
				"--input-type=module",
				"-e",
				`import { createOwnedTesseractWorker } from ${JSON.stringify(factoryUrl)};
import assert from "node:assert/strict";
${body}`,
			],
			{ encoding: "utf8", timeout: 10_000 },
		);

	for (const scenario of ["missing", "corrupt"] as const) {
		it(`rejects ${scenario} real language data, keeps HTTP alive, and leaves no threads`, () => {
			if (scenario === "corrupt") {
				writeFileSync(join(directory, "eng.traineddata"), "invalid-model");
			}
			const result = run(`
import { createServer } from "node:http";
const server = createServer((_, response) => response.end("alive"));
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  await assert.rejects(createOwnedTesseractWorker({
    langPath: ${JSON.stringify(directory)}, cachePath: ${JSON.stringify(directory)},
    cacheMethod: "none", gzip: false,
  }), { message: /^ocr-worker-(?:host-)?failed$/ });
  const response = await fetch("http://127.0.0.1:" + server.address().port);
  assert.equal(await response.text(), "alive");
} finally { await new Promise(resolve => server.close(resolve)); }
console.log("survived");
`);
			expect(result.error).toBeUndefined();
			expect(result.status, result.stderr).toBe(0);
			expect(result.stdout.trim()).toBe("survived");
		});
	}

	const createControlledEngine = (action: string) => {
		const workerPath = join(directory, "engine.cjs");
		writeFileSync(
			workerPath,
			`const { parentPort } = require("node:worker_threads");
parentPort.on("message", ({ workerId, jobId, action }) => {
  ${action}
  parentPort.postMessage({ workerId, jobId, action, status: "resolve",
    data: action === "recognize" ? { text: "fixture", confidence: 90 } : {} });
});`,
		);
		return workerPath;
	};

	it("recovers after failure and serially reuses a live installed-library worker", () => {
		const workerPath = createControlledEngine("");
		const result = run(`
const options = { workerPath: ${JSON.stringify(workerPath)} };
await assert.rejects(createOwnedTesseractWorker({
  langPath: ${JSON.stringify(directory)}, cacheMethod: "none", gzip: false,
}), { message: /^ocr-worker-(?:host-)?failed$/ });
const worker = await createOwnedTesseractWorker(options);
await worker.setParameters({ tessedit_pageseg_mode: "11" });
assert.equal((await worker.recognize(new Uint8Array([1]))).data.text, "fixture");
assert.equal((await worker.recognize(new Uint8Array([2]))).data.confidence, 90);
await worker.terminate();
await worker.terminate();
await assert.rejects(worker.recognize(new Uint8Array([1])), /ocr-worker-closed/);
console.log("recovered");
`);
		expect(result.error).toBeUndefined();
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout.trim()).toBe("recovered");
	});

	it("terminates initialization that never responds at its deadline", () => {
		const workerPath = createControlledEngine(
			'if (action === "initialize") return;',
		);
		const result = run(`
await assert.rejects(createOwnedTesseractWorker({
 workerPath: ${JSON.stringify(workerPath)},
}, 300), /ocr-timeout/);
console.log("bounded");
`);
		expect(result.error).toBeUndefined();
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout.trim()).toBe("bounded");
	});

	it("rejects failed recognition without engine chatter or an orphaned worker", () => {
		const workerPath = createControlledEngine(`if (action === "recognize") {
  console.error("private-recognized-text");
  parentPort.postMessage({ workerId, jobId, action, status: "reject", data: "private-recognized-text" });
  return;
}`);
		const result = run(`
const worker = await createOwnedTesseractWorker({ workerPath: ${JSON.stringify(workerPath)} });
await assert.rejects(worker.recognize(new Uint8Array([1])), /ocr-worker-failed/);
await worker.terminate();
console.log("safe-failure");
`);
		expect(result.error).toBeUndefined();
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout.trim()).toBe("safe-failure");
		expect(result.stderr).not.toContain("private-recognized-text");
	});

	it("contains an engine thread error, keeps HTTP alive, and sanitizes host failures", () => {
		const workerPath = createControlledEngine(
			'if (action === "recognize") throw new Error("private-engine-error");',
		);
		const result = run(`
import { createServer } from "node:http";
const server = createServer((_, response) => response.end("alive"));
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const worker = await createOwnedTesseractWorker({ workerPath: ${JSON.stringify(workerPath)} });
  await assert.rejects(worker.recognize(new Uint8Array([1])), { message: "ocr-worker-host-failed" });
  await worker.terminate();
  const response = await fetch("http://127.0.0.1:" + server.address().port);
  assert.equal(await response.text(), "alive");
} finally { await new Promise(resolve => server.close(resolve)); }
console.log("host-failure-contained");
`);
		expect(result.error).toBeUndefined();
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout.trim()).toBe("host-failure-contained");
		expect(result.stderr).not.toContain("private-engine-error");
	});

	it("bounds pending work and cancellation releases stalled recognition", () => {
		const workerPath = createControlledEngine(
			'if (action === "recognize") return;',
		);
		const result = run(`
const worker = await createOwnedTesseractWorker({ workerPath: ${JSON.stringify(workerPath)} });
const recognition = worker.recognize(new Uint8Array([1]));
const cancelled = assert.rejects(recognition, /ocr-worker-closed/);
await assert.rejects(worker.recognize(new Uint8Array([2])), /ocr-worker-busy/);
await worker.terminate();
await cancelled;
console.log("cancelled");
`);
		expect(result.error).toBeUndefined();
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout.trim()).toBe("cancelled");
	});

	it("cleans up competing failures in the same purpose-owned language cache", () => {
		const result = run(`
const options = { langPath: ${JSON.stringify(directory)}, cachePath: ${JSON.stringify(directory)}, cacheMethod: "none", gzip: false };
await Promise.all([0, 1].map(() => assert.rejects(createOwnedTesseractWorker(options), { message: /^ocr-worker-(?:host-)?failed$/ })));
console.log("concurrent-failures-contained");
`);
		expect(result.error).toBeUndefined();
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout.trim()).toBe("concurrent-failures-contained");
	});

	it("rejects an uncloneable request without leaving a later unhandled rejection", () => {
		const workerPath = createControlledEngine("");
		const result = run(`
const worker = await createOwnedTesseractWorker({ workerPath: ${JSON.stringify(workerPath)} });
await assert.rejects(worker.recognize({ invalid: () => undefined }), /ocr-worker-request-failed/);
await worker.terminate();
console.log("invalid-request-contained");
`);
		expect(result.error).toBeUndefined();
		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout.trim()).toBe("invalid-request-contained");
	});
});
