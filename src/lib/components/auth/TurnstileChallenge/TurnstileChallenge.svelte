<script lang="ts">
	import { onMount } from "svelte";
	import Check from "$lib/assets/icons/Check/Check.svelte";
	import {
		loadTurnstileClient,
		type TurnstileClient,
		type TurnstileWidgetId,
	} from "$lib/utils/auth/turnstileClient";
	import type { TurnstileChallengeProps } from "./types";

	let { siteKey, resetVersion = 0 }: TurnstileChallengeProps = $props();

	let container = $state<HTMLDivElement>();
	let client = $state<TurnstileClient | null>(null);
	let widgetId = $state<TurnstileWidgetId | null>(null);
	let token = $state("");
	let loadError = $state("");
	let challengeComplete = $state(false);
	let appliedResetVersion = $state(0);

	onMount(() => {
		let disposed = false;
		appliedResetVersion = resetVersion;

		void loadTurnstileClient()
			.then((loadedClient) => {
				if (disposed || !container) return;
				client = loadedClient;
				widgetId = loadedClient.render(container, {
					sitekey: siteKey,
					action: "blendcalc_auth",
					appearance: "always",
					responseField: false,
					size: "flexible",
					theme: "auto",
					callback: (nextToken) => {
						token = nextToken;
						loadError = "";
						challengeComplete = true;
					},
					"error-callback": () => {
						token = "";
						challengeComplete = false;
						loadError = "The security check needs another try.";
					},
					"expired-callback": () => {
						token = "";
						challengeComplete = false;
					},
				});
			})
			.catch(() => {
				if (!disposed) {
					loadError =
						"The security check could not load. Check your connection and try again.";
				}
			});

		return () => {
			disposed = true;
			if (client && widgetId) client.remove(widgetId);
		};
	});

	$effect(() => {
		if (!client || !widgetId || resetVersion === appliedResetVersion) return;
		appliedResetVersion = resetVersion;
		token = "";
		loadError = "";
		challengeComplete = false;
		client.reset(widgetId);
	});
</script>

<div class="turnstile-challenge">
	<input type="hidden" name="captchaToken" value={token} />
	<div
		class:turnstile-challenge__widget--hidden={challengeComplete}
		class="turnstile-challenge__widget"
		bind:this={container}
	></div>
	{#if challengeComplete}
		<div class="turnstile-challenge__complete" role="status">
			<span class="turnstile-challenge__complete-icon"
				><Check size="1em" /></span
			>
			<span>Security check complete</span>
		</div>
	{/if}
	{#if loadError}
		<p class="turnstile-challenge__error" role="alert">{loadError}</p>
	{/if}
</div>

<style lang="scss">
	@use "./TurnstileChallenge.scss";
</style>
