import { describe, expect, it, vi } from "vitest";
import {
	compareProviderSnapshots,
	hashJson,
	normalizeOpenFoodFactsSnapshot,
	normalizeUsdaSnapshot,
} from "../../supabase/functions/catalog-monitor/providerProducts.ts";
import {
	buildProbableSafetyAlertMatches,
	fetchFsisAlertPage,
	fetchOpenFdaAlertPage,
	normalizeFdaRecallAnnouncement,
	normalizeFsisAlert,
	normalizeOpenFdaAlert,
} from "../../supabase/functions/catalog-monitor/officialSafetyAlerts.ts";

describe("catalog provider change monitoring", () => {
	it("normalizes Open Food Facts fields without inventing missing values", () => {
		const snapshot = normalizeOpenFoodFactsSnapshot({
			product: {
				code: "00850000487260",
				product_name: "Sample Sauce",
				brands: "Example Foods",
				serving_size: "2 tbsp (30 g)",
				ingredients_text_en: "Tomatoes, salt",
				allergens_tags: ["en:milk"],
				traces_tags: ["en:soy"],
				nutriments: { fat_100g: 0, proteins_100g: 2 },
				rev: 4,
				last_updated_t: 1_787_000_000,
			},
		});

		expect(snapshot).toMatchObject({
			productName: "Sample Sauce",
			brandOwner: "Example Foods",
			allergens: ["en:milk"],
			traces: ["en:soy"],
			sourceMetadata: { barcode: "00850000487260", revision: 4 },
		});
		expect(snapshot.nutrition).toContainEqual({ key: "fat_100g", value: 0 });
		expect(snapshot.alcoholByVolume).toBeNull();
	});

	it("normalizes USDA data and reports only actual material differences", async () => {
		const previous = normalizeUsdaSnapshot({
			fdcId: 123,
			description: "Sample Food",
			brandOwner: "Example Foods",
			servingSize: 30,
			servingSizeUnit: "g",
			foodNutrients: [
				{
					amount: 2,
					nutrient: { id: 1003, name: "Protein", number: "203", unitName: "G" },
				},
			],
		});
		const observed = structuredClone(previous);
		observed.nutrition = [
			{
				id: 1003,
				name: "Protein",
				number: "203",
				unit: "G",
				amount: 3,
			},
		];

		expect(compareProviderSnapshots(previous, observed)).toEqual([
			{
				field: "nutrition",
				label: "Nutrition",
				severity: "high",
				previousValue: previous.nutrition,
				observedValue: observed.nutrition,
			},
		]);
		expect(await hashJson(previous)).toHaveLength(64);
		expect(await hashJson(previous)).not.toBe(await hashJson(observed));
	});
});

