import { describe, expect, it } from "vitest";
import {
	assertNoForbiddenCanaries,
	createSanitizationContext,
	isValidGtin,
	sanitizeRecordStream,
	sanitizeRow,
} from "../../scripts/lib/rehearsal/sanitizer.mjs";

const contextKey = Buffer.alloc(32, 7);
const tablePolicy = {
	name: "dangerous_fixture",
	group: "privateTopology",
	sourceRows: "STREAM AND SANITIZE",
	columns: [
		{ name: "id", action: "KEEP EXACTLY", dataType: "bigint", udtName: "int8" },
		{
			name: "user_id",
			action: "PSEUDONYMIZE",
			dataType: "uuid",
			udtName: "uuid",
		},
		{
			name: "barcode",
			action: "PSEUDONYMIZE",
			dataType: "text",
			udtName: "text",
		},
		{
			name: "email",
			action: "REPLACE WITH SYNTHETIC",
			dataType: "text",
			udtName: "text",
		},
		{
			name: "labels",
			action: "REPLACE WITH SYNTHETIC",
			dataType: "ARRAY",
			udtName: "_text",
		},
		{ name: "payload", action: "DERIVE", dataType: "jsonb", udtName: "jsonb" },
		{
			name: "created_at",
			action: "DERIVE",
			dataType: "timestamp with time zone",
			udtName: "timestamptz",
		},
		{
			name: "reviewed_at",
			action: "REPLACE WITH SYNTHETIC",
			dataType: "timestamp with time zone",
			udtName: "timestamptz",
		},
		{
			name: "image_url",
			action: "REPLACE WITH SYNTHETIC",
			dataType: "text",
			udtName: "text",
		},
		{
			name: "content_hash",
			action: "DERIVE",
			dataType: "text",
			udtName: "text",
		},
	],
};
const fixture = {
	id: 42,
	user_id: "11111111-1111-4111-8111-111111111111",
	barcode: "00000000772914",
	email: "private-person@example.com",
	labels: ["private label", "another private label"],
	payload: {
		status: "pending",
		gtinUpc: "00000000772914",
		basis: "volume-percent",
		displayName: "Distinctive Private Person",
		ip: "203.0.113.42",
		authorization: "aaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc",
		url: "https://signed.example/private-object?token=secret",
		nested: [null, true, 19.5, "<script>private()</script>"],
	},
	created_at: "2026-09-12T18:37:41.123Z",
	reviewed_at: "2026-09-11T12:10:00.000Z",
	image_url: "https://private.example/product.jpg",
	content_hash: "f".repeat(64),
};
const canaries = [
	"private-person@example.com",
	"Distinctive Private Person",
	"203.0.113.42",
	"aaaaaaaaaaaa.bbbbbbbbbbbb.cccccccccccc",
	"signed.example",
	"<script>private()</script>",
];

