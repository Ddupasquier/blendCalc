<script lang="ts">
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import type { AppErrorProps } from "./types";

	let { status, title, message }: AppErrorProps = $props();
</script>

<section class="app-error">
	<div class="app-error__panel" aria-labelledby="app-error-title">
		<p class="app-error__eyebrow">Error {status}</p>
		<h1 id="app-error-title">{title}</h1>
		<StatusMessage tone="danger" {message} />
		<div class="app-error__actions">
			<RoundedActionLink href="/ingredients/fridge" fullWidth>
				Open Ingredients
			</RoundedActionLink>
			<RoundedActionLink href="/" variant="neutral" fullWidth>
				Go Home
			</RoundedActionLink>
		</div>
	</div>
</section>

<style lang="scss">
	@use "./AppError.scss";
</style>
