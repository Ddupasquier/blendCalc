import { describe, expect, it } from "vitest";
import {
	assertLocalResourceSafety,
	evaluateResourceSafety,
	gibibyte,
	getMaximumSwapUsedBytes,
	inspectLocalResources,
	parseAvailableDiskBytes,
	parseMacOsSwapUsedBytes,
	parseMacOsMemoryPressure,
	parsePhysicalMemoryBytes,
	parseRelevantProcesses,
} from "../../scripts/lib/quality/resource_safety.mjs";
import { withNodeHeapLimit } from "../../scripts/operations/quality/run_with_resource_limits.mjs";

describe("local resource safety", () => {
	it("parses macOS disk, swap, and relevant process measurements", () => {
		expect(
			parseAvailableDiskBytes(
				"Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk3 100000000 100 52428800 1% /\n",
			),
		).toBe(50 * gibibyte);
		expect(
			parseMacOsSwapUsedBytes(
				"total = 10240.00M used = 8192.00M free = 2048.00M",
			),
		).toBe(8 * gibibyte);
		expect(
			parseRelevantProcesses(
				"5242880 101 /usr/local/bin/node\n1048576 102 /tmp/development-agent\n999 103 /bin/zsh\n",
				[102],
			),
		).toEqual([
			{
				residentBytes: 5 * gibibyte,
				pid: 101,
				command: "/usr/local/bin/node",
			},
		]);
	});

	it("reports each unsafe boundary without treating equality as a failure", () => {
		const safeSnapshot = {
			startupDiskFreeBytes: 50 * gibibyte,
			swapUsedBytes: 16 * gibibyte,
			processes: [{ residentBytes: 5 * gibibyte, pid: 101, command: "node" }],
		};
		expect(evaluateResourceSafety(safeSnapshot)).toEqual([]);
		expect(
			evaluateResourceSafety({
				startupDiskFreeBytes: 49 * gibibyte,
				swapUsedBytes: 17 * gibibyte,
				processes: [
					{
						residentBytes: 6 * gibibyte,
						pid: 101,
						command: "development-agent",
					},
				],
			}).map(({ kind }) => kind),
		).toEqual(["startup-disk", "swap", "process"]);
	});

	it.each([
		[8, 8],
		[16, 16],
		[32, 16],
	])("calibrates the swap budget for %i GiB RAM", (ram, maximum) => {
		const snapshot = {
			platform: "darwin",
			physicalMemoryBytes: ram * gibibyte,
			memoryPressure: "normal",
			startupDiskFreeBytes: 50 * gibibyte,
			swapUsedBytes: maximum * gibibyte,
			processes: [],
		};
		expect(getMaximumSwapUsedBytes(snapshot)).toBe(maximum * gibibyte);
		expect(evaluateResourceSafety(snapshot)).toEqual([]);
		expect(
			evaluateResourceSafety({
				...snapshot,
				swapUsedBytes: maximum * gibibyte + 1,
			}),
		).toMatchObject([{ kind: "swap", limitBytes: maximum * gibibyte }]);
	});

	it("allows this normal-pressure 16 GiB Mac with retained swap", () => {
		expect(
			assertLocalResourceSafety({
				environment: { CI: "false" },
				snapshot: {
					platform: "darwin",
					physicalMemoryBytes: 16 * gibibyte,
					memoryPressure: "normal",
					startupDiskFreeBytes: 146 * gibibyte,
					swapUsedBytes: 12 * gibibyte,
					processes: [],
				},
			}),
		).toMatchObject({ skipped: false, overridden: false, issues: [] });
	});

	it.each(["warning", "critical"])(
		"refuses new heavy work under %s pressure even with low swap",
		(memoryPressure) => {
			expect(() =>
				assertLocalResourceSafety({
					environment: {},
					snapshot: {
						platform: "darwin",
						physicalMemoryBytes: 16 * gibibyte,
						memoryPressure,
						startupDiskFreeBytes: 50 * gibibyte,
						swapUsedBytes: 0,
						processes: [],
					},
				}),
			).toThrow(`${memoryPressure} current memory pressure`);
		},
	);

	it.each([null, 0, -1, Infinity, NaN, 16.5])(
		"fails closed when physical RAM cannot be trusted: %s",
		(physicalMemoryBytes) => {
			expect(
				evaluateResourceSafety({
					platform: "darwin",
					physicalMemoryBytes,
					memoryPressure: "normal",
					startupDiskFreeBytes: 50 * gibibyte,
					swapUsedBytes: 0,
					processes: [],
				}),
			).toMatchObject([{ kind: "memory-measurement" }]);
		},
	);

	it.each([null, "", "unknown", 0, 1])(
		"fails closed when current pressure cannot be trusted: %s",
		(memoryPressure) => {
			expect(
				evaluateResourceSafety({
					platform: "darwin",
					physicalMemoryBytes: 16 * gibibyte,
					memoryPressure,
					startupDiskFreeBytes: 50 * gibibyte,
					swapUsedBytes: 0,
					processes: [],
				}),
			).toMatchObject([{ kind: "memory-measurement" }]);
		},
	);

	it("parses the exported macOS pressure flags, not the internal kernel enum", () => {
		expect(parseMacOsMemoryPressure("1\n")).toBe("normal");
		expect(parseMacOsMemoryPressure("2\n")).toBe("warning");
		expect(parseMacOsMemoryPressure("4\n")).toBe("critical");
		for (const invalid of ["", "0", "3", "5", "normal", "1.0", "01"])
			expect(parseMacOsMemoryPressure(invalid)).toBeNull();
		expect(parsePhysicalMemoryBytes("17179869184\n")).toBe(16 * gibibyte);
		for (const invalid of ["", "0", "-1", "16G", "1.5", "1e9", "NaN"])
			expect(parsePhysicalMemoryBytes(invalid)).toBeNull();
	});

	it("captures live macOS hardware and pressure independently from used swap", () => {
		const snapshot = inspectLocalResources({
			platform: "darwin",
			execute: (command, args) => {
				if (command === "df")
					return "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk3 100000000 100 52428800 1% /\n";
				if (command === "ps") return "";
				return {
					"hw.memsize": "17179869184\n",
					"kern.memorystatus_vm_pressure_level": "1\n",
					"vm.swapusage": "total = 16384.00M used = 12288.00M free = 4096.00M",
				}[args[1]];
			},
		});
		expect(snapshot).toMatchObject({
			physicalMemoryBytes: 16 * gibibyte,
			memoryPressure: "normal",
			swapUsedBytes: 12 * gibibyte,
		});
		expect(evaluateResourceSafety(snapshot)).toEqual([]);
	});

	it.each([null, NaN, Infinity, -1])(
		"refuses unmeasurable startup space or swap: %s",
		(invalid) => {
			const snapshot = {
				platform: "darwin",
				physicalMemoryBytes: 16 * gibibyte,
				memoryPressure: "normal",
				startupDiskFreeBytes: 50 * gibibyte,
				swapUsedBytes: 0,
				processes: [],
			};
			expect(
				evaluateResourceSafety({ ...snapshot, startupDiskFreeBytes: invalid }),
			).toContainEqual({ kind: "disk-measurement" });
			expect(
				evaluateResourceSafety({ ...snapshot, swapUsedBytes: invalid }),
			).toContainEqual({ kind: "memory-measurement" });
		},
	);

	it("reports an unavailable macOS measurement instead of inventing capacity", () => {
		const snapshot = inspectLocalResources({
			platform: "darwin",
			execute: (command) => {
				if (command === "df")
					return "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk3 100000000 100 52428800 1% /\n";
				if (command === "ps") return "";
				throw new Error("Metric unavailable");
			},
		});
		expect(evaluateResourceSafety(snapshot)).toMatchObject([
			{ kind: "memory-measurement" },
		]);
	});

	it("inspects the parent process instead of exempting an existing Node wrapper", () => {
		const snapshot = inspectLocalResources({
			platform: "linux",
			execute: (command) =>
				command === "df"
					? "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk3 100000000 100 52428800 1% /\n"
					: `5242880 ${process.ppid} /usr/local/bin/node\n`,
		});
		expect(snapshot.processes).toEqual([
			{
				residentBytes: 5 * gibibyte,
				pid: process.ppid,
				command: "/usr/local/bin/node",
			},
		]);
	});

	it("blocks unsafe local runs but allows explicit overrides and CI", () => {
		const snapshot = {
			startupDiskFreeBytes: 49 * gibibyte,
			swapUsedBytes: 0,
			processes: [],
		};
		expect(() =>
			assertLocalResourceSafety({ environment: {}, snapshot }),
		).toThrow("Startup disk has 49.0 GiB free");
		expect(
			assertLocalResourceSafety({
				environment: { BLENDCALC_ALLOW_RESOURCE_PRESSURE: "1" },
				snapshot,
			}),
		).toMatchObject({ overridden: true, issues: [{ kind: "startup-disk" }] });
		expect(
			assertLocalResourceSafety({ environment: { CI: "true" }, snapshot }),
		).toMatchObject({ skipped: true, issues: [] });
	});

	it("adds one bounded Node heap option and clamps oversized existing limits", () => {
		expect(withNodeHeapLimit("--trace-warnings")).toBe(
			"--trace-warnings --max-old-space-size=4096",
		);
		expect(withNodeHeapLimit("--max-old-space-size=2048")).toBe(
			"--max-old-space-size=2048",
		);
		expect(withNodeHeapLimit("--max-old-space-size=8192")).toBe(
			"--max-old-space-size=4096",
		);
		expect(withNodeHeapLimit("--max_old_space_size=6144")).toBe(
			"--max-old-space-size=4096",
		);
		expect(
			withNodeHeapLimit(
				"--trace-warnings --max-old-space-size 3072 --no-warnings",
			),
		).toBe("--trace-warnings --no-warnings --max-old-space-size=3072");
	});
});
