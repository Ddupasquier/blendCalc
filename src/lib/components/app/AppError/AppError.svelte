<script lang="ts">
	import type { AppErrorProps } from "./types";

	let {
		status,
		message,
	}: AppErrorProps = $props();
</script>

<section class="app-error" aria-labelledby="app-error-title">
	<p class="app-error__eyebrow">Something went wrong</p>
	<h1 id="app-error-title">{status}</h1>
	<p>{message}</p>
	<div class="app-error__actions">
		<a href="/">Go Home</a>
		<a href="/fridge">Open Ingredients</a>
	</div>
</section>

<style lang="scss">
	@use "./AppError.scss";
</style>
