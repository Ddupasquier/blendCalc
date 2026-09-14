import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readRehearsalServiceEnvironment } from "../../scripts/lib/rehearsal/service_environment.mjs";

const temporaryRoots = [];

const makeEnvironmentFile = async (source) => {
	const root = await mkdtemp(join(tmpdir(), "rehearsal-service-env-"));
	temporaryRoots.push(root);
	const path = join(root, ".env.rehearsal.local");
	await writeFile(path, source, { mode: 0o600 });
	return path;
};

afterEach(async () => {
	await Promise.all(
		temporaryRoots
			.splice(0)
			.map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("Rehearsal local service environment", () => {
	it("loads only explicitly allowlisted owner-only values", async () => {
		const path = await makeEnvironmentFile(
			"LOCAL_PROVIDER_ID=id\nLOCAL_PROVIDER_SECRET=secret\n",
		);
		await expect(
			readRehearsalServiceEnvironment({
				path,
				keys: ["LOCAL_PROVIDER_ID", "LOCAL_PROVIDER_SECRET"],
				blockedKeys: ["HOSTED_DATABASE_PASSWORD"],
			}),
		).resolves.toEqual({
			LOCAL_PROVIDER_ID: "id",
			LOCAL_PROVIDER_SECRET: "secret",
		});
	});

	it("fails closed for missing, broad, incomplete, unexpected, or blocked input", async () => {
		await expect(
			readRehearsalServiceEnvironment({
				path: "/missing/rehearsal.env",
				keys: ["LOCAL_PROVIDER_ID"],
			}),
		).rejects.toThrow("is missing");

		const broadPath = await makeEnvironmentFile("LOCAL_PROVIDER_ID=id\n");
		await chmod(broadPath, 0o644);
		await expect(
			readRehearsalServiceEnvironment({
				path: broadPath,
				keys: ["LOCAL_PROVIDER_ID"],
			}),
		).rejects.toThrow("owner-only");

		const incompletePath = await makeEnvironmentFile("LOCAL_PROVIDER_ID=\n");
		await expect(
			readRehearsalServiceEnvironment({
				path: incompletePath,
				keys: ["LOCAL_PROVIDER_ID"],
			}),
		).rejects.toThrow("missing required variables");

		const unexpectedPath = await makeEnvironmentFile(
			"LOCAL_PROVIDER_ID=id\nHOSTED_DATABASE_PASSWORD=nope\n",
		);
		await expect(
			readRehearsalServiceEnvironment({
				path: unexpectedPath,
				keys: ["LOCAL_PROVIDER_ID"],
			}),
		).rejects.toThrow("outside its allowlist");

		const blockedPath = await makeEnvironmentFile(
			"HOSTED_DATABASE_PASSWORD=nope\n",
		);
		await expect(
			readRehearsalServiceEnvironment({
				path: blockedPath,
				keys: ["HOSTED_DATABASE_PASSWORD"],
				blockedKeys: ["HOSTED_DATABASE_PASSWORD"],
			}),
		).rejects.toThrow("blocked by the safety policy");
	});
});
