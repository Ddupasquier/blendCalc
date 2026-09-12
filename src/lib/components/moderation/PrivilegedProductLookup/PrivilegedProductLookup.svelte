<script lang="ts">
	import { onMount, tick } from "svelte";
	import Barcode from "$lib/assets/icons/Barcode/Barcode.svelte";
	import GripVertical from "$lib/assets/icons/GripVertical/GripVertical.svelte";
	import X from "$lib/assets/icons/X/X.svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import SegmentedControl from "$lib/components/common/buttons/SegmentedControl/SegmentedControl.svelte";
	import type { SegmentedControlButtonOption } from "$lib/components/common/buttons/SegmentedControl/types";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import PrivilegedProductPurge from "$lib/components/moderation/PrivilegedProductPurge/PrivilegedProductPurge.svelte";
	import CheckboxField from "$lib/components/common/forms/CheckboxField/CheckboxField.svelte";
	import TextField from "$lib/components/common/forms/TextField/TextField.svelte";
	import { getUserFacingErrorMessage } from "$lib/utils/errors/userFacingErrors";
	import { formatNutritionAmount } from "$lib/utils/food/nutrients/nutritionDisplay";
	import { formatNutrientUnitNameForDisplay } from "$lib/utils/food/nutrients/nutrientUnitNames";
	import { getFoodNutrientMeasurementBasis } from "$lib/utils/food/nutrients/foodNutrients";
	import { getFoodServings } from "$lib/utils/food/servings/foodServings";
	import type { FoodItem } from "$lib/utils/food/types";
	import {
		comparePrivilegedLookupProducts,
		type PrivilegedProductLookupResponse,
		type PrivilegedProductLookupResult,
		type PrivilegedProductLookupScope,
	} from "$lib/utils/moderation/privilegedProductLookup";

	const panelId = "privileged-product-lookup-panel";
	const searchInputId = "privileged-product-lookup-query";
	const desktopMediaQuery = "(min-width: 681px)";
	const panelMargin = 16;
	const minimumPanelTop = 72;
	const scopeOptions = [
		{ value: "stored", label: "Stored in blendCalc" },
		{ value: "live", label: "Live provider APIs" },
	] satisfies SegmentedControlButtonOption[];

	let open = $state(false);
	let query = $state("");
	let scope = $state<PrivilegedProductLookupScope>("stored");
	let results = $state<PrivilegedProductLookupResult[]>([]);
	let completedQuery = $state("");
	let responseNote = $state("");
	let loading = $state(false);
	let error = $state("");
	let primary = $state<PrivilegedProductLookupResult | null>(null);
	let comparison = $state<PrivilegedProductLookupResult | null>(null);
	let showMatches = $state(false);
	let panelElement = $state<HTMLElement | null>(null);
	let launcherElement = $state<HTMLButtonElement | null>(null);
	let searchInputElement = $state<HTMLInputElement | null>(null);
	let panelX = $state<number | null>(null);
	let panelY = $state<number | null>(null);
	let requestController: AbortController | null = null;
	let dragStart:
		| {
				pointerId: number;
				clientX: number;
				clientY: number;
				panelX: number;
				panelY: number;
		  }
		| undefined;

	const comparisonSummary = $derived.by(() =>
		primary && comparison
			? comparePrivilegedLookupProducts(primary, comparison)
			: null,
	);
	const visibleComparisonRows = $derived(
		comparisonSummary?.rows.filter(
			(row) => showMatches || row.status !== "match",
		) ?? [],
	);
	const selectedProducts = $derived(
		primary ? (comparison ? [primary, comparison] : [primary]) : [],
	);
	const resultAnnouncement = $derived(
		completedQuery
			? `${results.length} ${results.length === 1 ? "result" : "results"} for ${completedQuery}.`
			: "",
	);

	const clampPanelPosition = (x: number, y: number) => {
		if (!panelElement) return { x, y };
		const rect = panelElement.getBoundingClientRect();
		return {
			x: Math.min(
				Math.max(panelMargin, x),
				Math.max(panelMargin, window.innerWidth - rect.width - panelMargin),
			),
			y: Math.min(
				Math.max(minimumPanelTop, y),
				Math.max(
					minimumPanelTop,
					window.innerHeight - rect.height - panelMargin,
				),
			),
		};
	};

	const placePanelAtDefault = async () => {
		await tick();
		if (!panelElement) return;
		const rect = panelElement.getBoundingClientRect();
		const next = clampPanelPosition(
			window.innerWidth - rect.width - 24,
			minimumPanelTop + 8,
		);
		panelX = next.x;
		panelY = next.y;
	};

	const keepPanelInsideViewport = async () => {
		await tick();
		if (!panelElement) return;
		const rect = panelElement.getBoundingClientRect();
		const next = clampPanelPosition(rect.left, rect.top);
		if (panelX !== next.x) panelX = next.x;
		if (panelY !== next.y) panelY = next.y;
	};

	const openLookup = async () => {
		open = true;
		await placePanelAtDefault();
		searchInputElement?.focus({ preventScroll: true });
	};

	const closeLookup = () => {
		requestController?.abort();
		open = false;
		dragStart = undefined;
		void tick().then(() => launcherElement?.focus({ preventScroll: true }));
	};

	const searchProducts = async () => {
		const cleanQuery = query.trim();
		if (cleanQuery.length < 2) {
			error = "Enter at least 2 characters or a complete UPC / GTIN.";
			return;
		}
		requestController?.abort();
		const controller = new AbortController();
		requestController = controller;
		loading = true;
		error = "";
		responseNote = "";
		try {
			const params = new URLSearchParams({ q: cleanQuery, scope });
			const response = await fetch(`/api/moderation/product-lookup?${params}`, {
				signal: controller.signal,
			});
			if (!response.ok)
				throw new Error(`Product lookup failed (${response.status})`);
			const data = (await response.json()) as PrivilegedProductLookupResponse;
			if (controller.signal.aborted) return;
			results = data.results;
			completedQuery = data.query;
			responseNote = data.note ?? "";
		} catch (lookupError) {
			if (controller.signal.aborted) return;
			results = [];
			completedQuery = cleanQuery;
			error = getUserFacingErrorMessage(lookupError, {
				fallback: "Product lookup is unavailable right now. Try again.",
				network:
					"Product lookup could not connect. Check your connection and try again.",
			});
		} finally {
			if (requestController === controller) requestController = null;
			if (!controller.signal.aborted) loading = false;
		}
	};

	const selectScope = (nextScope: PrivilegedProductLookupScope) => {
		if (scope === nextScope) return;
		requestController?.abort();
		scope = nextScope;
		results = [];
		completedQuery = "";
		responseNote = "";
		error = "";
	};

	const viewResult = (result: PrivilegedProductLookupResult) => {
		primary = result;
		comparison = null;
		showMatches = false;
	};

	const compareResult = (result: PrivilegedProductLookupResult) => {
		if (!primary) {
			primary = result;
			return;
		}
		if (primary.id === result.id) return;
		comparison = result;
		showMatches = false;
	};

	const startDrag = (event: PointerEvent) => {
		if (!panelElement) return;
		const rect = panelElement.getBoundingClientRect();
		panelX = rect.left;
		panelY = rect.top;
		dragStart = {
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			panelX: rect.left,
			panelY: rect.top,
		};
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
	};

	const moveDrag = (event: PointerEvent) => {
		if (!dragStart || dragStart.pointerId !== event.pointerId) return;
		const next = clampPanelPosition(
			dragStart.panelX + event.clientX - dragStart.clientX,
			dragStart.panelY + event.clientY - dragStart.clientY,
		);
		panelX = next.x;
		panelY = next.y;
	};

	const finishDrag = (event: PointerEvent) => {
		if (dragStart?.pointerId === event.pointerId) dragStart = undefined;
	};

	const moveWithKeyboard = (event: KeyboardEvent) => {
		if (!panelElement || !event.key.startsWith("Arrow")) return;
		event.preventDefault();
		const step = event.shiftKey ? 48 : 16;
		const rect = panelElement.getBoundingClientRect();
		const deltaX =
			event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
		const deltaY =
			event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
		const next = clampPanelPosition(rect.left + deltaX, rect.top + deltaY);
		panelX = next.x;
		panelY = next.y;
	};

	const getBarcode = (food: FoodItem) =>
		food.barcode ?? food.gtinUpc ?? "Not available";

	const getServing = (food: FoodItem) => {
		const serving = getFoodServings(food)[0];
		if (!serving) return "No exact serving stored";
		return typeof serving.gramWeight === "number"
			? `${serving.label} · ${serving.gramWeight} g`
			: serving.label;
	};

	const getNutrientBasis = (nutrient: FoodItem["foodNutrients"][number]) => {
		const basis = getFoodNutrientMeasurementBasis(nutrient);
		return basis.kind === "serving"
			? `per ${basis.servingLabel}`
			: `per ${basis.quantity} ${basis.unitKey}`;
	};

	const getComparisonStatusLabel = (
		status: "match" | "different" | "missing" | "not-comparable",
	) => {
		if (status === "different") return "Different";
		if (status === "missing") return "Missing from one source";
		if (status === "not-comparable") return "Review basis";
		return "Match";
	};

	$effect(() => {
		if (!open) return;
		void comparison;
		void keepPanelInsideViewport();
	});

	onMount(() => {
		if (typeof window.matchMedia !== "function") return;
		const desktopQuery = window.matchMedia(desktopMediaQuery);
		const handleMediaChange = () => {
			if (!desktopQuery.matches && open) closeLookup();
		};
		const handleResize = () => {
			if (panelX === null || panelY === null) return;
			const next = clampPanelPosition(panelX, panelY);
			panelX = next.x;
			panelY = next.y;
		};
		const handleKeydown = (event: KeyboardEvent) => {
			if (open && event.key === "Escape") closeLookup();
		};
		desktopQuery.addEventListener("change", handleMediaChange);
		window.addEventListener("resize", handleResize);
		window.addEventListener("keydown", handleKeydown);
		return () => {
			requestController?.abort();
			desktopQuery.removeEventListener("change", handleMediaChange);
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("keydown", handleKeydown);
		};
	});
