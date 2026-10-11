import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
	parseCofidSourceValue,
	preflightCofidSource,
	verifyCofidPersistedCounts,
} from "../../scripts/lib/nutrition/cofid_source_preflight.mjs";

const food = (code = "13-001", name = "Fixture food") => [code, name];
const sheet = (rows, tag = "PROCNT", name = "Fixture nutrients") => ({
	sheet: name,
	data: [
		[null, null, null, null, null, null, null, "Protein (g)"],
		[null, null, null, null, null, null, null, tag],
		[null, null, null, null, null, null, null, "Protein"],
		...rows.map(([code, label, value]) => [
			code,
			label,
			null,
			null,
			null,
			null,
			null,
			value,
		]),
	],
});
const valid = () => ({
	foodRows: [food(), food("13-002", "Second food")],
	nutrientSheets: [
		sheet([
			["13-001", "Fixture food", 5],
			["13-002", "Second food", "Tr"],
		]),
	],
});

describe("CoFID source identity preflight", () => {
	it.each([
		["", "Food"],
		["13-001", ""],
		[NaN, "Food"],
		[Infinity, "Food"],
		[{}, "Food"],
		["13-001", 123],
	])("refuses malformed food identity types", (code, name) => {
		const input = valid();
		input.foodRows[0] = [code, name];
		expect(() => preflightCofidSource(input)).toThrow();
	});
	it("counts unique food and accepted nutrient identities without changing input", () => {
		const input = valid();
		const before = JSON.stringify(input);
		expect(preflightCofidSource(input)).toEqual({
			inputFoodCount: 2,
			distinctFoodCount: 2,
			inputNutrientCount: 2,
			distinctNutrientCount: 2,
		});
		expect(JSON.stringify(input)).toBe(before);
		expect(preflightCofidSource(input)).toEqual(preflightCofidSource(input));
	});

	it.each(["Watercress, raw", "Aubergine"])(
		"refuses duplicate code regardless of its descriptions (%s)",
		(label) => {
			const input = valid();
			input.foodRows = [food("13-669", "Aubergine"), food("13-669", label)];
			expect(() => preflightCofidSource(input)).toThrow("duplicate food code");
		},
	);

	it.each([
		"changed name",
		"unknown food",
		"repeated row",
		"missing row",
		"whitespace code",
	])("refuses %s", (variant) => {
		const input = valid();
		const data = input.nutrientSheets[0].data;
		if (variant === "changed name") data[3][1] = "Different food";
		if (variant === "unknown food") data[3][0] = "13-999";
		if (variant === "repeated row") data.push([...data[3]]);
		if (variant === "missing row") data.pop();
		if (variant === "whitespace code") input.foodRows[0][0] = " 13-001";
		expect(() => preflightCofidSource(input)).toThrow();
	});

	it("refuses repeated accepted natural keys across different sheets", () => {
		const input = valid();
		input.nutrientSheets.push(
			sheet(
				[
					["13-001", "Fixture food", 10],
					["13-002", "Second food", null],
				],
				"PROCNT",
				"Other sheet",
			),
		);
		expect(() => preflightCofidSource(input)).toThrow(
			"duplicate food/nutrient identity",
		);
	});

	it("refuses duplicate header and worksheet identities", () => {
		const input = valid();
		input.nutrientSheets.push(input.nutrientSheets[0]);
		expect(() => preflightCofidSource(input)).toThrow("worksheet identity");
		input.nutrientSheets.pop();
		input.nutrientSheets[0].data[0].push("Protein (g)");
		input.nutrientSheets[0].data[1].push("PROCNT");
		expect(() => preflightCofidSource(input)).toThrow("header identity");
	});

	it.each(["foods", "sheets", "headers", "tags", "values"])(
		"refuses empty %s before replacement",
		(part) => {
			const input = valid();
			if (part === "foods") input.foodRows = [];
			if (part === "sheets") input.nutrientSheets = [];
			if (part === "headers") input.nutrientSheets[0].data = [];
			if (part === "tags") input.nutrientSheets[0].data[1] = [];
			if (part === "values")
				input.nutrientSheets[0].data.slice(3).forEach((row) => {
					row[7] = null;
				});
			expect(() => preflightCofidSource(input)).toThrow();
		},
	);

	it("does not echo source identities, descriptions or nutrient values in refusal diagnostics", () => {
		const input = valid();
		input.foodRows = [
			food("SECRET_CANARY", "private fixture name"),
			food("SECRET_CANARY", "other name"),
		];
		try {
			preflightCofidSource(input);
			throw new Error("Expected refusal");
		} catch (error) {
			expect(error.code).toBe("COFID_SOURCE_IDENTITY_REFUSED");
			expect(error.message).not.toMatch(
				/SECRET_CANARY|private fixture name|other name/,
			);
		}
	});

	it.each([
		[0, "measured", 0],
		["(1.5)", "measured", 1.5],
		["Tr", "trace", null],
		["N", "present-unquantified", null],
	])("preserves source semantics for %s", (value, status, amount) => {
		expect(parseCofidSourceValue(value)).toMatchObject({ status, amount });
	});
	it.each([
		null,
		"",
		"not reported",
		-1,
		NaN,
		Infinity,
		`(${"9".repeat(400)})`,
	])("does not invent a measured amount for %s", (value) => {
		expect(parseCofidSourceValue(value)).toBeNull();
	});
});

