import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
	chmod,
	cp,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createAndActivateBaseline } from "../../scripts/lib/rehearsal/baseline_artifact.mjs";
import { readMigrationFileInventory } from "../../scripts/lib/rehearsal/migration_history.mjs";

const execute = promisify(execFile);
const fixtureRoot = join(process.cwd(), "tests/fixtures/rehearsal-project");
const cliPath = join(
	process.cwd(),
	"scripts/operations/rehearsal/rehearsal_cli.mjs",
);
const configurationUrl = pathToFileURL(
	join(process.cwd(), "scripts/lib/rehearsal/configuration.mjs"),
).href;
const roots = [];

const makeTreeWritable = async (path) => {
	await chmod(path, 0o700).catch(() => undefined);
	for (const entry of await readdir(path, { withFileTypes: true }).catch(
		() => [],
	)) {
		const child = join(path, entry.name);
		if (entry.isDirectory()) await makeTreeWritable(child);
		else if (!entry.isSymbolicLink()) await chmod(child, 0o600);
	}
};

const hashTree = async (root) => {
	const hashes = [];
	const walk = async (directory) => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) await walk(path);
			else if (!entry.isSymbolicLink()) {
				hashes.push(
					`${path.slice(root.length + 1)}:${createHash("sha256")
						.update(await readFile(path))
						.digest("hex")}`,
				);
			}
		}
	};
	await walk(root);
	return hashes.sort();
};

const createProject = async () => {
	const root = await mkdtemp(join(tmpdir(), "rehearsal-independent-fixture-"));
	roots.push(root);
	await cp(fixtureRoot, root, { recursive: true });
	const configPath = join(root, "rehearsal.config.mjs");
	await writeFile(
		configPath,
		(await readFile(configPath, "utf8")).replace(
			'"../../../scripts/lib/rehearsal/configuration.mjs"',
			JSON.stringify(configurationUrl),
		),
	);
	const historicalFilename = "20260101000000_create_widgets.sql";
	const historicalContent = await readFile(
		join(root, "supabase/migrations", historicalFilename),
		"utf8",
	);
	const inventory = await readMigrationFileInventory(
		new URL("./", pathToFileURL(`${join(root, "supabase/migrations")}/`)),
	);
	await createAndActivateBaseline({
		artifactRoot: join(root, ".rehearsal"),
		generationId: "20260101T000000Z-aaaaaaaaaaaa",
		records: (
			await readFile(join(root, "rehearsal/sanitized-data.ndjson"), "utf8")
		)
			.trim()
			.split("\n")
			.map(JSON.parse),
		metadata: {
			migrationCutoff: "20260101000000",
			migrationHistorySha256: "a".repeat(64),
			sanitizationPolicySha256: "b".repeat(64),
		},
		expectedTables: ["widgets"],
		migrationFiles: [
			{
				...inventory.find((entry) => entry.filename === historicalFilename),
				content: historicalContent,
			},
		],
	});
	return root;
};

afterEach(async () => {
	for (const root of roots.splice(0)) {
		await makeTreeWritable(root);
		await rm(root, { recursive: true, force: true });
	}
});

describe("independent Rehearsal fixture", () => {
	it("uses the public config and CLI plan without BlendCalc schema knowledge or mutations", async () => {
		const root = await createProject();
		const before = await hashTree(root);
		const explain = JSON.parse(
			(
				await execute(process.execPath, [cliPath, "explain", "--json"], {
					cwd: root,
				})
			).stdout,
		);
		const dryRun = JSON.parse(
			(
				await execute(
					process.execPath,
					[cliPath, "run", "--dry-run", "--json"],
					{ cwd: root },
				)
			).stdout,
		);

		expect(explain.data).toEqual(dryRun.data);
		expect(explain.data.config.project).toBe("rehearsal-fixture-project");
		expect(explain.data.baseline.rowCount).toBe(1);
		expect(explain.data.migrations.candidateCount).toBe(1);
		expect(await hashTree(root)).toEqual(before);
	});

	it("rejects modified represented history before any runtime action", async () => {
		const root = await createProject();
		await writeFile(
			join(root, "supabase/migrations/20260101000000_create_widgets.sql"),
			await readFile(
				join(root, "broken/20260101000100_modified_history.sql"),
				"utf8",
			),
		);
		await expect(
			execute(process.execPath, [cliPath, "explain", "--json"], {
				cwd: root,
			}),
		).rejects.toMatchObject({ code: 6 });
	});
});
