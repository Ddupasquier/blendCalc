/**
 * Purpose: Apply the canonical source-product title formatting rules to source-managed
 * names in catalog products, submissions, revisions, normalized observations, custom
 * foods, and saved list snapshots without rewriting user-owned manual names. The live
 * command updates Supabase; preview changes first.
 * Preview: `node scripts/backfills/catalog/backfill_product_names.mjs --dry-run`
 * Execute: `node scripts/backfills/catalog/backfill_product_names.mjs`
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import {
	formatSourceProductName,
	isManagedProductName,
} from "../../../src/lib/utils/products/productNameFormatting.js";

config({ path: ".env.moderation.local", quiet: true });
config({ path: ".env", quiet: true });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes("--dry-run");
const pageSize = 1000;

if (!supabaseUrl || !serviceRoleKey) {
	throw new Error(
		"PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
	);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
	auth: { autoRefreshToken: false, persistSession: false },
	realtime: { transport: ws },
});

const fetchAllRows = async (table, columns) => {
	const rows = [];
	for (let from = 0; ; from += pageSize) {
		const { data, error } = await supabase
			.from(table)
			.select(columns)
			.range(from, from + pageSize - 1);
		if (error) throw error;
		rows.push(...(data ?? []));
		if (!data || data.length < pageSize) break;
	}
	return rows;
};

const isSourceBackedFood = (food, rowSource) => {
	if (!food) return false;
	return isManagedProductName({
		...food,
		sourceKey: food.sourceKey ?? rowSource,
	});
};

const getFoodUpdate = (food, forceManaged = false) => {
	const description = String(food?.description ?? "");
	const formattedDescription = formatSourceProductName(description);
	if (!formattedDescription || formattedDescription === description) return null;
	return {
		...food,
		description: formattedDescription,
		nameProvenance:
			food?.nameProvenance === "barcode" && !forceManaged
				? "barcode"
				: "source",
	};
};

const updateSharedProducts = async () => {
	const rows = await fetchAllRows(
		"shared_products",
		"id, product_name, source, food",
	);
	let changed = 0;
	for (const row of rows) {
		if (!isSourceBackedFood(row.food, row.source)) continue;
		const food = getFoodUpdate(row.food);
		if (!food) continue;
		changed += 1;
		console.log(`shared_products: ${row.product_name} -> ${food.description}`);
		if (dryRun) continue;
		const { error } = await supabase
			.from("shared_products")
			.update({ product_name: food.description, food })
			.eq("id", row.id);
		if (error) throw error;
	}
	return changed;
};

const updateFoodJsonTable = async (table) => {
	const rows = await fetchAllRows(table, "id, food");
	let changed = 0;
	for (const row of rows) {
		if (!isSourceBackedFood(row.food)) continue;
		const food = getFoodUpdate(row.food);
		if (!food) continue;
		changed += 1;
		console.log(`${table}: ${row.food.description} -> ${food.description}`);
		if (dryRun) continue;
		const { error } = await supabase
			.from(table)
			.update({ food })
			.eq("id", row.id);
		if (error) throw error;
	}
	return changed;
};

const updateCatalogFoodTable = async ({
	table,
	foodColumn = "food",
	nameColumn,
	sourceColumn,
	forceManaged = false,
}) => {
	const columns = ["id", foodColumn, nameColumn, sourceColumn]
		.filter(Boolean)
		.join(", ");
	const rows = await fetchAllRows(table, columns);
	let changed = 0;
	for (const row of rows) {
		const food = row[foodColumn];
		if (!forceManaged && !isSourceBackedFood(food, sourceColumn ? row[sourceColumn] : null)) {
			continue;
		}
		const normalizedFood = getFoodUpdate(food, forceManaged);
		if (!normalizedFood) continue;
		changed += 1;
		console.log(`${table}: ${food.description} -> ${normalizedFood.description}`);
		if (dryRun) continue;
		const update = { [foodColumn]: normalizedFood };
		if (nameColumn) update[nameColumn] = normalizedFood.description;
		const { error } = await supabase.from(table).update(update).eq("id", row.id);
		if (error) throw error;
	}
	return changed;
};

const counts = {
	sharedProducts: await updateSharedProducts(),
	sharedProductSubmissions: await updateCatalogFoodTable({
		table: "shared_product_submissions",
		nameColumn: "product_name",
		forceManaged: true,
	}),
	sharedProductRevisions: await updateCatalogFoodTable({
		table: "shared_product_revisions",
		sourceColumn: "source",
	}),
	sharedProductObservations: await updateCatalogFoodTable({
		table: "shared_product_observations",
		foodColumn: "normalized_food",
		sourceColumn: "source",
	}),
	customFoods: await updateFoodJsonTable("custom_foods"),
	listItems: await updateFoodJsonTable("user_food_list_items"),
};

console.log("");
console.log(dryRun ? "Dry run complete." : "Product-name backfill complete.");
console.table(counts);