describe("CoFID persisted count reconciliation", () => {
	const expected = { distinctFoodCount: 2, distinctNutrientCount: 2 };
	const client = (results) => ({
		from: vi.fn((table) => ({
			select: vi.fn(() => ({ eq: vi.fn(async () => results[table]) })),
		})),
	});
	it("sanitizes thrown database failures rather than echoing their details", async () => {
		const db = {
			from() {
				throw new Error("SECRET_CANARY");
			},
		};
		await expect(
			verifyCofidPersistedCounts(db, "cofid-2021", expected),
		).rejects.toMatchObject({ code: "COFID_PERSISTED_COUNTS_REFUSED" });
		await expect(
			verifyCofidPersistedCounts(db, "cofid-2021", expected),
		).rejects.not.toThrow("SECRET_CANARY");
	});
	it("reads dataset-scoped exact counts without returning records", async () => {
		const db = client({
			generic_food_records: { count: 2 },
			generic_food_nutrients: { count: 2 },
		});
		expect(
			await verifyCofidPersistedCounts(db, "cofid-2021", expected),
		).toEqual({ foods: 2, nutrients: 2 });
		for (const result of db.from.mock.results) {
			expect(result.value.select).toHaveBeenCalledWith("source_food_key", {
				count: "exact",
				head: true,
			});
			expect(result.value.select.mock.results[0].value.eq).toHaveBeenCalledWith(
				"dataset_key",
				"cofid-2021",
			);
		}
	});
	it.each([
		{ count: 1 },
		{ count: null },
		{ count: 2, error: { message: "SECRET_CANARY" } },
	])("refuses a mismatch or unavailable count safely", async (bad) => {
		const db = client({
			generic_food_records: { count: 2 },
			generic_food_nutrients: bad,
		});
		await expect(
			verifyCofidPersistedCounts(db, "cofid-2021", expected),
		).rejects.toMatchObject({ code: "COFID_PERSISTED_COUNTS_REFUSED" });
		await expect(
			verifyCofidPersistedCounts(db, "cofid-2021", expected),
		).rejects.not.toThrow("SECRET_CANARY");
	});
});

