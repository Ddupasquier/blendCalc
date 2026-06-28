export type PaginationItem = number | "ellipsis";
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

export const getPageCount = (itemCount: number, pageSize: number) => {
	if (pageSize <= 0) return 1;
	return Math.max(1, Math.ceil(itemCount / pageSize));
};

export const clampPage = (
	page: number,
	itemCount: number,
	pageSize: number,
) => {
	return Math.min(Math.max(1, page), getPageCount(itemCount, pageSize));
};

export const paginateItems = <Item>(
	items: Item[],
	page: number,
	pageSize: number,
) => {
	const safePage = clampPage(page, items.length, pageSize);
	const startIndex = (safePage - 1) * pageSize;
	return items.slice(startIndex, startIndex + pageSize);
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

export const getPaginationItems = (
	page: number,
	totalPages: number,
): PaginationItem[] => {
	if (totalPages <= 5) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const safePage = Math.min(Math.max(1, page), totalPages);
	const pages = new Set([1, totalPages, safePage - 1, safePage, safePage + 1]);
	const sortedPages = [...pages]
		.filter((item) => item >= 1 && item <= totalPages)
		.sort((first, second) => first - second);
	const paginationItems: PaginationItem[] = [];

	for (const [index, item] of sortedPages.entries()) {
		const previousItem = sortedPages[index - 1];
		if (previousItem && item - previousItem > 1) {
			paginationItems.push("ellipsis");
		}
		paginationItems.push(item);
	}

	return paginationItems;
};
