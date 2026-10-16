<script lang="ts">
	import { untrack } from "svelte";
	import { getAdvertisingSession } from "$lib/utils/advertising/advertisingSession.svelte";
	import {
		canDisplayAdvertising,
		isAdBreakDue,
		recordAdBreakAttempt,
		type AdContext,
	} from "$lib/utils/advertising/adPolicy";
	import {
		requestGoogleDisplayAd,
		type GoogleAdWindow,
	} from "$lib/utils/advertising/googleAdDelivery";
	import AdPlacement from "../AdPlacement/AdPlacement.svelte";
	import type { AppAdvertisingProps } from "./types";

	let {
		pathname,
		hasContent,
		busy = false,
		listItem = false,
	}: AppAdvertisingProps = $props();
	const session = getAdvertisingSession();
	let node = $state<HTMLElement | null>(null);
	let unavailable = $state(false);
	let dismissed = $state(false);
	let breakOpen = $state(false);
	let ownAccount = $state("");
	let requestStarted = $state(false);
	const advertisingState = $derived(session?.state);
	const context = $derived<AdContext>({
		eligibility: advertisingState?.eligibility ?? "unknown",
		networkReady:
			advertisingState?.mode === "preview" ||
			(advertisingState?.networkReady ?? false),
		consentGranted:
			advertisingState?.mode === "preview"
				? !advertisingState.blocked
				: (advertisingState?.consent ?? false),
		advertisingBlocked: advertisingState?.blocked ?? true,
		pathname,
		visible: advertisingState?.visible ?? false,
		interactionInProgress: busy || (advertisingState?.editing ?? false),
		tutorialOpen: advertisingState?.tutorialOpen ?? true,
		publisherContentAvailable: hasContent,
	});
	const allowed = $derived(
		Boolean(
			advertisingState &&
			advertisingState.mode !== "disabled" &&
			canDisplayAdvertising(context),
		),
	);
	$effect(() => {
		if (!advertisingState) return;
		advertisingState.surfaceAllowed = canDisplayAdvertising({
			...context,
			networkReady: true,
			consentGranted: true,
		});
		void session?.ensureNetwork();
		return () => {
			advertisingState.surfaceAllowed = false;
		};
	});
	$effect(() => {
		if (advertisingState?.accountKey !== ownAccount) {
			ownAccount = advertisingState?.accountKey ?? "";
			unavailable = false;
			dismissed = false;
			breakOpen = false;
			requestStarted = false;
		}
	});
	$effect(() => {
		if (
			untrack(() => requestStarted) ||
			!advertisingState ||
			!allowed ||
			dismissed ||
			breakOpen ||
			!isAdBreakDue(advertisingState.usage, context, advertisingState.now)
		)
			return;
		breakOpen = true;
		// A conservative attempt cap. This is not impression/revenue measurement.
		advertisingState.usage = recordAdBreakAttempt(
			advertisingState.usage,
			context,
			advertisingState.now,
		);
		session?.persistUsage();
	});
	$effect(() => {
		if (requestStarted && !allowed && advertisingState?.mode === "google")
			unavailable = true;
	});
	$effect(() => {
		if (
			!node ||
			!advertisingState ||
			advertisingState.mode !== "google" ||
			!allowed
		)
			return;
		if (untrack(() => requestStarted)) return;
		requestStarted = true;
		let active = true;
		let cleanup = () => {};
		const account = advertisingState.accountKey;
		const abort = new AbortController();
		void fetch("/api/advertising/access", {
			cache: "no-store",
			signal: abort.signal,
		})
			.then(async (response) => {
				const access = response.ok ? await response.json() : null;
				if (!active || !allowed || account !== advertisingState.accountKey)
					return;
				advertisingState.eligibility =
					access?.eligibility === "supported" ||
					access?.eligibility === "ad-free"
						? access.eligibility
						: "unknown";
				if (advertisingState.eligibility !== "supported") return;
				cleanup = requestGoogleDisplayAd(
					node!,
					window as GoogleAdWindow,
					() => active && allowed && !dismissed,
					() => {
						unavailable = true;
					},
				);
			})
			.catch(() => {
				if (active && !abort.signal.aborted) unavailable = true;
			});
		return () => {
			active = false;
			abort.abort();
			cleanup();
		};
	});
</script>

{#if allowed && !unavailable && !dismissed}
	<svelte:element
		this={listItem ? "li" : "div"}
		class="app-advertising"
		data-advertising-mode={advertisingState?.mode}
	>
		<AdPlacement
			format={breakOpen ? "break" : "inline"}
			ondismiss={() => {
				dismissed = true;
			}}
		>
			{#if advertisingState?.mode === "preview"}
				<div class="app-advertising__preview">
					<strong>Ad preview</strong>
					<p>
						{breakOpen
							? "An occasional ad after a safe stopping point."
							: "An advertisement can appear here."}
					</p>
					<p>This local preview does not contact advertisers.</p>
				</div>
			{:else}
				<ins class="app-advertising__creative" bind:this={node}></ins>
			{/if}
		</AdPlacement>
	</svelte:element>
{/if}

<style lang="scss">
	@use "./AppAdvertising.scss";
</style>
