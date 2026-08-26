import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readRepositoryFile = (path: string) => readFileSync(path, "utf8");

const namespaceMigrationPath =
	"supabase/migrations/20260825200000_canonical_blendcalc_api_namespace.sql";

describe("canonical blendCalcAPI namespace", () => {
	it("owns application contracts and services under blendCalcAPI folders", () => {
		for (const path of [
			"src/lib/blendCalcAPI/v1/blendCalcAPIAccessPolicy.ts",
			"src/lib/blendCalcAPI/v1/blendCalcAPIErrors.ts",
			"src/lib/blendCalcAPI/v1/blendCalcAPIRequest.ts",
			"src/lib/blendCalcAPI/v1/blendCalcAPITypes.ts",
			"src/lib/server/blendCalcAPI/blendCalcAPIPublicationConcerns.server.ts",
			"src/lib/server/blendCalcAPI/v1/blendCalcAPIAccessPolicy.server.ts",
			"src/lib/server/blendCalcAPI/v1/blendCalcAPICatalog.server.ts",
			"src/lib/server/blendCalcAPI/v1/blendCalcAPIHttp.server.ts",
		]) {
			expect(existsSync(path), path).toBe(true);
		}

		for (const legacyPath of [
			"src/lib/api/v1/accessPolicy.ts",
			"src/lib/api/v1/errors.ts",
			"src/lib/api/v1/request.ts",
			"src/lib/api/v1/types.ts",
			"src/lib/server/api/publicationConcerns.server.ts",
			"src/lib/server/api/v1/apiV1AccessPolicy.server.ts",
			"src/lib/server/api/v1/catalogApi.server.ts",
			"src/lib/server/api/v1/http.server.ts",
		]) {
			expect(existsSync(legacyPath), legacyPath).toBe(false);
		}
	});

	it("makes canonical PostgreSQL objects the owners and retains bounded rollout aliases", () => {
		const migration = readRepositoryFile(namespaceMigrationPath);

		expect(migration).toContain("rename to blendcalc_api_publication_concerns");
		expect(migration).toContain("rename to blendcalc_api_publication_holds");
		expect(migration).toContain("get_blendcalc_api_product_v1");
		expect(migration).toContain("search_blendcalc_api_products_v1");
		expect(migration).toContain(
			"get_blendcalc_api_product_revision_history_v1",
		);
		expect(migration).toContain(
			"get_blendcalc_api_catalog_product_readiness_passport",
		);
		expect(migration).toContain(
			"private.build_catalog_product_readiness_passport",
		);
		expect(migration).toContain("blendcalc-api-v1-packaged-core-v1");
		expect(migration).toContain("blendcalc-api-v1-packaged-product-v1");
		expect(migration).toContain("Temporary rollout compatibility wrapper");
	});

	it("keeps generated database contracts synchronized with canonical names", () => {
		const databaseTypes = readRepositoryFile("src/lib/types/database.types.ts");

		for (const objectName of [
			"blendcalc_api_publication_concerns",
			"blendcalc_api_publication_holds",
			"get_blendcalc_api_product_v1",
			"search_blendcalc_api_products_v1",
			"get_blendcalc_api_product_revision_history_v1",
			"get_blendcalc_api_catalog_product_readiness_passport",
		]) {
			expect(databaseTypes).toContain(objectName);
		}
	});
});
