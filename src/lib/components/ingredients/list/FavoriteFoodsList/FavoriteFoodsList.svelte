<script lang="ts">
	import { onMount } from "svelte";
	import FavoriteButton from "$lib/components/common/actions/FavoriteButton/FavoriteButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import CardWarningFrame from "$lib/components/common/display/CardWarningFrame/CardWarningFrame.svelte";
	import IngredientCardMedia from "$lib/components/ingredients/card/IngredientCardMedia/IngredientCardMedia.svelte";
	import {
		getFoodWarningFrameTone,
		getPrimaryFoodWarning,
		getFoodDisplayCategory,
	} from "$lib/utils/ingredients/ingredientListUi";
	import { FAVORITES_CHANGED_EVENT } from "$lib/utils/favorites/types";
	import type { FoodItem } from "$lib/utils/food/types";
	import type { FavoriteFoodsListProps } from "./types";
	let { query, sort, safety, onPreview }: FavoriteFoodsListProps = $props();
	let foods = $state<FoodItem[]>([]),
		totalCount = $state(0),
		busy = $state(false),
		error = $state("");
	let generation = 0;
	let abort: AbortController | null = null;
	const load = async (more = false) => {
		const current = ++generation;
		abort?.abort();
		const controller = new AbortController();
		abort = controller;
		const timer = setTimeout(() => controller.abort(), 30000);
		busy = true;
		error = "";
		const offset = more ? foods.length : 0;
		try {
			const response = await fetch(
				`/api/favorites?${new URLSearchParams({ kind: "food", q: query, sort, safety, limit: "15", offset: String(offset) })}`,
				{ signal: controller.signal },
			);
			if (!response.ok) throw new Error("Unavailable favorites");
			const page = await response.json();
			if (current === generation) {
				foods = more ? [...foods, ...page.foods] : page.foods;
				totalCount = page.totalCount;
			}
		} catch {
			if (current === generation)
				error = "Your favorite foods could not load. Try again.";
		} finally {
			clearTimeout(timer);
			if (current === generation) busy = false;
		}
	};
	$effect(() => {
		query;
		sort;
		safety;
		void load();
	});
	onMount(() => {
		const changed = () => void load();
		window.addEventListener(FAVORITES_CHANGED_EVENT, changed);
		return () => {
			generation++;
			abort?.abort();
			window.removeEventListener(FAVORITES_CHANGED_EVENT, changed);
		};
	});
</script>

<section
	class="favorite-foods-list"
	aria-label="Favorite foods"
	aria-busy={busy}
>
	<h2>Favorite foods</h2>
	<p>Favorites stay here when foods move or leave your lists.</p>
	{#if error}<StatusMessage tone="danger" message={error} /><RoundedActionButton
			onclick={() => void load()}>Retry favorites</RoundedActionButton
		>{/if}
	{#if foods.length}
		<ul aria-label="Favorite foods">
			{#each foods as food (food.fdcId)}
				{@const warning = getPrimaryFoodWarning(food)}
				{@const tone = getFoodWarningFrameTone(food)}
				<li>
					<article class="favorite-foods-list__card">
						<IngredientCardMedia {food} />
						{#if warning && tone}<CardWarningFrame {tone} />{/if}
						<button
							class="favorite-foods-list__preview"
							aria-label={`Preview ${food.description}${warning ? `. Warning: ${warning}` : ""}`}
							onclick={() => onPreview(food)}
						></button>
						<span class="favorite-foods-list__copy"
							><strong>{food.description}</strong><small
								>{getFoodDisplayCategory(food)}</small
							></span
						>
						<span class="favorite-foods-list__action"
							><FavoriteButton
								kind="food"
								targetId={String(food.fdcId)}
								name={food.description}
								initialState={{ favorite: true }}
							/></span
						>
					</article>
				</li>
			{/each}
		</ul>
	{:else if busy}<p role="status">Loading favorite foods…</p>
	{:else if !error}<p>
			No favorite foods match. Star a food from its card or Food check details,
			or change your filters.
		</p>{/if}
	{#if foods.length < totalCount}<RoundedActionButton
			{busy}
			onclick={() => void load(true)}
			>Load more favorite foods</RoundedActionButton
		>{/if}
	<p role="status">{totalCount} favorite foods</p>
</section>

<style lang="scss">
	@use "./FavoriteFoodsList.scss";
</style>