</script>

<div
	class="privileged-product-lookup-toolbar"
	class:privileged-product-lookup-toolbar--open={open}
	aria-label="Desktop tools"
>
	<span class="privileged-product-lookup-toolbar__label">Tools</span>
	<RoundedActionButton
		bind:element={launcherElement}
		variant="neutral"
		aria-expanded={open}
		aria-controls={panelId}
		onclick={() => void openLookup()}
	>
		<Barcode width={18} height={14} />
		<span>Product lookup</span>
	</RoundedActionButton>
	<PrivilegedProductPurge />
</div>

{#if open}
	<div
		bind:this={panelElement}
		id={panelId}
		class="privileged-product-lookup"
		class:privileged-product-lookup--comparing={Boolean(comparison)}
		style:left={panelX === null ? undefined : `${panelX}px`}
		style:top={panelY === null ? undefined : `${panelY}px`}
		role="dialog"
		aria-label="Product lookup and comparison"
	>
		<header class="privileged-product-lookup__header">
			<RoundedActionButton
				type="button"
				variant="quiet"
				contentAlign="start"
				className="privileged-product-lookup__drag-handle"
				ariaLabel="Move product lookup. Use arrow keys to move; hold Shift for larger steps."
				onpointerdown={startDrag}
				onpointermove={moveDrag}
				onpointerup={finishDrag}
				onpointercancel={finishDrag}
				onlostpointercapture={finishDrag}
				onkeydown={moveWithKeyboard}
			>
				<GripVertical size={18} />
				<span>
					<strong>Product lookup</strong>
					<small>Drag this handle to keep it beside your work.</small>
				</span>
			</RoundedActionButton>
			<CircleIconButton
				label="Close product lookup"
				variant="ghost"
				size="small"
				onclick={closeLookup}
			>
				<X size={18} />
			</CircleIconButton>
		</header>

		<div class="privileged-product-lookup__body">
			<div class="privileged-product-lookup__scope">
				<SegmentedControl
					label="Lookup source"
					options={scopeOptions}
					value={scope}
					onSelect={(value) =>
						selectScope(value === "live" ? "live" : "stored")}
				/>
			</div>
			<p class="privileged-product-lookup__scope-help">
				{scope === "stored"
					? "Search the exact active catalog data blendCalc currently uses."
					: "Request provider data for comparison. Results do not change the approved catalog or record a moderation decision."}
			</p>

			<form
				class="privileged-product-lookup__search"
				onsubmit={(event) => {
					event.preventDefault();
					void searchProducts();
				}}
			>
				<div class="privileged-product-lookup__search-row">
					<TextField
						bind:element={searchInputElement}
						id={searchInputId}
						label="Product name or UPC / GTIN"
						type="search"
						placeholder="Example: Greek yogurt or 00076808006568"
						autocomplete="off"
						maxlength={120}
						value={query}
						oninput={(event) => (query = event.currentTarget.value)}
					/>
					<RoundedActionButton type="submit" busy={loading}>
						Look up
					</RoundedActionButton>
				</div>
			</form>

			<p class="sr-only" aria-live="polite">{resultAnnouncement}</p>
			{#if error}
				<StatusMessage tone="danger" message={error} />
			{:else if responseNote}
				<StatusMessage
					tone="info"
					title="Provider scope"
					message={responseNote}
				/>
			{/if}

			{#if completedQuery && !loading && !error && results.length === 0}
				<StatusMessage
					tone="info"
					title="No matching product found"
					message={`No ${scope === "stored" ? "stored catalog" : "provider"} result matched “${completedQuery}”. Try a different name or verify the complete barcode.`}
				/>
			{/if}

			{#if results.length > 0}
				<section
					class="privileged-product-lookup__results"
					aria-labelledby="privileged-product-lookup-results-title"
				>
					<div class="privileged-product-lookup__section-heading">
						<h2 id="privileged-product-lookup-results-title">Results</h2>
						<span>{results.length}</span>
					</div>
					<div class="privileged-product-lookup__result-list">
						{#each results as result (result.id)}
							<article
								class="privileged-product-lookup__result"
								class:privileged-product-lookup__result--selected={primary?.id ===
									result.id || comparison?.id === result.id}
							>
								<div>
									<strong>{result.food.description}</strong>
									<span
										>{result.food.brandOwner || "Brand not stored"} · {result.providerLabel}</span
									>
									<small>UPC / GTIN: {getBarcode(result.food)}</small>
								</div>
								<div class="privileged-product-lookup__result-actions">
									<RoundedActionButton
										variant="quiet"
										onclick={() => viewResult(result)}
									>
										View as A
									</RoundedActionButton>
									<RoundedActionButton
										variant="quiet"
										disabled={!primary || primary.id === result.id}
										onclick={() => compareResult(result)}
									>
										Compare with A
									</RoundedActionButton>
								</div>
							</article>
						{/each}
					</div>
				</section>
			{/if}

			{#if primary}
				<section
					class="privileged-product-lookup__selection"
					aria-labelledby="privileged-product-lookup-selection-title"
				>
					<div class="privileged-product-lookup__section-heading">
						<h2 id="privileged-product-lookup-selection-title">
							{comparison ? "Product comparison" : "Product A"}
						</h2>
						{#if comparisonSummary}<span
								>{comparisonSummary.differenceCount} findings</span
							>{/if}
					</div>
					<div class="privileged-product-lookup__product-columns">
						{#each selectedProducts as selected, index (selected.id)}
							<article class="privileged-product-lookup__product-card">
								<small
									>Product {index === 0 ? "A" : "B"} · {selected.providerLabel}</small
								>
								<h3>{selected.food.description}</h3>
								<p>{selected.food.brandOwner || "Brand not stored"}</p>
								<dl>
									<div>
										<dt>UPC / GTIN</dt>
										<dd>{getBarcode(selected.food)}</dd>
									</div>
									<div>
										<dt>Serving</dt>
										<dd>{getServing(selected.food)}</dd>
									</div>
									<div>
										<dt>Nutrients</dt>
										<dd>{selected.food.foodNutrients.length} reported</dd>
									</div>
								</dl>
							</article>
						{/each}
					</div>

					{#if comparison && comparisonSummary}
						<div class="privileged-product-lookup__comparison-controls">
							<p>
								Differences are highlighted. Comparable nutrients use the same
								100 g basis.
							</p>
							<CheckboxField
								id="privileged-product-lookup-show-matches"
								checked={showMatches}
								onchange={(event) =>
									(showMatches = event.currentTarget.checked)}
							>
								Show matching fields
							</CheckboxField>
						</div>
						<div
							class="privileged-product-lookup__comparison-table"
							role="table"
							aria-label="Product differences"
						>
							<div
								class="privileged-product-lookup__comparison-header"
								role="row"
							>
								<span role="columnheader">Field</span>
								<span role="columnheader">Product A</span>
								<span role="columnheader">Product B</span>
							</div>
							{#each visibleComparisonRows as row (row.key)}
								<div
									class="privileged-product-lookup__comparison-row"
									data-status={row.status}
									role="row"
								>
									<span role="cell"
										><strong>{row.label}</strong><em
											>{getComparisonStatusLabel(row.status)}</em
										>{#if row.detail}<small>{row.detail}</small>{/if}</span
									>
									<span role="cell">{row.leftValue}</span>
									<span role="cell">{row.rightValue}</span>
								</div>
							{/each}
						</div>
					{:else}
						<div class="privileged-product-lookup__nutrition">
							<h3>Reported nutrients</h3>
							{#if primary.food.foodNutrients.length > 0}
								<ul>
									{#each primary.food.foodNutrients as nutrient (nutrient.nutrientId)}
										<li>
											<span
												>{nutrient.nutrientName}<small
													>{getNutrientBasis(nutrient)}</small
												></span
											><strong
												>{formatNutritionAmount(nutrient.value)}
												{formatNutrientUnitNameForDisplay(
													nutrient.unitName,
												)}</strong
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p>No numeric nutrient values were reported by this source.</p>
							{/if}
						</div>
					{/if}
				</section>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	@use "./PrivilegedProductLookup.scss";
</style>
