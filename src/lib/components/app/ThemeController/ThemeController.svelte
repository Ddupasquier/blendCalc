<script lang="ts">
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import {
		applyThemePreference,
		normalizeThemePreference,
	} from "$lib/utils/theme/themePreference";
	import type { ThemeControllerProps } from "./types";

	let { preference }: ThemeControllerProps = $props();
	let mediaQuery: MediaQueryList | null = null;

	const applyCurrentTheme = () => {
		if (!browser) return;
		applyThemePreference(
			normalizeThemePreference(preference),
			mediaQuery?.matches ?? window.matchMedia("(prefers-color-scheme: dark)").matches,
			document.documentElement,
			document.querySelector<HTMLMetaElement>("meta[name='theme-color']"),
		);
	};

	$effect.pre(() => {
		preference;
		applyCurrentTheme();
	});

	onMount(() => {
		mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleSystemThemeChange = () => applyCurrentTheme();

		applyCurrentTheme();
		mediaQuery.addEventListener("change", handleSystemThemeChange);

		return () => {
			mediaQuery?.removeEventListener("change", handleSystemThemeChange);
		};
	});
</script>
