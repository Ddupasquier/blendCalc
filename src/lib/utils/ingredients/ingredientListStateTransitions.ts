import { getFoodIdentityKey } from "$lib/utils/food/records/foodIdentity";
import type { FoodItem } from "$lib/utils/food/types";
import { getOppositeIngredientListKey } from "$lib/utils/ingredients/ingredientListUi";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";
import type { CloudIngredientListIndex } from "$lib/utils/storage/supabase";

export type IngredientListViewState = {
	foodsByList: Record<IngredientListKey, FoodItem[]>;
	totalCountsByList: Record<IngredientListKey, number>;
	listIndex: CloudIngredientListIndex;
};

export type IngredientIdentityMoveResult = {
	nextState: IngredientListViewState;
	removedSourceFoodIds: number[];
};

export const addFoodToIngredientListViewState = (
	state: IngredientListViewState,
	targetListKey: IngredientListKey,
	food: FoodItem,
	addedAt = Date.now(),
): IngredientListViewState => {
	const currentFoods = state.foodsByList[targetListKey];
	const alreadyRendered = currentFoods.some(
		(candidate) => candidate.fdcId === food.fdcId,
	);
	const currentIndex = state.listIndex[targetListKey];
	const alreadyIndexed = currentIndex.foodIds.includes(food.fdcId);

	return {
		foodsByList: alreadyRendered
			? state.foodsByList
			: {
					...state.foodsByList,
					[targetListKey]: [
						{ ...food, listAddedAt: food.listAddedAt ?? addedAt },
						...currentFoods,
					],
				},
		totalCountsByList: alreadyRendered
			? state.totalCountsByList
			: {
					...state.totalCountsByList,
					[targetListKey]: state.totalCountsByList[targetListKey] + 1,
				},
		listIndex: alreadyIndexed
			? state.listIndex
			: {
					...state.listIndex,
					[targetListKey]: {
						foodIds: [food.fdcId, ...currentIndex.foodIds],
						foodIdentityKeys: [
							getFoodIdentityKey(food),
							...currentIndex.foodIdentityKeys,
						],
					},
				},
	};
};

export const removeFoodFromIngredientListViewState = (
	state: IngredientListViewState,
	listKey: IngredientListKey,
	foodId: number,
): IngredientListViewState => {
	const currentIndex = state.listIndex[listKey];

	return {
		foodsByList: {
			...state.foodsByList,
			[listKey]: state.foodsByList[listKey].filter(
				(food) => food.fdcId !== foodId,
			),
		},
		totalCountsByList: {
			...state.totalCountsByList,
			[listKey]: Math.max(0, state.totalCountsByList[listKey] - 1),
		},
		listIndex: {
			...state.listIndex,
			[listKey]: {
				foodIds: currentIndex.foodIds.filter((id) => id !== foodId),
				foodIdentityKeys: currentIndex.foodIdentityKeys.filter(
					(_, index) => currentIndex.foodIds[index] !== foodId,
				),
			},
		},
	};
};

export const renameFoodInIngredientListViewState = (
	state: IngredientListViewState,
	listKey: IngredientListKey,
	foodId: number,
	description: string,
): IngredientListViewState => ({
	...state,
	foodsByList: {
		...state.foodsByList,
		[listKey]: state.foodsByList[listKey].map((food) =>
			food.fdcId === foodId
				? {
						...food,
						canonicalDescription: food.canonicalDescription ?? food.description,
						description,
						nameProvenance: "user" as const,
					}
				: food,
		),
	},
});