describe("Rehearsal in-memory sanitizer", () => {
	it("preserves topology while removing the dangerous fixture corpus", () => {
		const context = createSanitizationContext({ key: contextKey });
		const sanitized = sanitizeRow({
			tablePolicy,
			row: fixture,
			context,
			forbiddenCanaries: canaries,
		});

		expect(sanitized.id).toBe(42);
		expect(sanitized.user_id).toMatch(/^[0-9a-f-]{36}$/u);
		expect(sanitized.user_id).not.toBe(fixture.user_id);
		expect(sanitized.barcode).toHaveLength(fixture.barcode.length);
		expect(isValidGtin(sanitized.barcode)).toBe(true);
		expect(sanitized.email).toContain("blendcalc.local");
		expect(sanitized.labels).toHaveLength(2);
		expect(sanitized.labels).not.toEqual(fixture.labels);
		expect(sanitized.payload.status).toBe("pending");
		expect(isValidGtin(sanitized.payload.gtinUpc)).toBe(true);
		expect(sanitized.payload.gtinUpc).not.toBe(fixture.payload.gtinUpc);
		expect(sanitized.payload.basis).toBe("volume-percent");
		expect(sanitized.payload.nested).toHaveLength(
			fixture.payload.nested.length,
		);
		expect(sanitized.payload.nested.slice(0, 3)).toEqual([null, true, 19.5]);
		expect(sanitized.created_at).not.toBe(fixture.created_at);
		expect(new Date(sanitized.created_at).getUTCMinutes() % 15).toBe(0);
		expect(new Date(sanitized.created_at).getUTCSeconds()).toBe(0);
		expect(sanitized.reviewed_at).not.toBe(fixture.reviewed_at);
		expect(Number.isNaN(new Date(sanitized.reviewed_at).valueOf())).toBe(false);
		expect(sanitized.image_url).toMatch(/^https:\/\/127\.0\.0\.1\//u);
		expect(sanitized.content_hash).toHaveLength(64);
		expect(() => assertNoForbiddenCanaries(sanitized, canaries)).not.toThrow();
		expect(context.stats()).toMatchObject({
			transformedValues: expect.any(Number),
			activeMappings: 3,
		});
		context.dispose();
		expect(() => context.stats()).toThrow("disposed");
	});

	it("maps an identity consistently within one refresh and differently across refreshes", () => {
		const first = createSanitizationContext({ key: contextKey });
		const second = createSanitizationContext({ key: Buffer.alloc(32, 8) });
		const firstPass = sanitizeRow({
			tablePolicy,
			row: fixture,
			context: first,
		});
		const repeated = sanitizeRow({ tablePolicy, row: fixture, context: first });
		const newRefresh = sanitizeRow({
			tablePolicy,
			row: fixture,
			context: second,
		});

		expect(repeated.user_id).toBe(firstPass.user_id);
		expect(repeated.barcode).toBe(firstPass.barcode);
		expect(newRefresh.user_id).not.toBe(firstPass.user_id);
		expect(newRefresh.barcode).not.toBe(firstPass.barcode);
		first.dispose();
		second.dispose();
	});

	it("creates readable synthetic food labels while retaining safe food structure", () => {
		const context = createSanitizationContext({ key: contextKey });
		const foodPolicy = {
			name: "user_food_list_items",
			sourceRows: "STREAM AND SANITIZE",
			columns: [
				{
					name: "food",
					action: "DERIVE",
					dataType: "jsonb",
					udtName: "jsonb",
					jsonPolicy: {
						keepExactKeys: ["nutrientName", "unitName", "sourceKey"],
						humanReadableKeys: {
							brandOwner: "Rehearsal brand",
							description: "Rehearsal food",
						},
						timestampKeys: ["modifiedDate"],
					},
				},
			],
		};
		const sanitized = sanitizeRow({
			tablePolicy: foodPolicy,
			row: {
				food: {
					brandOwner: "Distinctive Private Brand",
					description: "Distinctive Private Food",
					modifiedDate: "2026-09-12",
					nutrients: [{ nutrientName: "Protein", unitName: "g" }],
					sourceKey: "usda",
				},
			},
			context,
			forbiddenCanaries: [
				"Distinctive Private Brand",
				"Distinctive Private Food",
			],
		});

		expect(sanitized.food.description).toMatch(/^Rehearsal food [A-F0-9]{6}$/u);
		expect(sanitized.food.brandOwner).toMatch(/^Rehearsal brand [A-F0-9]{6}$/u);
		expect(sanitized.food.nutrients).toEqual([
			{ nutrientName: "Protein", unitName: "g" },
		]);
		expect(sanitized.food.sourceKey).toBe("usda");
		expect(sanitized.food.modifiedDate).not.toBe("2026-09-12");
		expect(Number.isNaN(new Date(sanitized.food.modifiedDate).valueOf())).toBe(
			false,
		);
		context.dispose();
	});

	it("preserves Auth foreign-key identity across differently named columns", () => {
		const context = createSanitizationContext({ key: contextKey });
		const sourceIdentity = "11111111-1111-4111-8111-111111111111";
		const profile = sanitizeRow({
			tablePolicy: {
				name: "profiles",
				sourceRows: "STREAM AND SANITIZE",
				columns: [
					{
						name: "user_id",
						action: "PSEUDONYMIZE",
						dataType: "uuid",
						udtName: "uuid",
						mappingDomain: "identity:auth.users.id",
					},
				],
			},
			row: { user_id: sourceIdentity },
			context,
		});
		const moderation = sanitizeRow({
			tablePolicy: {
				name: "account_moderation",
				sourceRows: "STREAM AND SANITIZE",
				columns: [
					{
						name: "moderated_by",
						action: "PSEUDONYMIZE",
						dataType: "uuid",
						udtName: "uuid",
						mappingDomain: "identity:auth.users.id",
					},
				],
			},
			row: { moderated_by: sourceIdentity },
			context,
		});

		expect(moderation.moderated_by).toBe(profile.user_id);
		context.dispose();
	});

	it("keeps the approved owner's non-secret application data exact while remapping identity paths", () => {
		const sourceOwner = "11111111-1111-4111-8111-111111111111";
		const context = createSanitizationContext({
			key: contextKey,
			ownerSourceUserId: sourceOwner,
			ownerEmailSha256: "a".repeat(64),
		});
		const policy = {
			name: "profiles",
			ownerIdentityColumns: ["user_id"],
			sourceRows: "STREAM AND SANITIZE",
			columns: [
				{
					name: "user_id",
					action: "PSEUDONYMIZE",
					dataType: "uuid",
					udtName: "uuid",
					mappingDomain: "identity:auth.users.id",
				},
				{
					name: "display_name",
					action: "REPLACE WITH SYNTHETIC",
					dataType: "text",
					udtName: "text",
				},
				{
					name: "avatar_path",
					action: "REPLACE WITH SYNTHETIC",
					dataType: "text",
					udtName: "text",
				},
			],
		};
		const owner = sanitizeRow({
			tablePolicy: policy,
			row: {
				user_id: sourceOwner,
				display_name: "Dylan's production profile",
				avatar_path: `${sourceOwner}/avatar.webp`,
			},
			context,
		});
		const anotherUser = sanitizeRow({
			tablePolicy: policy,
			row: {
				user_id: "22222222-2222-4222-8222-222222222222",
				display_name: "Another private person",
				avatar_path: "22222222-2222-4222-8222-222222222222/avatar.webp",
			},
			context,
		});

		expect(owner.user_id).toBe(context.ownerPersonaUserId);
		expect(owner.display_name).toBe("Dylan's production profile");
		expect(owner.avatar_path).toBe(`${context.ownerPersonaUserId}/avatar.webp`);
		expect(anotherUser.display_name).not.toBe("Another private person");
		expect(anotherUser.avatar_path).not.toContain(
			"22222222-2222-4222-8222-222222222222",
		);
		context.dispose();
	});

	it("fails closed for schema drift and surviving canaries", () => {
		const context = createSanitizationContext({ key: contextKey });
		expect(() =>
			sanitizeRow({
				tablePolicy,
				row: { ...fixture, unexpected: "value" },
				context,
			}),
		).toThrow("Unknown: unexpected");
		expect(() => {
			const { email: _email, ...missing } = fixture;
			return sanitizeRow({ tablePolicy, row: missing, context });
		}).toThrow("Missing: email");
		expect(() =>
			assertNoForbiddenCanaries({ value: "distinct-canary-value" }, [
				"distinct-canary-value",
			]),
		).toThrow("Forbidden source canary survived");
		context.dispose();
	});

	it("drops every row for a source-excluded table", () => {
		const context = createSanitizationContext({ key: contextKey });
		expect(
			sanitizeRow({
				tablePolicy: {
					name: "blendcalc_api_keys",
					sourceRows: "EXCLUDE",
					columns: [],
				},
				row: { key_hash: "never-read" },
				context,
			}),
		).toBeNull();
		context.dispose();
	});

	it("fails before accepting an excluded or unclassified streamed source row", async () => {
		const context = createSanitizationContext({ key: contextKey });
		const manifest = {
			tables: [
				{
					name: "blendcalc_api_keys",
					sourceRows: "EXCLUDE",
					columns: [],
				},
			],
		};
		await expect(
			Array.fromAsync(
				sanitizeRecordStream({
					records: [{ table: "blendcalc_api_keys", row: { key_hash: "raw" } }],
					manifest,
					context,
				}),
			),
		).rejects.toThrow("exposed excluded table");
		await expect(
			Array.fromAsync(
				sanitizeRecordStream({
					records: [{ table: "unknown", row: { value: "raw" } }],
					manifest,
					context,
				}),
			),
		).rejects.toThrow("unclassified table");
		context.dispose();
	});
});
