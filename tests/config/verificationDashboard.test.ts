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
	it("keeps quick, feature, release, and nightly confidence intentional", () => {
		expect(Object.keys(profiles)).toEqual([
			"quick",
			"feature",
			"release",
			"nightly",
		]);
		const quickStageIds = profiles.quick.stages.map(({ id }) => id);
		const featureStageIds = profiles.feature.stages.map(({ id }) => id);
		const releaseStageIds = profiles.release.stages.map(({ id }) => id);
		const nightlyStageIds = profiles.nightly.stages.map(({ id }) => id);

		expect(quickStageIds).toContain("vitest-affected");
		expect(featureStageIds).toEqual(
			expect.arrayContaining(["vitest-affected", "playwright-affected"]),
		);
		expect(featureStageIds).not.toContain("vitest-node");
		expect(featureStageIds).not.toContain("vitest-dom");
		expect(featureStageIds).not.toContain("build");
		expect(releaseStageIds).toEqual(
			expect.arrayContaining([
				"vitest-node",
				"vitest-dom",
				"dependencies",
				"build",
				"database",
				"playwright-matrix",
			]),
		);
		expect(nightlyStageIds).toEqual(
			expect.arrayContaining([
				"vitest-node",
				"vitest-dom",
				"dependencies",
				"build",
				"database",
				"playwright-exhaustive",
			]),
		);
	});

	it("exposes every profile through npm and a dedicated visible terminal task", () => {
		for (const profile of ["quick", "feature", "release", "nightly"]) {
			expect(packageMetadata.scripts[`verify:${profile}`]).toContain(
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
		expect(packageMetadata.scripts["verify:promotion"]).toBe(
			"node scripts/operations/quality/verify_release_promotion.mjs",
		);
		expect(
			vscodeTasks.tasks.find(
				({ command }) => command === "npm run verify:promotion",
			),
		).toMatchObject({
			presentation: {
				reveal: "always",
				panel: "dedicated",
				clear: true,
			},
		});
	});

	it("records reusable receipts only after a successful Release Check", () => {
		expect(dashboardSource).toContain("invalidateReleaseReceipt");
		expect(dashboardSource).toContain("recordReleaseReceipt");
		expect(dashboardSource).toContain('profileKey === "release"');
	});

	it("keeps forced-color terminal output free of conflicting NO_COLOR warnings", () => {
		expect(dashboardSource).toContain("getChildProcessEnvironment");
		expect(dashboardSource).toContain("NO_COLOR: _ignoredNoColor");
	});

	it("provides compile-only public configuration in clean feature worktrees", () => {
		expect(packageMetadata.scripts.check).toContain(
			"PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
		);
		expect(packageMetadata.scripts.check).toContain(
			"PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_compile_only",
		);
		expect(dashboardSource).toContain("compileOnlyPublicEnvironment");
	});
});
