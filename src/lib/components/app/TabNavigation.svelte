<script lang="ts">
	import { page } from "$app/state";

	const tabData = [
		{
			label: "Ingredients",
			slug: "/fridge",
			iconPath:
				"M6.5 13.5C6.5 8.5 10.5 5 17 5c.2 6.5-3.3 10.5-8.3 10.5H6.5v-2Zm0 0C5.3 15 5 16.8 5 19",
		},
		{
			label: "Mix",
			slug: "/mix",
			iconPath: "M13 2 5 13h6l-1 9 9-13h-6l1-7Z",
		},
		{
			label: "Saved",
			slug: "/saved",
			iconPath: "M7 4.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16l-5-3-5 3v-16Z",
		},
	];

	const isActive = (slug: string) => page.url.pathname === slug;
</script>

<nav class="tab-nav" aria-label="Main navigation">
	{#each tabData as tab}
		<a
			class="tab-btn"
			class:active={isActive(tab.slug)}
			aria-current={isActive(tab.slug) ? "page" : undefined}
			href={tab.slug}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d={tab.iconPath} />
			</svg>
			<span>{tab.label}</span>
		</a>
	{/each}
</nav>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.tab-nav {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 90;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: center;
		padding: 0.72rem max(1rem, env(safe-area-inset-right))
			calc(0.72rem + env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
		background: $app-bg;
		border-top: $app-border;
	}

	.tab-btn {
		display: grid;
		place-items: center;
		gap: 0.22rem;
		min-width: 0;
		color: color-mix(in srgb, $app-muted 72%, $color-blueberry-milk);
		font-family: $app-button-font-family;
		font-size: $app-font-size-sm;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		text-align: center;
		text-decoration: none;
		transition:
			color 0.16s ease,
			transform 0.16s ease;

		svg {
			width: 1.35rem;
			height: 1.35rem;
			fill: none;
			stroke: currentColor;
			stroke-linecap: round;
			stroke-linejoin: round;
			stroke-width: 1.85;
		}

		span {
			overflow: hidden;
			max-width: 100%;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&.active {
			color: color-mix(in srgb, $app-success-bg 42%, #29955f);
			transform: translateY(-0.08rem);
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: 2px;
		}
	}

	@media (min-width: $app-breakpoint-md) {
		.tab-nav {
			left: 50%;
			width: min($app-max-width, 100%);
			transform: translateX(-50%);
		}
	}
</style>
