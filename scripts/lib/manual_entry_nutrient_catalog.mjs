/**
 * Purpose: Resolve observed nutrient IDs against the DB-owned manual-entry group and
 * field catalog while routing unknown nutrients into the review queue. This is a shared
 * module and never writes data by itself.
 * Do not run directly; use `npm run seed:manual-entry-nutrients`.
 */

const toNutrientId = (value) => {
	const nutrientId = Number(value);
	return Number.isFinite(nutrientId) ? nutrientId : null;
};

export const createManualEntryNutrientCatalog = ({ groups, fields }) => {
	const groupsById = new Map(groups.map((group) => [group.id, group]));
	const unclassifiedGroup = groups.find(
		(group) => group.group_role === "unclassified",
	);
	if (!unclassifiedGroup) {
		throw new Error("The DB manual-entry catalog has no unclassified nutrient group.");
	}

	const fieldsByNutrientId = new Map(
		fields.flatMap((field) => {
			const nutrientId = toNutrientId(field.nutrient_id);
			return nutrientId === null ? [] : [[nutrientId, field]];
		}),
	);

	const resolveApprovedField = (nutrientId) => {
		const sourceField = fieldsByNutrientId.get(nutrientId);
		const replacementNutrientId = toNutrientId(
			sourceField?.replacement_nutrient_id,
		);
		const canonicalNutrientId =
			sourceField?.classification_status === "retired" &&
			replacementNutrientId !== null
				? replacementNutrientId
				: nutrientId;
		const field = fieldsByNutrientId.get(canonicalNutrientId);

		if (
			!field ||
			!field.enabled ||
			field.classification_status !== "approved"
		) {
			return null;
		}

		const group = groupsById.get(field.group_id);
		if (!group || !group.enabled || group.group_role !== "display") return null;

		return { canonicalNutrientId, field, group };
	};

	return {
		resolve(rawNutrientId) {
			const nutrientId = toNutrientId(rawNutrientId);
			if (nutrientId === null) return null;
			const approved = resolveApprovedField(nutrientId);

			if (!approved) {
				return {
					canonicalNutrientId: nutrientId,
					entryStep: unclassifiedGroup.entry_step,
					groupId: unclassifiedGroup.id,
					groupTitle: unclassifiedGroup.title,
					groupSortOrder: unclassifiedGroup.sort_order,
					nutrientType: "other",
					displayLabel: null,
					fieldSortOrder: 5000,
					dedupeKey: `${unclassifiedGroup.entry_step}:${unclassifiedGroup.id}:${nutrientId}`,
					classificationMethod: "db-catalog-unclassified",
					classificationStatus: "pending_review",
				};
			}

			const { canonicalNutrientId, field, group } = approved;
			return {
				canonicalNutrientId,
				entryStep: group.entry_step,
				groupId: group.id,
				groupTitle: group.title,
				groupSortOrder: group.sort_order,
				nutrientType: field.nutrient_type,
				displayLabel: field.display_label,
				fieldSortOrder: field.sort_order,
				dedupeKey: field.dedupe_key,
				classificationMethod: `db-catalog-v${field.classification_version}`,
				classificationStatus: field.classification_status,
			};
		},
	};
};
