<script lang="ts">
	import { onMount } from "svelte";
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
					appearance: "interaction-only",
					responseField: false,
					size: "flexible",
					theme: "auto",
					callback: (nextToken) => {
						token = nextToken;
						loadError = "";
					},
					"error-callback": () => {
						token = "";
						loadError = "The security check needs another try.";
					},
					"expired-callback": () => {
						token = "";
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
		client.reset(widgetId);
	});
</script>

<div class="turnstile-challenge">
	<input type="hidden" name="captchaToken" value={token} />
	<div class="turnstile-challenge__widget" bind:this={container}></div>
	<p class="turnstile-challenge__note">
		Protected against automated sign-ins.
	</p>
	{#if loadError}
		<p class="turnstile-challenge__error" role="alert">{loadError}</p>
	{/if}
</div>

<style lang="scss">
	@use "./TurnstileChallenge.scss";
</style>
