import type { Database } from "$lib/types/database.types";

export type NutrientDefinitionReferenceRecord = Pick<
	Database["public"]["Tables"]["nutrient_definitions"]["Row"],
	"nutrient_id" | "nutrient_name" | "nutrient_number" | "default_unit_name"
>;
