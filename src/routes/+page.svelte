<script lang="ts">
	import Check from "$lib/assets/icons/Check/Check.svelte";
	import GuestAccessPageShell from "$lib/components/auth/GuestAccessPageShell/GuestAccessPageShell.svelte";
	import CircularIconFrame from "$lib/components/common/icons/CircularIconFrame/CircularIconFrame.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import type { LandingPageProps } from "./types";

	let { data }: LandingPageProps = $props();
</script>

<GuestAccessPageShell width="wide">
	<div class="landing-content">
		<div class="landing-copy">
			<p class="landing-eyebrow">{APP_NAME}</p>
			<h1>Know more about the food you use.</h1>
			<p class="landing-intro">
				Organize food, compare nutrition, and review available recall, allergen,
				and dietary information in one place.
			</p>
		</div>

		<ul class="landing-benefits" aria-label={`What ${APP_NAME} helps with`}>
			<li>
				<CircularIconFrame class="landing-benefit-icon" decorative
					><Check size="1em" /></CircularIconFrame
				> Review nutrition and serving details
			</li>
			<li>
				<CircularIconFrame class="landing-benefit-icon" decorative
					><Check size="1em" /></CircularIconFrame
				> See recall and food-preference warnings
			</li>
			<li>
				<CircularIconFrame class="landing-benefit-icon" decorative
					><Check size="1em" /></CircularIconFrame
				> Build and save food combinations
			</li>
		</ul>

		<div class="landing-action">
			<a href={`/auth?next=${encodeURIComponent(data.next)}`}>
				Sign in to start building
				<span aria-hidden="true">→</span>
			</a>
			<p>
				<span aria-hidden="true">↻</span> Your saved combinations stay synced to your
				account.
			</p>
		</div>
	</div>
</GuestAccessPageShell>

<style lang="scss">
	@use "./page.scss";
</style>
