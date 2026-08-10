<script lang="ts">
	import { enhance } from "$app/forms";
	import { browser } from "$app/environment";
	import { onDestroy } from "svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import ThemePreferenceControl from "$lib/components/profile/ThemePreferenceControl/ThemePreferenceControl.svelte";
	import { createPendingSubmit } from "$lib/utils/forms/pendingSubmit";
	import {
		applyThemePreference,
		type ThemePreference,
	} from "$lib/utils/theme/themePreference";
	import type { ProfileAppearanceSettingsProps } from "./types";

	let {
		initialTheme,
		errorMessage,
		successMessage,
		onSaveSuccess,
	}: ProfileAppearanceSettingsProps = $props();

	let selectedTheme = $state<ThemePreference>("system");
	let previousInitialTheme = $state<ThemePreference | null>(null);
	let isSaving = $state(false);
	let saveCompleted = false;

	$effect(() => {
		if (initialTheme === previousInitialTheme) return;
		previousInitialTheme = initialTheme;
		selectedTheme = initialTheme;
	});

	const selectTheme = (nextTheme: ThemePreference) => {
		selectedTheme = nextTheme;
		if (!browser) return;
		applyThemePreference(
			nextTheme,
			window.matchMedia("(prefers-color-scheme: dark)").matches,
			document.documentElement,
			document.querySelector<HTMLMetaElement>("meta[name='theme-color']"),
		);
	};

	const enhanceAppearance = createPendingSubmit(
		(pending) => (isSaving = pending),
		(result) => {
			if (result.type !== "success") return;
			saveCompleted = true;
			onSaveSuccess?.();
		},
	);

	onDestroy(() => {
		if (!browser || saveCompleted) return;
		applyThemePreference(
			initialTheme,
			window.matchMedia("(prefers-color-scheme: dark)").matches,
			document.documentElement,
			document.querySelector<HTMLMetaElement>("meta[name='theme-color']"),
		);
	});
</script>

<div class="profile-appearance-settings">
	<p>Choose a light or dark look, or match this device automatically.</p>
	{#if errorMessage}
		<StatusMessage tone="danger" message={errorMessage} />
	{:else if successMessage}
		<StatusMessage tone="success" message={successMessage} />
	{/if}

	<form
		method="POST"
		action="/profile?/saveAppearance"
		use:enhance={enhanceAppearance}
		aria-busy={isSaving}
	>
		<ThemePreferenceControl
			value={selectedTheme}
			disabled={isSaving}
			onSelect={selectTheme}
		/>
		<RoundedActionButton type="submit" busy={isSaving}>
			Save appearance
		</RoundedActionButton>
	</form>
</div>

<style lang="scss">
	@use "./ProfileAppearanceSettings.scss";
</style>
