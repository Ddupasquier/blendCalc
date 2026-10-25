import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";

/** @param {string} directory */
const ensureDirectory = (directory) => {
	if (existsSync(directory)) {
		if (
			!lstatSync(directory).isDirectory() ||
			lstatSync(directory).isSymbolicLink()
		) {
			throw new Error(
				"Artifact directories must be regular directories, not symlinks.",
			);
		}
	} else mkdirSync(directory, { mode: 0o700 });
	return directory;
};

/** Resolve the existing checkout first; never create a missing repository fallback.
 * @param {string} repositoryRoot
 */
export const localArtifactCacheRoot = (repositoryRoot) =>
	ensureDirectory(join(realpathSync(repositoryRoot), ".cache"));

/** @param {string} repositoryRoot @param {string} name */
export const localArtifactCacheDirectory = (repositoryRoot, name) => {
	if (!/^[a-z][a-z0-9-]*$/.test(name))
		throw new Error("Invalid artifact directory name.");
	return ensureDirectory(join(localArtifactCacheRoot(repositoryRoot), name));
};

/** Local launchers supply these paths explicitly instead of inheriting host defaults.
 * @param {string} repositoryRoot
 * @param {NodeJS.ProcessEnv} inheritedEnvironment
 */
export const createLocalArtifactEnvironment = (
	repositoryRoot,
	inheritedEnvironment = process.env,
) => {
	const cache = localArtifactCacheRoot(repositoryRoot);
	const temporary = ensureDirectory(join(cache, "tmp"));
	const paths = {
		TMPDIR: temporary,
		TMP: temporary,
		TEMP: temporary,
		npm_config_cache: join(cache, "npm"),
		NPM_CONFIG_CACHE: join(cache, "npm"),
		NODE_COMPILE_CACHE: join(cache, "node-compile"),
		// Hosted jobs install browsers before these local launchers run.
		// Preserve their existing installation/cache contract.
		...((inheritedEnvironment.CI ?? process.env.CI)
			? {}
			: { PLAYWRIGHT_BROWSERS_PATH: join(cache, "playwright-browsers") }),
	};
	for (const directory of Object.values(paths)) {
		if (
			directory &&
			existsSync(directory) &&
			(!lstatSync(directory).isDirectory() ||
				lstatSync(directory).isSymbolicLink())
		) {
			throw new Error(
				"Artifact directories must be regular directories, not symlinks.",
			);
		}
	}
	return { ...inheritedEnvironment, ...paths };
};
