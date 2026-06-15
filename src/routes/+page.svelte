<script lang="ts">
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

<section class="landing-page">
	<div class="landing-card">
		<p class="landing-eyebrow">SvelteKit + Supabase</p>
		<h1>Blank app skeleton</h1>
		<p>
			This starter keeps authentication, deployment, and app structure in place.
			Replace this page with your product-specific experience.
		</p>
		<a href={`/auth?next=${encodeURIComponent(data.next)}`}>Sign in to continue →</a>
	</div>
</section>

<style lang="scss">
	@use "../styles/variables" as *;

	.landing-page {
		display: grid;
		place-items: center;
		min-height: 100svh;
		padding: clamp($app-gap-md, 5vw, 3rem);
	}

	.landing-card {
		display: grid;
		gap: 1rem;
		width: min(100%, 32rem);
		padding: clamp(1.25rem, 4vw, 2rem);
		background: $app-guest-surface;
		border: $app-border;
		border-radius: $app-guest-card-radius;
		box-shadow: $app-guest-card-shadow;
	}

	.landing-eyebrow {
		width: fit-content;
		padding: 0.2rem 0.55rem;
		background: $app-accent;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-sm;
		font-weight: 900;
	}

	a {
		width: fit-content;
		padding: 0.7rem 1.1rem;
		color: $app-highlight-text;
		background: $app-highlight;
		border-radius: $app-radius-pill;
		font-weight: $app-button-font-weight;
		text-decoration: none;
	}
</style>
