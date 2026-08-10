<script lang="ts">
	import { page } from "$app/state";
	import Bolt from "$lib/assets/icons/Bolt/Bolt.svelte";
	import Bookmark from "$lib/assets/icons/Bookmark/Bookmark.svelte";
	import Leaf from "$lib/assets/icons/Leaf/Leaf.svelte";

	const tabData = [
		{
			label: "Ingredients",
			href: "/ingredients/fridge",
			section: "/ingredients",
			icon: "leaf",
		},
		{
			label: "Mix",
			href: "/mix",
			section: "/mix",
			icon: "bolt",
		},
		{
			label: "Saved",
			href: "/saved",
			section: "/saved",
			icon: "bookmark",
		},
	];

	const isActive = (section: string) =>
		page.url.pathname === section ||
		page.url.pathname.startsWith(`${section}/`);
</script>

<nav class="tab-nav" aria-label="Main navigation">
	<div class="tab-nav__inner">
		{#each tabData as tab}
			<a
				class="tab-btn"
				class:active={isActive(tab.section)}
				aria-current={isActive(tab.section) ? "page" : undefined}
				href={tab.href}
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
