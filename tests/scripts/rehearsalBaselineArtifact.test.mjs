import {
	chmod,
	mkdtemp,
	readFile,
	readdir,
	readlink,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	createAndActivateBaseline,
	createBaselineGenerationId,
	listIncompleteBaselineBuilds,
	pruneBaselineGenerations,
	removeBaselineArtifactRoot,
	verifyActiveBaseline,
} from "../../scripts/lib/rehearsal/baseline_artifact.mjs";

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
const createArtifactRoot = async () => {
	const parent = await mkdtemp(join(tmpdir(), "blendcalc-rehearsal-test-"));
	roots.push(parent);
	return join(parent, ".rehearsal");
};
const metadata = {
	migrationCutoff: "20260911223000",
	migrationHistorySha256: "a".repeat(64),
	sanitizationPolicySha256: "b".repeat(64),
};

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map(async (root) => {
			await makeTreeWritable(root);
			await rm(root, { recursive: true, force: true });
		}),
	);
});

describe("Rehearsal baseline artifacts", () => {
	it("creates a path-safe generation identifier for arbitrary milliseconds", () => {
		expect(
			createBaselineGenerationId({ now: new Date("2026-09-12T12:00:00.321Z") }),
		).toMatch(/^20260912T120000Z-[a-f0-9]{12}$/u);
	});

	it("atomically activates and verifies an immutable sanitized generation", async () => {
		const artifactRoot = await createArtifactRoot();
		const generationId = "20260912T120000Z-aaaaaaaaaaaa";
		const result = await createAndActivateBaseline({
			artifactRoot,
			generationId,
			metadata,
			expectedTables: ["profiles", "saved_drinks"],
			records: [
				{ table: "profiles", row: { user_id: "synthetic-user" } },
				{ table: "profiles", row: { user_id: "synthetic-user-2" } },
			],
			migrationFiles: [
				{
					filename: "20260911223000_baseline.sql",
					content: "create table public.example(id bigint);\n",
				},
			],
			schemaSql:
				'CREATE SCHEMA IF NOT EXISTS "public";\nCREATE TABLE public.example(id bigint);\n',
		});

		expect(result.rowCount).toBe(2);
		expect(result.tableCounts).toEqual({ profiles: 2, saved_drinks: 0 });
		expect(await readlink(join(artifactRoot, "current"))).toBe(
			`generations/${generationId}`,
		);
		expect(await verifyActiveBaseline({ artifactRoot })).toEqual(result);
		expect(Object.keys(result.migrations)).toEqual([
			"20260911223000_baseline.sql",
		]);
		expect(result.files["production-schema.sql"]).toMatchObject({
			sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
			bytes: expect.any(Number),
		});
		expect(await listIncompleteBaselineBuilds({ artifactRoot })).toEqual([]);
	});

	it("keeps the previous active generation when a later build fails", async () => {
		const artifactRoot = await createArtifactRoot();
		await createAndActivateBaseline({
			artifactRoot,
			generationId: "20260912T120000Z-bbbbbbbbbbbb",
			metadata,
			records: [{ table: "profiles", row: { user_id: "safe" } }],
		});
		async function* failingRecords() {
			yield { table: "profiles", row: { user_id: "also-safe" } };
			throw new Error("synthetic source failed");
		}

		await expect(
			createAndActivateBaseline({
				artifactRoot,
				generationId: "20260912T120100Z-cccccccccccc",
				metadata,
				records: failingRecords(),
			}),
		).rejects.toThrow("synthetic source failed");
		expect(await readlink(join(artifactRoot, "current"))).toBe(
			"generations/20260912T120000Z-bbbbbbbbbbbb",
		);
		expect(await listIncompleteBaselineBuilds({ artifactRoot })).toEqual([]);
	});

	it("prunes only obsolete immutable generations and retains the active fallback", async () => {
		const artifactRoot = await createArtifactRoot();
		for (const generationId of [
			"20260912T120000Z-aaaaaaaaaaaa",
			"20260912T120100Z-bbbbbbbbbbbb",
			"20260912T120200Z-cccccccccccc",
		]) {
			await createAndActivateBaseline({
				artifactRoot,
				generationId,
				metadata,
				records: [],
			});
		}

		const result = await pruneBaselineGenerations({ artifactRoot, retain: 2 });
		expect(result.retained).toEqual([
			"20260912T120200Z-cccccccccccc",
			"20260912T120100Z-bbbbbbbbbbbb",
		]);
		expect(result.removed).toEqual(["20260912T120000Z-aaaaaaaaaaaa"]);
		expect((await readdir(join(artifactRoot, "generations"))).sort()).toEqual(
			[...result.retained].sort(),
		);
		expect(await verifyActiveBaseline({ artifactRoot })).toMatchObject({
			generationId: "20260912T120200Z-cccccccccccc",
		});
	});

	it("checksums real Storage bytes and rejects asset tampering or path escape", async () => {
		const artifactRoot = await createArtifactRoot();
		const generationId = "20260912T120000Z-121212121212";
		const image = Buffer.from("real-image-fixture");
		const result = await createAndActivateBaseline({
			artifactRoot,
			generationId,
			metadata,
			records: [],
			assets: [
				{
					bucket: "profile-avatars",
					objectPath: "persona/avatar.webp",
					contentType: "image/webp",
					content: image,
				},
			],
		});
		const [relativePath, receipt] = Object.entries(result.storageAssets)[0];
		expect(receipt).toMatchObject({
			bucket: "profile-avatars",
			objectPath: "persona/avatar.webp",
			contentType: "image/webp",
			bytes: image.length,
		});
		expect(await verifyActiveBaseline({ artifactRoot })).toEqual(result);

		const assetPath = join(
			artifactRoot,
			"generations",
			generationId,
			relativePath,
		);
		await chmod(assetPath, 0o600);
		await writeFile(assetPath, "tampered");
		await expect(verifyActiveBaseline({ artifactRoot })).rejects.toThrow(
			"Storage checksum is invalid",
		);

		await expect(
			createAndActivateBaseline({
				artifactRoot: await createArtifactRoot(),
				metadata,
				records: [],
				assets: [
					{
						bucket: "profile-avatars",
						objectPath: "../escape.webp",
						content: image,
					},
				],
			}),
		).rejects.toThrow("Invalid Rehearsal Storage object path");
	});

	it("detects baseline tampering and refuses broad artifact roots", async () => {
		const artifactRoot = await createArtifactRoot();
		const generationId = "20260912T120000Z-dddddddddddd";
		await createAndActivateBaseline({
			artifactRoot,
			generationId,
			metadata,
			records: [{ table: "profiles", row: { user_id: "safe" } }],
		});
		const dataPath = join(
			artifactRoot,
			"generations",
			generationId,
			"sanitized-data.ndjson",
		);
		await chmod(dataPath, 0o600);
		await writeFile(dataPath, `${await readFile(dataPath, "utf8")}tampered\n`);

		await expect(verifyActiveBaseline({ artifactRoot })).rejects.toThrow(
			"checksum is invalid",
		);
		await expect(
			createAndActivateBaseline({
				artifactRoot: dirnameForTest(artifactRoot),
				metadata,
				records: [],
			}),
		).rejects.toThrow("unsafe Rehearsal artifact root");
	});

	it("detects migration-bundle tampering and rejects unsafe filenames", async () => {
		const artifactRoot = await createArtifactRoot();
		const generationId = "20260912T120000Z-ffffffffffff";
		await createAndActivateBaseline({
			artifactRoot,
			generationId,
			metadata,
			records: [],
			migrationFiles: [
				{
					filename: "20260911223000_baseline.sql",
					content: "select 1;\n",
				},
			],
		});
		const migrationPath = join(
			artifactRoot,
			"generations",
			generationId,
			"migrations",
			"20260911223000_baseline.sql",
		);
		await chmod(migrationPath, 0o600);
		await writeFile(migrationPath, "select 2;\n");
		await expect(verifyActiveBaseline({ artifactRoot })).rejects.toThrow(
			"migration checksum is invalid",
		);

		await expect(
			createAndActivateBaseline({
				artifactRoot: await createArtifactRoot(),
				metadata,
				records: [],
				migrationFiles: [{ filename: "../escape.sql", content: "select 1;" }],
			}),
		).rejects.toThrow("migration bundle entry is invalid");
	});

	it("removes only an explicitly named Rehearsal artifact root", async () => {
		const artifactRoot = await createArtifactRoot();
		await createAndActivateBaseline({
			artifactRoot,
			generationId: "20260912T120000Z-eeeeeeeeeeee",
			metadata,
			records: [],
		});
		await removeBaselineArtifactRoot({ artifactRoot });
		await expect(readFile(join(artifactRoot, "current"))).rejects.toMatchObject(
			{
				code: "ENOENT",
			},
		);
		await expect(
			removeBaselineArtifactRoot({
				artifactRoot: dirnameForTest(artifactRoot),
			}),
		).rejects.toThrow("unsafe Rehearsal artifact root");
	});
});

const dirnameForTest = (artifactRoot) =>
	artifactRoot.slice(0, -"/.rehearsal".length);
