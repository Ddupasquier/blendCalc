import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageMetadata = JSON.parse(
	readFileSync(resolve("package.json"), "utf8"),
) as { scripts: Record<string, string> };
const dashboardSource = readFileSync(
	resolve("scripts/operations/quality/run_verification_dashboard.mjs"),
	"utf8",
);
const vscodeTasks = JSON.parse(
	readFileSync(resolve(".vscode/tasks.json"), "utf8"),
) as {
	tasks: Array<{
		label: string;
		command: string;
		presentation: { reveal: string; panel: string; clear: boolean };
	}>;
};
const profiles = JSON.parse(
	execFileSync(
		process.execPath,
		[
			resolve("scripts/operations/quality/run_verification_dashboard.mjs"),
			"--list",
			"--json",
		],
		{ encoding: "utf8" },
	),
) as Record<string, { stages: Array<{ id: string }> }>;

describe("visible verification dashboard", () => {
	it("keeps quick, feature, and release confidence cumulative", () => {
		expect(Object.keys(profiles)).toEqual(["quick", "feature", "release"]);
		const quickStageIds = profiles.quick.stages.map(({ id }) => id);
		const featureStageIds = profiles.feature.stages.map(({ id }) => id);
		const releaseStageIds = profiles.release.stages.map(({ id }) => id);

		expect(featureStageIds).toEqual(
			expect.arrayContaining([
				...quickStageIds,
				"build",
				"playwright-chromium",
			]),
		);
		expect(releaseStageIds).toEqual(
			expect.arrayContaining([
				...quickStageIds,
				"dependencies",
				"build",
				"database",
				"playwright-matrix",
			]),
		);
	});

	it("exposes every profile through npm and a dedicated visible terminal task", () => {
		for (const profile of ["quick", "feature", "release"]) {
			expect(packageMetadata.scripts[`verify:${profile}`]).toBe(
				`node scripts/operations/quality/run_verification_dashboard.mjs ${profile}`,
			);
			const task = vscodeTasks.tasks.find(
				({ command }) => command === `npm run verify:${profile}`,
			);
			expect(task).toMatchObject({
				presentation: {
					reveal: "always",
					panel: "dedicated",
					clear: true,
				},
			});
		}
	});

	it("keeps forced-color terminal output free of conflicting NO_COLOR warnings", () => {
		expect(dashboardSource).toContain("getChildProcessEnvironment");
		expect(dashboardSource).toContain("NO_COLOR: _ignoredNoColor");
	});
});
