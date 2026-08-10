export type FoodListSort = "recent" | "oldest" | "name-asc" | "name-desc";

export const FOOD_LIST_SORT_OPTIONS = [
	{ value: "recent", label: "Newest first" },
	{ value: "oldest", label: "Oldest first" },
	{ value: "name-asc", label: "A → Z" },
	{ value: "name-desc", label: "Name Z–A" },
] as const;

export const normalizeListQuery = (query: string) => {
	return query.trim().toLocaleLowerCase();
};

export const filterItemsByQuery = <Item>(
	items: Item[],
	query: string,
	getSearchableText: (item: Item) => string,
) => {
	const terms = normalizeListQuery(query).split(/\s+/).filter(Boolean);
	if (terms.length === 0) return items;

	return items.filter((item) => {
		const searchableText = getSearchableText(item).toLocaleLowerCase();
		return terms.every((term) => searchableText.includes(term));
	});
};

export const sortFoodListItems = <Item>(
	items: Item[],
	sort: FoodListSort,
	getName: (item: Item) => string,
	getAddedAt: (item: Item) => number | undefined,
) => {
	return [...items].sort((first, second) => {
		if (sort === "name-asc") {
			return getName(first).localeCompare(getName(second));
		}

		if (sort === "name-desc") {
			return getName(second).localeCompare(getName(first));
		}

		const firstAddedAt = getAddedAt(first);
		const secondAddedAt = getAddedAt(second);
		if (firstAddedAt !== undefined || secondAddedAt !== undefined) {
			if (sort === "oldest") {
				return (
					(firstAddedAt ?? Number.MAX_SAFE_INTEGER) -
					(secondAddedAt ?? Number.MAX_SAFE_INTEGER)
				);
			}

			return (secondAddedAt ?? 0) - (firstAddedAt ?? 0);
		}

		return items.indexOf(second) - items.indexOf(first);
	});
};
