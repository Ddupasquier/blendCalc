<script lang="ts">
	import SmoothieCup from "$lib/assets/icons/SmoothieCup.svelte";
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame.svelte";
	import type { AppHeaderProps } from "$lib/components/app/types";
	import { APP_NAME } from "$lib/config/brand";

	let {
		displayName,
		avatarUrl = null,
		avatarAltText = null,
		role = null,
	}: AppHeaderProps = $props();

	const initials = $derived(
		displayName
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toLocaleUpperCase())
			.join("") || "U",
	);
</script>

<header class="app-header">
	<div class="app-header__inner">
		<a class="app-header__brand" href="/fridge" aria-label={`Open ${APP_NAME} ingredients`}>
			<span class="app-header__mark" aria-hidden="true">
				<SmoothieCup size={22} />
			</span>
			<span class="app-header__title">{APP_NAME}</span>
		</a>

		<a
			class="app-header__profile"
			class:app-header__profile--moderator={role}
			href="/profile"
			aria-label={`Open profile for ${displayName}`}
			title={displayName}
		>
			{#if role}
				<PrivilegedActionBadge
					class="app-header__crown"
					variant="profile"
					label="Moderator account"
				/>
			{/if}

			<CircularMediaFrame class="app-header__avatar">
				{#if avatarUrl}
					<img src={avatarUrl} alt={avatarAltText ?? ""} />
				{:else}
					<span class="app-header__initials" aria-hidden="true">{initials}</span>
				{/if}
			</CircularMediaFrame>
		</a>
	</div>
</header>

<style lang="scss">
	@use "../../../styles/variables" as *;

	.app-header {
		position: sticky;
		top: 0;
		z-index: 100;
		width: 100%;
		min-height: $app-shell-header-height;
		color: $color-figma-ink;
		background: $color-figma-card;
		border-bottom: 1px solid $color-figma-border;
	}

	.app-header__inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: $app-gap-md;
		width: min(100%, $app-mobile-shell-width);
		min-height: $app-shell-header-height;
		min-width: 0;
		margin: 0 auto;
		padding: $app-gap-sm max($app-shell-padding-x, env(safe-area-inset-right))
			$app-gap-sm max($app-shell-padding-x, env(safe-area-inset-left));
		box-sizing: border-box;
	}

	.app-header__brand {
		display: inline-flex;
		align-items: center;
		gap: $app-gap-sm;
		min-width: 0;
		color: inherit;
		text-decoration: none;
	}

	.app-header__mark {
		display: inline-grid;
		place-items: center;
		flex: 0 0 auto;
		font-size: $app-font-size-xl;
		line-height: 1;
	}

	.app-header__title {
		min-width: 0;
		font-family: $app-font-family-display;
		font-size: $app-font-size-xl;
		font-weight: $app-font-weight-bold;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.app-header__profile {
		position: relative;
		display: inline-grid;
		place-items: center;
		flex: 0 0 auto;
		width: $app-rebuild-food-icon-size;
		height: $app-rebuild-food-icon-size;
		border-radius: $app-radius-circle;
		text-decoration: none;
	}

	:global(.app-header__avatar) {
		--circular-media-frame-size: #{$app-rebuild-food-icon-size};
		--circular-media-frame-color: #{$color-figma-green};
		--circular-media-frame-background: #{$color-figma-green-soft};
	}

	:global(.app-header__avatar img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.app-header__initials {
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
		line-height: 1;
	}

	:global(.app-header__crown) {
		position: absolute;
		top: calc($app-privileged-badge-size / -3);
		right: calc($app-privileged-badge-size / -3);
		z-index: 1;
	}

	.app-header__profile:focus-visible,
	.app-header__brand:focus-visible {
		outline: $app-focus-outline;
		outline-offset: 2px;
	}

	@media (min-width: $app-breakpoint-md) {
		.app-header__inner {
			padding-inline: $app-shell-padding-x;
		}
	}
</style>
