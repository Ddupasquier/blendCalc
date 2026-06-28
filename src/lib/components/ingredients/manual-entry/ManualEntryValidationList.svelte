<script lang="ts">
	export type ManualEntryValidationItem = {
		message: string;
		tone: "error" | "warning";
	};

	let {
		items,
	}: {
		items: ManualEntryValidationItem[];
	} = $props();
</script>

{#if items.length > 0}
	<ul class="manual-entry-validation" aria-label="Manual entry validation">
		{#each items as item}
			<li class:manual-entry-validation__item--warning={item.tone === "warning"}>
				<span aria-hidden="true">⚠</span>
				{item.message}
			</li>
		{/each}
	</ul>
{/if}

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.manual-entry-validation {
		display: grid;
		gap: $app-gap-sm;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: $app-gap-sm;
		padding: 0.8rem 0.95rem;
		color: $color-figma-ink;
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-medium;
		background: color-mix(in srgb, $color-strawberry-cream 55%, white);
		border-radius: $app-rebuild-radius-pill;
	}

	.manual-entry-validation__item--warning {
		background: color-mix(in srgb, $color-mango-gold 35%, white);
	}

	span {
		color: $color-guava-laser;
		font-size: $app-font-size-md;
		line-height: 1;
	}

	.manual-entry-validation__item--warning span {
		color: $color-mango-gold-dark;
	}
</style>
