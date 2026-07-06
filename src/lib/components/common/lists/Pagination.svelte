<script lang="ts">
	import {
		getPageCount,
		getPaginationItems,
	} from "$lib/utils/list/listNavigation";

	let {
		page,
		pageSize,
		totalItems,
		onPageChange,
		label = "list",
	}: {
		page: number;
		pageSize: number;
		totalItems: number;
		onPageChange: (page: number) => void;
		label?: string;
	} = $props();

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
	@use "../../../../styles/variables" as *;

	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: $app-gap-xs;
		width: 100%;
		margin-top: $app-gap-sm;
	}

	.pagination__pages {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	button {
		min-width: $app-control-height-sm;
		height: $app-control-height-sm;
		padding: 0 0.55rem;
		color: $app-primary;
		background: $app-bg;
		border: $app-border;
		border-radius: $app-radius-pill;
		font-family: $app-button-font-family;
		font-size: $app-font-size-sm;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
	}

	button:hover:not(:disabled),
	button:focus-visible,
	.pagination__page--active {
		background: $app-accent;
	}

	button:focus-visible {
		outline: 2px solid $app-primary;
		outline-offset: 1px;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.pagination__page--active {
		border-color: $app-primary;
	}

	.pagination__ellipsis {
		min-width: 1rem;
		color: $app-muted;
		text-align: center;
	}

	@media (max-width: $app-breakpoint-xs) {
		.pagination {
			justify-content: space-between;
		}

		.pagination__direction {
			padding-inline: 0.45rem;
		}

		.pagination__pages button:not(.pagination__page--active),
		.pagination__ellipsis {
			display: none;
		}
	}
</style>
