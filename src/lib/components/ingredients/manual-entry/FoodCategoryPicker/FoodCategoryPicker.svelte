<script lang="ts">
	import Chevron from "$lib/assets/icons/Chevron/Chevron.svelte";
	import Search from "$lib/assets/icons/Search/Search.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import WarningPopup from "$lib/components/common/feedback/WarningPopup/WarningPopup.svelte";
	import InputLoadingFrame from "$lib/components/common/forms/InputLoadingFrame/InputLoadingFrame.svelte";
	import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";
	import type { FoodCategoryPickerProps } from "./types";
	import {
		FOOD_CATEGORY_SEARCH_DEBOUNCE_MS,
		loadFoodCategoryPickerData,
		type FoodCategoryPickerData,
		type FoodCategoryPickerOption,
	} from "$lib/utils/food/categories/categoryPicker";

	let {
		selectedId,
		selectedLabel,
		productName,
		sourceCategories,
		warningMessage = "",
		onChange,
		onStatusChange = () => {},
	}: FoodCategoryPickerProps = $props();
	const pickerId = $props.id();
	const triggerId = `${pickerId}-trigger`;
	const panelId = `${pickerId}-panel`;
	const helperId = `${pickerId}-helper`;
	const warningId = `${pickerId}-warning`;
	const suggestionsTitleId = `${pickerId}-suggestions-title`;
	const commonTitleId = `${pickerId}-common-title`;
	const resultsTitleId = `${pickerId}-results-title`;

	let open = $state(false);
	let query = $state("");
	let loading = $state(true);
	let error = $state("");
	let data = $state<FoodCategoryPickerData>({
		suggestions: [],
		common: [],
		results: [],
	});
	let searchInput = $state<HTMLInputElement | null>(null);
	let requestSequence = 0;
	const responseCache = new Map<string, FoodCategoryPickerData>();

	const hasOptions = $derived(
		data.suggestions.length > 0
		|| data.common.length > 0
		|| data.results.length > 0,
	);
	const showInitialOptions = $derived(!query.trim());
	const resultAnnouncement = $derived(
		loading || error
			? ""
			: showInitialOptions
				? `${data.suggestions.length} suggested and ${data.common.length} common categories available.`
				: `${data.results.length} category search ${data.results.length === 1 ? "result" : "results"}.`,
	);

	const restoreTriggerFocus = () => {
		queueMicrotask(() => document.getElementById(triggerId)?.focus());
	};

	const closePicker = (restoreFocus = false) => {
		open = false;
		if (restoreFocus) restoreTriggerFocus();
	};

	const selectOption = (option: FoodCategoryPickerOption) => {
		onChange(option);
		query = "";
		closePicker(true);
	};

	const togglePicker = () => {
		if (open) {
			closePicker();
			return;
		}
		open = true;
		queueMicrotask(() => searchInput?.focus());
	};

	const handlePickerKeydown = (event: KeyboardEvent) => {
		if (event.key !== "Escape" || !open) return;
		event.preventDefault();
		event.stopPropagation();
		closePicker(true);
	};

	$effect(() => {
		const currentProductName = productName.trim();
		const currentSourceCategories = sourceCategories.map((value) => value.trim());
		const currentQuery = open ? query.trim() : "";
		const requestKey = JSON.stringify([
			currentProductName,
			currentQuery,
			currentSourceCategories,
		]);
		const cachedData = responseCache.get(requestKey);
		if (cachedData) {
			data = cachedData;
			loading = false;
			error = "";
			return;
		}
		const controller = new AbortController();
		const sequence = ++requestSequence;
		const delay = currentQuery ? FOOD_CATEGORY_SEARCH_DEBOUNCE_MS : 0;
		const timer = window.setTimeout(() => {
			loading = true;
			error = "";
			void loadFoodCategoryPickerData({
				productName: currentProductName,
				query: currentQuery,
				sourceCategories: currentSourceCategories,
				signal: controller.signal,
			})
				.then((nextData) => {
					if (sequence !== requestSequence) return;
					responseCache.set(requestKey, nextData);
					data = nextData;
				})
				.catch((requestError: unknown) => {
					if (controller.signal.aborted || sequence !== requestSequence) return;
					console.error("[food categories] Picker request failed", requestError);
					error = getUserFacingErrorMessage(requestError, {
						fallback: "We couldn't load food categories. Try again.",
						network:
							"We couldn't connect to load food categories. Check your connection and try again.",
						timeout:
							"Food categories took too long to load. Check your connection and try again.",
					});
				})
				.finally(() => {
					if (sequence === requestSequence) loading = false;
				});
		}, delay);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	});

	$effect(() => {
		onStatusChange({ error, hasOptions, loading });
	});