export const moveFoodIdentityToIngredientListViewState = (
	state: IngredientListViewState,
	targetListKey: IngredientListKey,
	food: FoodItem,
	movedAt = Date.now(),
): IngredientIdentityMoveResult => {
	const sourceListKey = getOppositeIngredientListKey(targetListKey);
	const foodIdentityKey = getFoodIdentityKey(food);
	const sourceIndex = state.listIndex[sourceListKey];
	const targetIndex = state.listIndex[targetListKey];
	const removedSourceFoodIds = sourceIndex.foodIds.filter(
		(_, index) => sourceIndex.foodIdentityKeys[index] === foodIdentityKey,
	);
	const sourceContainedFood = removedSourceFoodIds.length > 0;
	const targetContainedFood =
		targetIndex.foodIdentityKeys.includes(foodIdentityKey);
	const removeMatchingFood = (foods: FoodItem[]) =>
		foods.filter(
			(candidate) => getFoodIdentityKey(candidate) !== foodIdentityKey,
		);

	return {
		removedSourceFoodIds,
		nextState: {
			foodsByList: {
				...state.foodsByList,
				[sourceListKey]: removeMatchingFood(state.foodsByList[sourceListKey]),
				[targetListKey]: [
					{ ...food, listAddedAt: movedAt },
					...removeMatchingFood(state.foodsByList[targetListKey]),
				],
			},
			totalCountsByList: {
				...state.totalCountsByList,
				[sourceListKey]: sourceContainedFood
					? Math.max(0, state.totalCountsByList[sourceListKey] - 1)
					: state.totalCountsByList[sourceListKey],
				[targetListKey]: targetContainedFood
					? state.totalCountsByList[targetListKey]
					: state.totalCountsByList[targetListKey] + 1,
			},
			listIndex: {
				...state.listIndex,
				[sourceListKey]: {
					foodIds: sourceIndex.foodIds.filter(
						(_, index) =>
							sourceIndex.foodIdentityKeys[index] !== foodIdentityKey,
					),
					foodIdentityKeys: sourceIndex.foodIdentityKeys.filter(
						(identityKey) => identityKey !== foodIdentityKey,
					),
				},
				[targetListKey]: {
					foodIds: [
						food.fdcId,
						...targetIndex.foodIds.filter(
							(_, index) =>
								targetIndex.foodIdentityKeys[index] !== foodIdentityKey,
						),
					],
					foodIdentityKeys: [
						foodIdentityKey,
						...targetIndex.foodIdentityKeys.filter(
							(identityKey) => identityKey !== foodIdentityKey,
						),
					],
				},
			},
		},
	};
};

export const moveFoodsBetweenIngredientListsInViewState = (
	state: IngredientListViewState,
	sourceListKey: IngredientListKey,
	foods: FoodItem[],
	movedAt = Date.now(),
): IngredientListViewState => {
	const targetListKey = getOppositeIngredientListKey(sourceListKey);
	const movedFoodIds = new Set(foods.map((food) => food.fdcId));
	const movedFoods = foods.map((food) => ({ ...food, listAddedAt: movedAt }));
	const sourceIndex = state.listIndex[sourceListKey];
	const targetIndex = state.listIndex[targetListKey];
	const movedIdentityKeys = foods.map(getFoodIdentityKey);
	const movedIdentityKeySet = new Set(movedIdentityKeys);

	return {
		foodsByList: {
			...state.foodsByList,
			[sourceListKey]: state.foodsByList[sourceListKey].filter(
				(food) => !movedFoodIds.has(food.fdcId),
			),
			[targetListKey]: [
				...movedFoods,
				...state.foodsByList[targetListKey].filter(
					(food) => !movedFoodIds.has(food.fdcId),
				),
			],
		},
		totalCountsByList: {
			...state.totalCountsByList,
			[sourceListKey]: Math.max(
				0,
				state.totalCountsByList[sourceListKey] - movedFoods.length,
			),
			[targetListKey]:
				state.totalCountsByList[targetListKey] + movedFoods.length,
		},
		listIndex: {
			...state.listIndex,
			[sourceListKey]: {
				foodIds: sourceIndex.foodIds.filter((id) => !movedFoodIds.has(id)),
				foodIdentityKeys: sourceIndex.foodIdentityKeys.filter(
					(_, index) => !movedFoodIds.has(sourceIndex.foodIds[index]),
				),
			},
			[targetListKey]: {
				foodIds: [
					...foods.map((food) => food.fdcId),
					...targetIndex.foodIds.filter((id) => !movedFoodIds.has(id)),
				],
				foodIdentityKeys: [
					...movedIdentityKeys,
					...targetIndex.foodIdentityKeys.filter(
						(identityKey) => !movedIdentityKeySet.has(identityKey),
					),
				],
			},
		},
	};
};
