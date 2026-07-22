<script lang="ts">
	import SmoothieCup from "$lib/assets/icons/SmoothieCup/SmoothieCup.svelte";
	import PrivilegedActionBadge from "$lib/components/common/badges/PrivilegedActionBadge/PrivilegedActionBadge.svelte";
	import CircularMediaFrame from "$lib/components/common/images/CircularMediaFrame/CircularMediaFrame.svelte";
	import type { AppHeaderProps } from "./types";
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
	@use "./AppHeader.scss";
</style>