describe("actual CoFID entrypoint refusal ordering", () => {
	const source = readFileSync(
		"scripts/imports/nutrition/import_cofid_2021.mjs",
		"utf8",
	).replace(/^import[\s\S]*?from "[^"]+";\n/gm, "");
	const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
	const invoke = async (foods, factory, overrides = {}) => {
		const names = [
			"1.3 Proximates",
			"1.4 Inorganics",
			"1.5 Vitamins",
			"1.6 Vitamin Fractions",
			"1.8 (SFA per 100gFood)",
			"1.10 (MUFA per 100gFood)",
			"1.12 (PUFA per 100gFood)",
			"1.13 Phytosterols",
			"1.14 Organic Acids",
		];
		const sheets = [
			{ sheet: "1.2 Factors", data: [[], [], [], ...foods] },
			...names.map((name, i) =>
				sheet(
					foods.map(([code, label]) => [code, label, 1]),
					`N${i}`,
					name,
				),
			),
		];
		return new AsyncFunction(
			"createReadStream",
			"readExcelFile",
			"createTemporaryDownloadDirectory",
			"downloadTemporaryFile",
			"getFilesChecksum",
			"preflightCofidSource",
			"createNutritionImportClient",
			"createBatchWriter",
			"deleteGenericDatasetRows",
			"normalizeDatasetUnit",
			"normalizeDatasetSearchText",
			"parseSourceValue",
			"verifyCofidPersistedCounts",
			"console",
			"process",
			source,
		)(
			() => null,
			async () => sheets,
			async () => "/fake-only",
			async () => "/fake-only/file",
			async () => "fixture-hash",
			preflightCofidSource,
			factory,
			overrides.writer ??
				(() => ({ add: async () => {}, finish: async () => {} })),
			overrides.discard ?? (async () => {}),
			(value) => String(value ?? "").toUpperCase(),
			(...values) => values.join(" "),
			parseCofidSourceValue,
			verifyCofidPersistedCounts,
			overrides.console ?? { table: () => {} },
			{ argv: overrides.dryRun ? ["--dry-run"] : [] },
		);
	};
	it("rejects the real public collision before any client, read, deactivation or write", async () => {
		const factory = vi.fn(() => {
			throw new Error("Database boundary reached");
		});
		await expect(
			invoke(
				[food("13-669", "Aubergine"), food("13-669", "Watercress, raw")],
				factory,
			),
		).rejects.toMatchObject({ code: "COFID_SOURCE_IDENTITY_REFUSED" });
		expect(factory).not.toHaveBeenCalled();
	});
	it("allows a valid source to reach the existing database approval boundary", async () => {
		const factory = vi.fn(() => {
			throw new Error("Database approval boundary");
		});
		await expect(invoke([food()], factory)).rejects.toThrow(
			"Database approval boundary",
		);
		expect(factory).toHaveBeenCalledOnce();
	});

	const databaseFixture = (nutrientCount = 9) => {
		const events = [];
		const client = {
			from(table) {
				const chain = {
					select(_columns, options) {
						if (options?.head) events.push(`count:${table}`);
						return chain;
					},
					eq() {
						return chain;
					},
					async single() {
						return {
							data: {
								import_enabled: true,
								license_review_status: "approved",
								metadata: {},
							},
						};
					},
					async order() {
						return { data: [] };
					},
					update(values) {
						events.push({ table, values });
						return chain;
					},
					then(resolve) {
						resolve({
							error: null,
							count: table === "generic_food_records" ? 1 : nutrientCount,
						});
					},
				};
				return chain;
			},
		};
		return { client, events };
	};
	it("refuses activation after a persisted count mismatch in the actual importer", async () => {
		const { client, events } = databaseFixture(8);
		await expect(invoke([food()], () => client)).rejects.toMatchObject({
			code: "COFID_PERSISTED_COUNTS_REFUSED",
		});
		expect(events.some((event) => event.values?.active === false)).toBe(true);
		expect(events.some((event) => event.values?.active === true)).toBe(false);
		expect(events.some((event) => event.table === "product_data_sources")).toBe(
			false,
		);
	});
	it("activates only after both exact counts pass and publishes the verified counts", async () => {
		const { client, events } = databaseFixture();
		await invoke([food()], () => client);
		const index = events.findIndex((event) => event.values?.active === true);
		expect(index).toBeGreaterThan(
			events.indexOf("count:generic_food_nutrients"),
		);
		expect(events[index].values).toMatchObject({
			food_count: 1,
			nutrient_value_count: 9,
		});
	});
	it("dry-run performs neither discard, live writes, count reconciliation nor activation", async () => {
		const { client, events } = databaseFixture();
		const discard = vi.fn();
		const summaries = { table: vi.fn() };
		const writer = vi.fn((options) => {
			expect(options.dryRun).toBe(true);
			return { add: async () => {}, finish: async () => {} };
		});
		await invoke([food()], () => client, {
			dryRun: true,
			discard,
			console: summaries,
			writer,
		});
		expect(writer).toHaveBeenCalledTimes(3);
		expect(discard).not.toHaveBeenCalled();
		expect(events).toEqual([]);
		expect(summaries.table.mock.calls[0][0][0]).toMatchObject({
			foods: 1,
			nutrientValues: 9,
			persistedFoods: null,
			persistedNutrientValues: null,
			dryRun: true,
		});
	});
});
