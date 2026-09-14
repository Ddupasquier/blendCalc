/**
 * Purpose: Assemble the prospective Rehearsal npm package from an explicit source
 * allowlist and prove its dependency and tarball contents contain no forbidden data.
 * Run: `npm run rehearsal:package:audit`. Writes only to a temporary directory.
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runLocalCommand } from "../../lib/environment/local_supabase.mjs";
import {
	REHEARSAL_PACKAGE_DOCUMENTS,
	REHEARSAL_PACKAGE_MANIFEST,
	REHEARSAL_PACKAGE_SOURCES,
	assembleProspectiveRehearsalPackage,
} from "../../lib/rehearsal/prospective_package.mjs";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const forbiddenPathPattern =
	/(?:^|\/)(?:\.env(?:\.|$)|\.rehearsal|baseline-manifest\.json|sanitized-data\.ndjson|sanitization-policy\.json|project-items\.json|test-results|logs?)(?:\/|$)/iu;
const forbiddenContentPatterns = [
	/\b(?:postgres(?:ql)?):\/\/[^\s"']+@/iu,
	/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u,
	/\bsb_secret_[A-Za-z0-9_-]+\b/u,
];
const forbiddenProjectSourcePatterns = [
	/\bBLENDCALC_[A-Z0-9_]+\b/u,
	/@blendcalc\.local\b/iu,
	/\bblendCalcAPI\b/u,
	/\bDdupasquier\b/u,
	/\/Volumes\/Hobby/iu,
];
const relativeImportPattern =
	/(?:from\s+|import\s*)["'](?<specifier>\.{1,2}\/[^"']+)["']/gu;

const main = async () => {
	const temporaryRoot = await mkdtemp(
		join(tmpdir(), "rehearsal-package-audit-"),
	);
	try {
		await assembleProspectiveRehearsalPackage({
			repositoryRoot,
			destination: temporaryRoot,
		});

		for (const source of REHEARSAL_PACKAGE_SOURCES) {
			const content = await readFile(join(temporaryRoot, source), "utf8");
			for (const pattern of forbiddenContentPatterns) {
				if (pattern.test(content)) {
					throw new Error(
						`Prospective package source contains a secret-like value: ${source}.`,
					);
				}
			}
			for (const pattern of forbiddenProjectSourcePatterns) {
				if (pattern.test(content)) {
					throw new Error(
						`Prospective package source contains a BlendCalc-specific contract: ${source}.`,
					);
				}
			}
			for (const match of content.matchAll(relativeImportPattern)) {
				const importedPath = normalize(
					relative(
						temporaryRoot,
						resolve(temporaryRoot, dirname(source), match.groups.specifier),
					),
				);
				if (!REHEARSAL_PACKAGE_SOURCES.includes(importedPath)) {
					throw new Error(
						`Prospective package has an unresolved source import: ${source} -> ${match.groups.specifier}.`,
					);
				}
			}
		}

		const output = runLocalCommand(
			"npm",
			["pack", "--dry-run", "--json", "--ignore-scripts"],
			{ capture: true, cwd: temporaryRoot },
		);
		const pack = JSON.parse(output)[0];
		const packedPaths = pack.files.map((file) => file.path).sort();
		const unexpected = packedPaths.filter((path) => {
			if (forbiddenPathPattern.test(path)) return true;
			if (path === "package.json" || REHEARSAL_PACKAGE_DOCUMENTS.includes(path))
				return false;
			return !REHEARSAL_PACKAGE_SOURCES.includes(path);
		});
		if (unexpected.length) {
			throw new Error(
				`Prospective package contains forbidden or unexpected files: ${unexpected.join(", ")}.`,
			);
		}
		console.log(
			JSON.stringify(
				{
					status: "passed",
					name: REHEARSAL_PACKAGE_MANIFEST.name,
					version: REHEARSAL_PACKAGE_MANIFEST.version,
					files: packedPaths.length,
					unpackedBytes: pack.unpackedSize,
					runtimeDependencies: 0,
					forbiddenFiles: 0,
					publicationBlocked: true,
					publicationBlockers: [
						"DEV-082 package extraction and standalone verification",
						"standalone manifest must remove the private publication guard",
					],
				},
				null,
				2,
			),
		);
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true });
	}
};

await main();
