<script lang="ts">
	import {
		getPageCount,
		getPaginationItems,
	} from "$lib/utils/list/listNavigation";
	import type { PaginationProps } from "./types";

	let {
		page,
		pageSize,
		totalItems,
		onPageChange,
		label = "list",
	}: PaginationProps = $props();

	const totalPages = $derived(getPageCount(totalItems, pageSize));
	const pageItems = $derived(getPaginationItems(page, totalPages));
</script>

{#if totalPages > 1}
	<nav class="pagination" aria-label={`${label} pages`}>
		<button
			type="button"
			class="pagination__direction"
			disabled={page <= 1}
			onclick={() => onPageChange(page - 1)}
		>
			Previous
		</button>

		<div class="pagination__pages">
			{#each pageItems as item, index (`${item}-${index}`)}
				{#if item === "ellipsis"}
					<span class="pagination__ellipsis" aria-hidden="true">…</span>
				{:else}
					<button
						type="button"
						class:pagination__page--active={item === page}
						aria-label={`Page ${item}`}
						aria-current={item === page ? "page" : undefined}
						onclick={() => onPageChange(item)}
					>
						{item}
					</button>
				{/if}
			{/each}
		</div>

		<button
			type="button"
			class="pagination__direction"
			disabled={page >= totalPages}
			onclick={() => onPageChange(page + 1)}
		>
			Next
		</button>
	</nav>
{/if}

<style lang="scss">
	@use "./Pagination.scss";
</style>
