<script lang="ts">
	import { page } from "$app/state";
	import Bolt from "$lib/assets/icons/Bolt/Bolt.svelte";
	import Bookmark from "$lib/assets/icons/Bookmark/Bookmark.svelte";
	import Leaf from "$lib/assets/icons/Leaf/Leaf.svelte";

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
	@use "./TabNavigation.scss";
</style>
