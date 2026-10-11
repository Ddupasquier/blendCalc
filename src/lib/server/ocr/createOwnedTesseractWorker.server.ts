import { createRequire } from "node:module";
import { Worker as NodeWorker } from "node:worker_threads";
import type { Worker, WorkerOptions } from "tesseract.js";

export type OwnedTesseractWorker = Pick<
	Worker,
	"setParameters" | "recognize"
> & { terminate: () => Promise<void> };

const TESSERACT_OPERATION_TIMEOUT_MILLISECONDS = 30_000;
const require = createRequire(import.meta.url);

// Own the host as well as Tesseract's nested thread: createWorker can remain
// pending after a language/init rejection, before it exposes terminate().
const workerHost = String.raw`
const { parentPort, workerData } = require("node:worker_threads");
const { createWorker } = require(workerData.modulePath);
const fail = () => parentPort.postMessage({ failed: true });
createWorker("eng", 1, {
  ...workerData.options,
  logger: () => undefined,
  errorHandler: fail,
}).then(worker => {
  parentPort.on("message", async ({ method, args }) => {
    try {
      const result = await worker[method](...args);
      parentPort.postMessage({ result });
    } catch { fail(); }
  });
  parentPort.postMessage({ ready: true });
}).catch(fail);
`;

type PendingOperation = {
	resolve: (result: unknown) => void;
	reject: (error: Error) => void;
};

export const createOwnedTesseractWorker = async (
	options: Omit<Partial<WorkerOptions>, "logger" | "errorHandler">,
	timeoutMilliseconds = TESSERACT_OPERATION_TIMEOUT_MILLISECONDS,
): Promise<OwnedTesseractWorker> => {
	const host = new NodeWorker(workerHost, {
		eval: true,
		execArgv: process.execArgv.filter(
			(argument, index, arguments_) =>
				argument !== "--input-type" &&
				!argument.startsWith("--input-type=") &&
				arguments_[index - 1] !== "--input-type",
		),
		workerData: { modulePath: require.resolve("tesseract.js"), options },
		stdout: true,
		stderr: true,
	});
	// Engine chatter can include recognized text; callers report safe reason codes.
	host.stdout?.resume();
	host.stderr?.resume();
	let pending: PendingOperation | undefined;
	let deadline: ReturnType<typeof setTimeout> | undefined;
	let termination: Promise<number> | undefined;
	let closed = false;

	const terminate = async () => {
		closed = true;
		if (deadline) clearTimeout(deadline);
		termination ??= host.terminate();
		await termination;
	};
	const fail = async (reason = "ocr-worker-failed") => {
		const operation = pending;
		pending = undefined;
		await terminate();
		operation?.reject(new Error(reason));
	};
	const waitForOperation = () =>
		new Promise<unknown>((resolve, reject) => {
			pending = { resolve, reject };
			deadline = setTimeout(() => {
				void fail("ocr-timeout");
			}, timeoutMilliseconds);
		});

	host.on("message", (message: { failed?: boolean; result?: unknown }) => {
		if (message.failed) {
			void fail();
			return;
		}
		if (deadline) clearTimeout(deadline);
		const operation = pending;
		pending = undefined;
		operation?.resolve(message.result);
	});
	host.on("error", () => void fail("ocr-worker-host-failed"));
	host.on("exit", () => {
		if (!closed) void fail();
	});
	await waitForOperation();

	const request = async (method: string, args: unknown[]) => {
		if (closed) throw new Error("ocr-worker-closed");
		if (pending) throw new Error("ocr-worker-busy");
		const result = waitForOperation();
		try {
			host.postMessage({ method, args });
		} catch {
			void fail("ocr-worker-request-failed");
		}
		return result;
	};
	return {
		setParameters: (...args) =>
			request("setParameters", args) as ReturnType<Worker["setParameters"]>,
		recognize: (...args) =>
			request("recognize", args) as ReturnType<Worker["recognize"]>,
		terminate: async () => {
			await fail("ocr-worker-closed");
		},
	};
};