describe("official food safety alert normalization and matching", () => {
	const candidates = [
		{
			id: "7df1dc93-a498-4ce2-9df8-83fe2464c93d",
			barcode: "00011110129505",
			product_name: "Creamy Peanut Butter",
			brand_owner: "Example Pantry",
			food: { packageQuantity: { label: "16 oz" } },
		},
	];

	it("extracts exact identifiers while retaining strong variant review candidates", () => {
		const alert = normalizeOpenFdaAlert({
			recall_number: "F-0001-2026",
			status: "Ongoing",
			classification: "Class I",
			product_description: "Example Pantry Creamy Peanut Butter",
			product_quantity: "16 oz jars",
			code_info: "Lot PB-123",
			report_date: "20260814",
			openfda: {
				brand_name: ["Example Pantry"],
				upc: ["00011110129505"],
			},
		});

		expect(alert).not.toBeNull();
		expect(alert?.identifiers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "upc",
					normalizedValue: "00011110129505",
				}),
				expect.objectContaining({
					type: "lot_code",
					normalizedValue: "PB-123",
				}),
			]),
		);
		expect(alert?.isActive).toBe(true);
		expect(buildProbableSafetyAlertMatches(alert!, candidates)).toEqual([
			expect.objectContaining({
				sharedProductId: candidates[0].id,
				evidence: expect.objectContaining({
					matchBasis: "brand_product_package",
					requiresModeratorReview: true,
				}),
			}),
		]);
	});

	it("queues strong brand, product, and package agreement for review", () => {
		const alert = normalizeOpenFdaAlert({
			recall_number: "F-0002-2026",
			status: "Ongoing",
			product_description: "Example Pantry Creamy Peanut Butter 16 oz jar",
			product_quantity: "16 oz jar",
			report_date: "20260814",
			openfda: { brand_name: ["Example Pantry"] },
		});

		expect(buildProbableSafetyAlertMatches(alert!, candidates)).toEqual([
			expect.objectContaining({
				sharedProductId: candidates[0].id,
				evidence: expect.objectContaining({
					matchBasis: "brand_product_package",
					requiresModeratorReview: true,
				}),
			}),
		]);
	});

	it("rejects weak title-only similarity and package disagreements", () => {
		const weakAlert = normalizeOpenFdaAlert({
			recall_number: "F-0003-2026",
			status: "Ongoing",
			product_description: "Peanut Butter",
			report_date: "20260814",
		});
		const wrongPackageAlert = normalizeOpenFdaAlert({
			recall_number: "F-0004-2026",
			status: "Ongoing",
			product_description: "Example Pantry Creamy Peanut Butter",
			product_quantity: "32 oz jar",
			report_date: "20260814",
			openfda: { brand_name: ["Example Pantry"] },
		});

		expect(buildProbableSafetyAlertMatches(weakAlert!, candidates)).toEqual([]);
		expect(
			buildProbableSafetyAlertMatches(wrongPackageAlert!, candidates),
		).toEqual([]);
	});

	it("normalizes the current FSIS dataset fields without inventing identifiers", () => {
		const alert = normalizeFsisAlert({
			field_title:
				"Example Kitchen Recalls Ready-To-Eat Chicken Salad Products",
			field_recall_number_export: "023-2026",
			field_recall_url:
				"http://www.fsis.usda.gov/recalls-alerts/example-kitchen-recall",
			field_active_notice: "True",
			field_states: ["Nationwide"],
			field_product_items: [
				"12-oz. packages containing “Example Kitchen Chicken Salad” Lot CHK-44",
			],
			field_recall_classification: "Class I",
			field_recall_date: "2026-08-14",
			field_last_modified_date: "2026-08-15",
			field_recall_reason: ["Possible contamination"],
			field_recall_type: "Active Recall",
		});

		expect(alert).toMatchObject({
			externalAlertId: "023-2026",
			alertType: "recall",
			classification: "Class I",
			productDescription:
				"12-oz. packages containing “Example Kitchen Chicken Salad” Lot CHK-44",
			recallingOrganization: "Example Kitchen",
			distributionPattern: "Nationwide",
			sourceUrl:
				"https://www.fsis.usda.gov/recalls-alerts/example-kitchen-recall",
			sourceUpdatedAt: "2026-08-15T00:00:00.000Z",
			isActive: true,
		});
		expect(alert?.identifiers).toEqual([
			expect.objectContaining({ type: "lot_code", normalizedValue: "CHK-44" }),
		]);
		expect(alert?.brandNames).toEqual(
			expect.arrayContaining([
				"Example Kitchen",
				"Example Kitchen Chicken Salad",
			]),
		);
	});

	it("uses the protected relay and conditional cache validators for FSIS", async () => {
		const fetchMock = vi.fn(
			async (input: string | URL | Request, init?: RequestInit) => {
				const url = new URL(String(input));
				expect(url.searchParams.get("source")).toBe("fsis");
				const headers = new Headers(init?.headers);
				expect(headers.get("authorization")).toBe("Bearer proxy-secret");
				expect(headers.get("if-none-match")).toBe('"fsis-previous"');
				return new Response(null, {
					status: 304,
					headers: { etag: '"fsis-previous"' },
				});
			},
		);
		vi.stubGlobal("fetch", fetchMock);

		try {
			const page = await fetchFsisAlertPage(
				"2026-08-14T00:00:00.000Z",
				{
					fsisSweepComplete: true,
					fsisEtag: '"fsis-previous"',
				},
				100,
				{
					url: "https://blendcalc.example/api/internal/food-safety/fda-recall-source",
					secret: "proxy-secret",
				},
			);

			expect(page.alerts).toEqual([]);
			expect(page.nextCursor).toMatchObject({
				fsisSweepComplete: true,
				fsisEtag: '"fsis-previous"',
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("ingests the current FDA Taylor Farms Cyclospora announcement without inventing UPCs", () => {
		const alert = normalizeFdaRecallAnnouncement(
			{
				path: "/safety/recalls-market-withdrawals-safety-alerts/taylor-fresh-foods-recalls-iceberg-lettuce-central-mexico-because-possible-health-risk",
				field_change_date_2: "07/18/2026",
				field_brand_name: '<a href="/recall">CV, JB, Mark and more</a>',
				field_product_description: "Iceberg lettuce",
				field_recall_reason_description: "Possible Cyclospora Contamination",
				field_company_name: "Taylor Fresh Foods",
				field_regulated_product_field: "Food &amp; Beverages",
				field_terminated_recall: null,
				changed: '<time datetime="2026-07-18T07:40:32-04:00">July 18</time>',
			},
			`
			<table>
				<tr><th>Brand</th><th>Description</th><th>Best if Used By</th></tr>
				<tr><td>MKTSD</td><td>Iceberg Salad 12 oz, 24 oz</td><td>7/18/2026 to 8/3/2026</td></tr>
			</table>
		`,
		);

		expect(alert).toMatchObject({
			externalAlertId:
				"announcement:taylor-fresh-foods-recalls-iceberg-lettuce-central-mexico-because-possible-health-risk",
			productDescription: "Iceberg lettuce",
			reason: "Possible Cyclospora Contamination",
			recallingOrganization: "Taylor Fresh Foods",
			reportDate: "2026-07-18",
			isActive: true,
		});
		expect(alert?.identifiers).toEqual([]);
	});

	it("does not turn generic lot-code labels into package evidence", () => {
		const alert = normalizeFdaRecallAnnouncement(
			{
				path: "/safety/recalls-market-withdrawals-safety-alerts/example-food-recall",
				field_change_date_2: "08/14/2026",
				field_brand_name: "Example Foods",
				field_product_description: "Example salad",
				field_recall_reason_description: "Possible contamination",
				field_company_name: "Example Foods",
				field_regulated_product_field: "Food &amp; Beverages",
			},
			"Review the affected products, lot codes, and package information.",
		);

		expect(alert?.identifiers).toEqual([]);
	});

	it("accepts only valid explicitly labeled UPCs from FDA announcement details", () => {
		const alert = normalizeFdaRecallAnnouncement(
			{
				path: "/safety/recalls-market-withdrawals-safety-alerts/example-food-recall",
				field_change_date_2: "08/14/2026",
				field_brand_name: "Marketside",
				field_product_description: "Shredded iceberg lettuce",
				field_recall_reason_description: "Possible contamination",
				field_company_name: "Example Foods",
				field_regulated_product_field: "Food &amp; Beverages",
			},
			`
			<p>UPC: 681131328944</p>
			<p>UPC: 681131328951</p>
			<p>UPC: 681131328968</p>
			<p>UPC: 681131532099</p>
			<p>UPC: 681131532999</p>
			<p>Lot code: LETTUCE-26</p>
		`,
		);

		const values =
			alert?.identifiers.map(({ normalizedValue }) => normalizedValue) ?? [];
		expect(values).toEqual(
			expect.arrayContaining([
				"00681131328944",
				"00681131328951",
				"00681131328968",
				"00681131532099",
				"LETTUCE-26",
			]),
		);
		expect(values).not.toContain("00681131532999");
	});

	it("extracts the current FDA exact-barcode recall corpus and affected lots", () => {
		const currentRecallFixtures = [
			{
				record: {
					path: "/safety/recalls-market-withdrawals-safety-alerts/everything-sprouts-llc-recalls-alfalfa-sprouts-due-potential-e-coli-and-salmonella-risk",
					field_change_date_2: "08/22/2026",
					field_brand_name: "Everything Sprouts, Calco",
					field_product_description: "Alfalfa Sprouts",
					field_recall_reason_description:
						"Potential Salmonella and Shiga toxin-producing E. coli contamination",
					field_company_name: "Everything Sprouts, LLC",
					field_regulated_product_field: "Food &amp; Beverages",
				},
				detailHtml:
					"The containers bear the following bar codes: 860014523113, 860014523120, and 850079470149. Lot 222; Lot 223; Lot 225; Lot 226; Lot 230",
				expectedIdentifiers: [
					"00860014523113",
					"00860014523120",
					"00850079470149",
					"222",
					"223",
					"225",
					"226",
					"230",
				],
			},
			{
				record: {
					path: "/safety/recalls-market-withdrawals-safety-alerts/hampton-grocers-inc-recalls-its-8-ounce-packages-lacnola-lactation-granola-because-possible-health",
					field_change_date_2: "08/14/2026",
					field_brand_name: "The Hampton Grocer",
					field_product_description: "Lacnola Lactation Granola",
					field_recall_reason_description: "Potential Salmonella contamination",
					field_company_name: "The Hampton Grocer, Inc.",
					field_regulated_product_field: "Food &amp; Beverages",
				},
				detailHtml:
					"UPC: 850035324554. Lot HGLC-102125. Lot HGLC-021326. Best by 21OCT2026. Best by 13FEB2027.",
				expectedIdentifiers: [
					"00850035324554",
					"HGLC-102125",
					"HGLC-021326",
					"21OCT2026",
					"13FEB2027",
				],
			},
		];

		for (const fixture of currentRecallFixtures) {
			const alert = normalizeFdaRecallAnnouncement(
				fixture.record,
				fixture.detailHtml,
			);
			const normalizedIdentifiers =
				alert?.identifiers.map(({ normalizedValue }) => normalizedValue) ?? [];
			expect(normalizedIdentifiers).toEqual(
				expect.arrayContaining(fixture.expectedIdentifiers),
			);
		}
	});

	it("filters non-human-food announcements and closes terminated notices", () => {
		const nonFood = normalizeFdaRecallAnnouncement({
			path: "/safety/recalls-market-withdrawals-safety-alerts/example-pet-food-recall",
			field_change_date_2: "08/14/2026",
			field_product_description: "Canine food",
			field_regulated_product_field:
				"Animal &amp; Veterinary, Pet Food, Food &amp; Beverages",
		});
		const terminated = normalizeFdaRecallAnnouncement({
			path: "/safety/recalls-market-withdrawals-safety-alerts/example-terminated-food-recall",
			field_change_date_2: "08/14/2026",
			field_product_description: "Example food",
			field_regulated_product_field: "Food &amp; Beverages",
			field_terminated_recall: "Terminated",
		});

		expect(nonFood).toBeNull();
		expect(terminated).toMatchObject({ isActive: false, status: "terminated" });
	});

	it("ingests a current FDA announcement even when openFDA has no enforcement record", async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			if (url.startsWith("https://api.fda.gov/food/enforcement.json")) {
				return new Response("", { status: 404 });
			}
			if (url.includes("datatables-json/recalls-market-withdrawals.json")) {
				return new Response(
					JSON.stringify([
						{
							path: "/safety/recalls-market-withdrawals-safety-alerts/taylor-fresh-foods-recalls-iceberg-lettuce-central-mexico-because-possible-health-risk",
							field_change_date_2: "07/18/2026",
							field_brand_name: "CV, JB, Mark and more",
							field_product_description: "Iceberg lettuce",
							field_recall_reason_description:
								"Possible Cyclospora Contamination",
							field_company_name: "Taylor Fresh Foods",
							field_regulated_product_field: "Food &amp; Beverages",
							field_terminated_recall: null,
						},
					]),
					{
						status: 200,
						headers: {
							"content-type": "application/json",
							etag: '"taylor-fixture"',
						},
					},
				);
			}
			return new Response("<p>Current official recall notice.</p>", {
				status: 200,
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		try {
			const page = await fetchOpenFdaAlertPage(
				"2026-08-14T00:00:00.000Z",
				{},
				100,
			);

			expect(page.alerts).toHaveLength(1);
			expect(page.alerts[0].normalizedAlert).toMatchObject({
				productDescription: "Iceberg lettuce",
				reason: "Possible Cyclospora Contamination",
			});
			expect(page.nextCursor).toMatchObject({
				fdaAnnouncementSweepComplete: true,
				fdaAnnouncementEtag: '"taylor-fixture"',
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("keeps FDA announcement coverage when the enforcement endpoint is unavailable", async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			if (url.startsWith("https://api.fda.gov/food/enforcement.json")) {
				throw new TypeError("network unavailable");
			}
			if (url.includes("datatables-json/recalls-market-withdrawals.json")) {
				return new Response(
					JSON.stringify([
						{
							path: "/safety/recalls-market-withdrawals-safety-alerts/example-food-recall",
							field_change_date_2: "08/14/2026",
							field_brand_name: "Example Foods",
							field_product_description: "Example food",
							field_recall_reason_description: "Possible contamination",
							field_company_name: "Example Foods",
							field_regulated_product_field: "Food &amp; Beverages",
						},
					]),
					{ status: 200 },
				);
			}
			throw new TypeError("detail page unavailable");
		});
		vi.stubGlobal("fetch", fetchMock);

		try {
			const page = await fetchOpenFdaAlertPage(null, {}, 100);

			expect(page.alerts).toHaveLength(1);
			expect(page.sourceErrors).toEqual([
				{
					source: "open-fda-enforcement",
					code: "provider_unavailable",
				},
			]);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("keeps enforcement coverage when the FDA announcement index is unavailable", async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request) => {
			const url = String(input);
			if (url.startsWith("https://api.fda.gov/food/enforcement.json")) {
				return new Response(
					JSON.stringify({
						results: [
							{
								recall_number: "F-0005-2026",
								status: "Ongoing",
								product_description: "Example recalled food",
								report_date: "20260814",
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response("Unavailable", { status: 503 });
		});
		vi.stubGlobal("fetch", fetchMock);

		try {
			const page = await fetchOpenFdaAlertPage(null, {}, 100);

			expect(page.alerts).toHaveLength(1);
			expect(page.sourceErrors).toEqual([
				{
					source: "fda-recall-announcements",
					code: "provider_unavailable",
				},
			]);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("uses the protected app relay for FDA announcement indexes and details", async () => {
		const fetchMock = vi.fn(
			async (input: string | URL | Request, init?: RequestInit) => {
				const url = new URL(String(input));
				if (url.hostname === "api.fda.gov") {
					return new Response("", { status: 404 });
				}
				expect(new Headers(init?.headers).get("authorization")).toBe(
					"Bearer proxy-secret",
				);
				if (!url.searchParams.has("sourcePath")) {
					return new Response(
						JSON.stringify([
							{
								path: "/safety/recalls-market-withdrawals-safety-alerts/example-food-recall",
								field_change_date_2: "08/24/2026",
								field_brand_name: "Example Foods",
								field_product_description: "Example salad",
								field_recall_reason_description: "Possible contamination",
								field_company_name: "Example Foods",
								field_regulated_product_field: "Food &amp; Beverages",
							},
						]),
						{ status: 200 },
					);
				}
				return new Response("<p>UPC: 681131328944</p>", { status: 200 });
			},
		);
		vi.stubGlobal("fetch", fetchMock);

		try {
			const page = await fetchOpenFdaAlertPage(null, {}, 100, undefined, {
				url: "https://blendcalc.example/api/internal/food-safety/fda-recall-source",
				secret: "proxy-secret",
				protectionBypassSecret: "deployment-protection-secret",
			});

			expect(page.alerts).toHaveLength(1);
			expect(page.alerts[0].normalizedAlert.identifiers).toContainEqual(
				expect.objectContaining({
					type: "upc",
					normalizedValue: "00681131328944",
				}),
			);
			const proxyRequests = fetchMock.mock.calls.filter(
				([input]) => new URL(String(input)).hostname === "blendcalc.example",
			);
			expect(proxyRequests).toHaveLength(2);
			for (const [, init] of proxyRequests) {
				expect(
					new Headers(init?.headers).get("x-vercel-protection-bypass"),
				).toBe("deployment-protection-secret");
			}
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
