<script lang="ts">
	import Crown from "$lib/assets/icons/Crown.svelte";
	import SmoothieCup from "$lib/assets/icons/SmoothieCup.svelte";
	import { APP_NAME } from "$lib/config/brand";

	let {
		displayName,
		avatarUrl = null,
		avatarAltText = null,
		role = null,
	}: {
		displayName: string;
		avatarUrl?: string | null;
		avatarAltText?: string | null;
		role?: string | null;
	} = $props();

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
				<span class="app-header__crown" aria-label="Moderator account" title="Moderator account">
					<Crown size="var(--app-header-crown-icon-size)" />
				</span>
			{/if}

			{#if avatarUrl}
				<img src={avatarUrl} alt={avatarAltText ?? ""} />
			{:else}
				<span class="app-header__initials" aria-hidden="true">{initials}</span>
			{/if}
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
		color: $color-figma-green;
		background: $color-figma-green-soft;
		border: 0;
		border-radius: 50%;
		text-decoration: none;
	}

	.app-header__profile--moderator {
		background: $color-figma-green-soft;
	}

	.app-header__profile img {
		width: 100%;
		height: 100%;
		border-radius: inherit;
		object-fit: cover;
	}

	.app-header__initials {
		font-size: $app-font-size-md;
		font-weight: $app-font-weight-bold;
		line-height: 1;
	}

	.app-header__crown {
		--app-header-crown-icon-size: #{$app-privileged-badge-icon-size};

		position: absolute;
		top: calc($app-privileged-badge-size / -3);
		right: calc($app-privileged-badge-size / -3);
		display: inline-grid;
		place-items: center;
		width: $app-privileged-badge-size;
		height: $app-privileged-badge-size;
		color: $app-privileged-badge-text;
		background: $app-privileged-badge-bg;
		border: 1px solid $app-privileged-badge-border;
		border-radius: 50%;
		font-weight: $app-font-weight-bold;
		line-height: 1;
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
