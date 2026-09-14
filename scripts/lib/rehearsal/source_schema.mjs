/**
 * Purpose: Capture the exact linked production public schema as a bounded,
 * data-free Rehearsal baseline input. Do not run directly.
 */

import {
	assertProductionSchemaDump,
	captureSupabasePublicSchema,
} from "./schema_snapshot.mjs";

const PROJECT_REFERENCE_PATTERN = /^[a-z0-9]{20}$/u;

export const captureLinkedProductionSchema = async ({
	repositoryRoot,
	artifactRoot,
	expectedProjectReference,
	linkedProjectReference,
}) => {
	if (
		!PROJECT_REFERENCE_PATTERN.test(expectedProjectReference) ||
		expectedProjectReference !== linkedProjectReference
	) {
		throw new Error(
			"The linked project does not match the dedicated Rehearsal source.",
		);
	}
	return captureSupabasePublicSchema({
		repositoryRoot,
		artifactRoot,
		arguments_: ["db", "dump", "--linked"],
	});
};

export { assertProductionSchemaDump };