</script>

<div class="food-category-picker">
	<span class="food-category-picker__label">Category <em>*</em></span>
	<RoundedActionButton
		id={triggerId}
		variant="quiet"
		contentAlign="space-between"
		fullWidth
		busy={loading && !open}
		ariaLabel="Category"
		aria-controls={panelId}
		aria-describedby={warningMessage ? warningId : undefined}
		aria-expanded={open}
		onclick={togglePicker}
	>
		<span class="food-category-picker__trigger-label">
			{selectedLabel || "Choose a category"}
		</span>
		{#if !loading || open}
			<Chevron direction={open ? "up" : "down"} />
		{/if}
	</RoundedActionButton>

	{#if open}
		<div
			id={panelId}
			class="food-category-picker__panel"
			role="dialog"
			aria-modal="false"
			aria-labelledby={triggerId}
			tabindex="-1"
			onkeydown={handlePickerKeydown}
		>
			<label class="food-category-picker__search">
				<span class="food-category-picker__search-label">Search categories</span>
				<InputLoadingFrame
					loading={loading}
					loadingLabel="Searching categories"
				>
					<span class="food-category-picker__search-control">
						<Search class="food-category-picker__search-icon" />
						<input
							bind:this={searchInput}
							type="search"
							aria-describedby={helperId}
							placeholder="e.g. Protein bars, vegetables, sauces"
							value={query}
							oninput={(event) => (query = event.currentTarget.value)}
						/>
					</span>
				</InputLoadingFrame>
			</label>

			<p id={helperId} class="food-category-picker__helper">
				Choose a broad match, or search for a more specific category.
			</p>

			{#if error}
				<StatusMessage tone="danger" title="Categories unavailable">
					{error}
				</StatusMessage>
			{:else if showInitialOptions}
				{#if data.suggestions.length}
					<section class="food-category-picker__group" aria-labelledby={suggestionsTitleId}>
						<div class="food-category-picker__group-heading">
							<h3 id={suggestionsTitleId}>Suggested</h3>
							<small>Based on this ingredient’s source details</small>
						</div>
						<div class="food-category-picker__options">
							{#each data.suggestions as option (option.id)}
								<RoundedActionButton
									fullWidth
									contentAlign="start"
									variant={selectedId === option.id ? "primary" : "neutral"}
									aria-pressed={selectedId === option.id}
									onclick={() => selectOption(option)}
								>
									{option.label}
								</RoundedActionButton>
							{/each}
						</div>
					</section>
				{/if}

				{#if data.common.length}
					<section class="food-category-picker__group" aria-labelledby={commonTitleId}>
						<div class="food-category-picker__group-heading">
							<h3 id={commonTitleId}>Common categories</h3>
							<small>Verified across multiple food sources</small>
						</div>
						<div class="food-category-picker__options">
							{#each data.common as option (option.id)}
								<RoundedActionButton
									fullWidth
									contentAlign="start"
									variant={selectedId === option.id ? "primary" : "neutral"}
									aria-pressed={selectedId === option.id}
									onclick={() => selectOption(option)}
								>
									{option.label}
								</RoundedActionButton>
							{/each}
						</div>
					</section>
				{/if}
			{:else if !loading}
				<section class="food-category-picker__group" aria-labelledby={resultsTitleId}>
					<div class="food-category-picker__group-heading">
						<h3 id={resultsTitleId}>Search results</h3>
					</div>
					{#if data.results.length}
						<div class="food-category-picker__options">
							{#each data.results as option (option.id)}
								<RoundedActionButton
									fullWidth
									contentAlign="start"
									variant={selectedId === option.id ? "primary" : "neutral"}
									aria-pressed={selectedId === option.id}
									onclick={() => selectOption(option)}
								>
									{option.label}
								</RoundedActionButton>
							{/each}
						</div>
					{:else}
						<p class="food-category-picker__empty">
							No matching category found. Try a broader food term.
						</p>
					{/if}
				</section>
			{/if}
			<p class="sr-only" aria-live="polite" aria-atomic="true">
				{resultAnnouncement}
			</p>
		</div>
	{/if}

	{#if warningMessage}
		<div id={warningId}>
			<WarningPopup message={warningMessage} tone="error" />
		</div>
	{/if}
</div>

<style lang="scss">
	@use "./FoodCategoryPicker.scss";
</style>
