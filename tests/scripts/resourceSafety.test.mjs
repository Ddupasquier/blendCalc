import { describe, expect, it } from "vitest";
import {
	assertLocalResourceSafety,
	evaluateResourceSafety,
	gibibyte,
	inspectLocalResources,
	parseAvailableDiskBytes,
	parseMacOsSwapUsedBytes,
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
			swapUsedBytes: 8 * gibibyte,
			processes: [{ residentBytes: 4 * gibibyte, pid: 101, command: "node" }],
		};
		expect(evaluateResourceSafety(safeSnapshot)).toEqual([]);
		expect(
			evaluateResourceSafety({
				startupDiskFreeBytes: 49 * gibibyte,
				swapUsedBytes: 9 * gibibyte,
				processes: [
					{
						residentBytes: 5 * gibibyte,
						pid: 101,
						command: "development-agent",
					},
				],
			}).map(({ kind }) => kind),
		).toEqual(["startup-disk", "swap", "process"]);
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
