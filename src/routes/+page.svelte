<script lang="ts">
	import FloatingFruitBackground from "$lib/components/app/FloatingFruitBackground.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	let landingCard = $state<HTMLDivElement>();
</script>

<section class="landing-page">
	<FloatingFruitBackground focusElement={landingCard} />
	<div class="landing-card" bind:this={landingCard}>
		<div class="landing-copy">
			<p class="landing-eyebrow">{APP_NAME}</p>
			<h1>Build a smoothie that fits your goals.</h1>
			<p class="landing-intro">
				Choose your ingredients, set what matters to you, and see the balance
				before you blend.
			</p>
		</div>

		<ul class="landing-benefits" aria-label={`What ${APP_NAME} helps with`}>
			<li><span aria-hidden="true">✓</span> Track the nutrients you care about</li>
			<li><span aria-hidden="true">✓</span> Adjust amounts with live feedback</li>
			<li><span aria-hidden="true">✓</span> Save mixes for next time</li>
		</ul>

		<div class="landing-action">
			<a href={`/auth?next=${encodeURIComponent(data.next)}`}>
				Sign in to start mixing
				<span aria-hidden="true">→</span>
			</a>
			<p><span aria-hidden="true">↻</span> Your recipes stay synced to your account.</p>
		</div>
	</div>
</section>

<style lang="scss">
	@use "../styles/variables" as *;

	.landing-page {
		position: relative;
		isolation: isolate;
		display: grid;
		place-items: center;
		min-height: 100svh;
		overflow: hidden;
		padding: clamp($app-gap-md, 5vw, 3rem);
		background:
			radial-gradient(circle at 50% 46%, rgb(239 211 194 / 20%), transparent 38%),
			$app-bg;
	}

	.landing-card {
		position: relative;
		z-index: 1;
		display: grid;
		gap: 1.35rem;
		width: min(100%, 33rem);
		padding: clamp(1.35rem, 4vw, 2rem);
		background: $app-guest-surface;
		border: $app-border;
		border-radius: $app-guest-card-radius;
		backdrop-filter: blur(0.35rem);

		&::before {
			position: absolute;
			top: -1px;
			left: 12%;
			width: 28%;
			height: 3px;
			background: $app-highlight;
			border-radius: 0 0 $app-radius-pill $app-radius-pill;
			content: "";
		}
	}

	.landing-copy {
		display: grid;
		gap: 0.7rem;
	}

	.landing-eyebrow {
		width: fit-content;
		padding: 0.22rem 0.62rem;
		color: $app-primary;
		background: $app-accent;
		border-radius: $app-radius-pill;
		font-size: $app-font-size-sm;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	h1 {
		color: $app-primary;
		font-family: $app-font-family-display;
		font-size: clamp(2rem, 7vw, 2.75rem);
		font-weight: $app-font-weight-bold;
		letter-spacing: -0.045em;
		line-height: 1.02;
	}

	.landing-intro {
		max-width: 30rem;
		color: $app-muted;
		font-size: clamp($app-font-size-md, 2.5vw, 0.95rem);
		line-height: 1.55;
	}

	.landing-benefits {
		display: grid;
		gap: 0.55rem;
		list-style: none;

		li {
			display: flex;
			gap: 0.6rem;
			align-items: center;
			color: $app-primary;
			font-size: $app-font-size-md;
			font-weight: 700;
		}

		span {
			display: grid;
			place-items: center;
			flex: 0 0 auto;
			width: 1.25rem;
			height: 1.25rem;
			background: $app-success-bg;
			border-radius: 50%;
			font-size: $app-font-size-xs;
		}
	}

	.landing-action {
		display: grid;
		gap: 0.65rem;
		justify-items: start;
	}

	a {
		display: inline-flex;
		gap: 0.65rem;
		align-items: center;
		justify-content: center;
		width: fit-content;
		min-height: 2.75rem;
		padding: 0.7rem 1.1rem;
		color: $app-highlight-text;
		background: $app-highlight;
		border-radius: $app-radius-pill;
		font-family: $app-button-font-family;
		font-weight: $app-button-font-weight;
		line-height: $app-button-line-height;
		text-decoration: none;
		transition:
			background 0.15s ease,
			transform 0.15s ease;

		&:hover {
			background: $app-highlight-hover;
			transform: translateY(-1px);
		}

		&:focus-visible {
			outline: $app-focus-outline;
			outline-offset: 3px;
		}
	}

	.landing-action p {
		color: $app-muted;
		font-size: $app-font-size-sm;
	}

	@media (max-width: $app-breakpoint-xs) {
		.landing-card {
			gap: $app-gap-md;
			padding: 1.25rem;
		}

		a {
			width: 100%;
		}
	}
</style>
