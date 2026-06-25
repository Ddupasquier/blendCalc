<script lang="ts">
	import { page } from "$app/state";
	import Bolt from "$lib/assets/icons/Bolt.svelte";
	import Bookmark from "$lib/assets/icons/Bookmark.svelte";
	import Leaf from "$lib/assets/icons/Leaf.svelte";

	const tabData = [
		{
			label: "Ingredients",
			slug: "/fridge",
			icon: "leaf",
		},
		{
			label: "Mix",
			slug: "/mix",
			icon: "bolt",
		},
		{
			label: "Saved",
			slug: "/saved",
			icon: "bookmark",
		},
	];

	const isActive = (slug: string) => page.url.pathname === slug;
</script>

<nav class="tab-nav" aria-label="Main navigation">
	<div class="tab-nav__inner">
		{#each tabData as tab}
			<a
				class="tab-btn"
				class:active={isActive(tab.slug)}
				aria-current={isActive(tab.slug) ? "page" : undefined}
				href={tab.slug}
			>
				{#if tab.icon === "leaf"}
					<Leaf class="tab-btn__icon" />
				{:else if tab.icon === "bolt"}
					<Bolt class="tab-btn__icon" />
				{:else}
					<Bookmark class="tab-btn__icon" />
				{/if}
				<span>{tab.label}</span>
			</a>
		{/each}
	</div>
</nav>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.tab-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		z-index: 90;
		width: 100%;
		min-height: $app-shell-nav-height;
		background: $color-figma-card;
		border-top: 1px solid $color-figma-border;
	}

	.tab-nav__inner {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: center;
		width: min(100%, $app-mobile-shell-width);
		min-height: $app-shell-nav-height;
		margin: 0 auto;
		padding: $app-gap-sm max($app-shell-padding-x, env(safe-area-inset-right))
			calc($app-gap-sm + env(safe-area-inset-bottom))
			max($app-shell-padding-x, env(safe-area-inset-left));
		box-sizing: border-box;
	}

	.tab-btn {
		display: grid;
		place-items: center;
		gap: $app-gap-xs;
		min-width: 0;
		color: $color-figma-muted;
		font-family: $app-button-font-family;
		font-size: $app-font-size-sm;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		text-align: center;
		text-decoration: none;
		transition:
			color 0.16s ease,
			transform 0.16s ease;

		:global(.tab-btn__icon) {
			width: $app-gap-lg;
			height: $app-gap-lg;
		}

		span {
			overflow: hidden;
			max-width: 100%;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&.active {
			color: $color-figma-green;
			transform: translateY(-0.08rem);
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: 2px;
		}
	}

	@media (min-width: $app-breakpoint-md) {
		.tab-nav__inner {
			padding-inline: $app-shell-padding-x;
		}
	}
</style>
