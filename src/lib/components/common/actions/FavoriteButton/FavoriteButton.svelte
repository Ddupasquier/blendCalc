<script lang="ts">
	import { onMount, untrack } from "svelte";
	import CircleIconButton from "$lib/components/common/buttons/CircleIconButton/CircleIconButton.svelte";
	import Star from "$lib/assets/icons/Star/Star.svelte";
	import {
		FAVORITES_CHANGED_EVENT,
		type FavoriteChange,
		type FavoriteState,
	} from "$lib/utils/favorites/types";
	import type { FavoriteButtonProps, FavoriteRequestOptions } from "./types";
	let {
		kind,
		targetId,
		name,
		initialState,
		disabled = false,
	}: FavoriteButtonProps = $props();
	let favoriteState = $state<FavoriteState | undefined>(
		untrack(() => initialState),
	);
	let busy = $state(false);
	let error = $state("");
	let mounted = $state(false);
	let generation = 0;
	let abort: AbortController | null = null;
	const request = async (url: string, options: FavoriteRequestOptions = {}) => {
		const controller = new AbortController();
		abort = controller;
		const timer = setTimeout(() => controller.abort(), 15000);
		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal,
			});
			if (!response.ok) throw new Error("Favorite request failed");
			return await response.json();
		} finally {
			clearTimeout(timer);
		}
	};
	const load = async () => {
		const current = ++generation;
		busy = true;
		error = "";
		try {
			const result = await request(
				`/api/favorites?${new URLSearchParams({ kind, id: targetId })}`,
			);
			if (current === generation) favoriteState = result.state;
		} catch {
			if (current === generation)
				error = "Favorite status could not load. Try again.";
		} finally {
			if (current === generation) busy = false;
		}
	};
	$effect(() => {
		kind;
		targetId;
		generation++;
		abort?.abort();
		busy = false;
		favoriteState = initialState;
		error = "";
		if (mounted && initialState === undefined) void load();
		return () => {
			generation++;
			abort?.abort();
		};
	});
	const toggle = async () => {
		if (busy || disabled) return;
		if (favoriteState === undefined) {
			await load();
			return;
		}
		if (favoriteState === null) return;
		const previous = favoriteState.favorite;
		const requestGeneration = generation;
		const change: FavoriteChange = { kind, targetId, favorite: !previous };
		favoriteState = { favorite: !previous };
		busy = true;
		error = "";
		try {
			await request("/api/favorites", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(change),
			});
			window.dispatchEvent(
				new CustomEvent<FavoriteChange>(FAVORITES_CHANGED_EVENT, {
					detail: change,
				}),
			);
		} catch {
			if (requestGeneration === generation) {
				favoriteState = { favorite: previous };
				error = "Favorite could not be saved. Try again.";
			}
		} finally {
			if (requestGeneration === generation) busy = false;
		}
	};
	onMount(() => {
		mounted = true;
		const changed = (event: Event) => {
			const change = (event as CustomEvent<FavoriteChange>).detail;
			if (change.kind === kind && change.targetId === targetId)
				favoriteState = { favorite: change.favorite };
		};
		window.addEventListener(FAVORITES_CHANGED_EVENT, changed);
		return () => {
			generation++;
			abort?.abort();
			window.removeEventListener(FAVORITES_CHANGED_EVENT, changed);
		};
	});
</script>

{#if favoriteState !== null}
	<span class="favorite-button">
		<CircleIconButton
			label={`${favoriteState?.favorite ? "Remove favorite" : "Favorite"}: ${name}`}
			variant="soft"
			size="small"
			pressed={favoriteState?.favorite ?? false}
			{busy}
			disabled={disabled || busy}
			onclick={() => void toggle()}
		>
			<Star filled={favoriteState?.favorite ?? false} size={16} />
		</CircleIconButton>
		{#if error}<span class="favorite-button__error" role="alert">{error}</span
			>{/if}
	</span>
{/if}

<style lang="scss">
	@use "./FavoriteButton.scss";
</style>
