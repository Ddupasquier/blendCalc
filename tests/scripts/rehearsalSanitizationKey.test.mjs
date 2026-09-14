import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadOrCreateSanitizationKey } from "../../scripts/lib/rehearsal/sanitization_key.mjs";

const temporaryRoots = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots
			.splice(0)
			.map((root) => rm(root, { recursive: true, force: true })),
	);
});

const makeArtifactRoot = async () => {
	const parent = await mkdtemp(join(tmpdir(), "rehearsal-key-test-"));
	temporaryRoots.push(parent);
	return join(parent, ".rehearsal");
};

describe("Rehearsal sanitization key", () => {
	it("creates one owner-only key and reuses it across refreshes", async () => {
		const artifactRoot = await makeArtifactRoot();
		const first = await loadOrCreateSanitizationKey({ artifactRoot });
		const second = await loadOrCreateSanitizationKey({ artifactRoot });
		const keyStats = await stat(join(artifactRoot, "sanitization.key"));

		expect(first).toHaveLength(32);
		expect(second).toEqual(first);
		expect(keyStats.mode & 0o077).toBe(0);
		first.fill(0);
		second.fill(0);
	});

	it("fails closed for malformed, permissive, or unsafe key paths", async () => {
		const artifactRoot = await makeArtifactRoot();
		await loadOrCreateSanitizationKey({ artifactRoot });
		await chmod(join(artifactRoot, "sanitization.key"), 0o644);
		await expect(loadOrCreateSanitizationKey({ artifactRoot })).rejects.toThrow(
			"group or other users",
		);
		await chmod(join(artifactRoot, "sanitization.key"), 0o600);
		await writeFile(join(artifactRoot, "sanitization.key"), "short", {
			mode: 0o600,
		});
		await expect(loadOrCreateSanitizationKey({ artifactRoot })).rejects.toThrow(
			"32 bytes",
		);
		await expect(
			loadOrCreateSanitizationKey({
				artifactRoot: join(artifactRoot, "nested"),
			}),
		).rejects.toThrow("unsafe Rehearsal artifact root");
	});
});
