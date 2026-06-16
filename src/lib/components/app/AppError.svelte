<script lang="ts">
	let {
		status,
		message,
	}: {
		status: number;
		message: string;
	} = $props();
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
	@use "../../../styles/variables" as *;

	.app-error {
		display: grid;
		gap: $app-gap-sm;
		max-width: 32rem;
		margin: $app-gap-lg auto;
		padding: $app-gap-md;
		background: $app-section-bg;
		border: $app-border;
		border-radius: $app-card-radius;
		text-align: center;
	}

	.app-error__eyebrow {
		color: $app-muted;
		font-size: $app-font-size-sm;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1 {
		color: $app-primary;
		font-size: clamp(3rem, 16vw, 5rem);
		line-height: 1;
	}

	p {
		color: $app-muted;
		font-size: $app-font-size-md;
		line-height: 1.4;
	}

	.app-error__actions {
		display: flex;
		flex-wrap: wrap;
		gap: $app-gap-sm;
		justify-content: center;
		margin-top: $app-gap-sm;
	}

	a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.25rem;
		padding: 0 0.85rem;
		color: $app-btn-text;
		background: $app-btn-bg;
		border-radius: $app-radius;
		font-size: $app-font-size-md;
		font-family: $app-button-font-family;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		text-decoration: none;

		&:hover {
			background: $app-btn-bg-hover;
		}
	}
</style>
