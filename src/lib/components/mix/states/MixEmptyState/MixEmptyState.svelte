<script lang="ts">
	import RoundedActionLink from "$lib/components/common/buttons/RoundedActionLink/RoundedActionLink.svelte";
</script>

<section class="mix-empty-state" aria-label="No ingredients selected">
	<div>
		<h4>No ingredients selected</h4>
		<p>Open Add ingredients and choose foods to start building this Mix.</p>
	</div>
	<RoundedActionLink href="/ingredients/fridge" variant="neutral">
		Manage ingredients
	</RoundedActionLink>
</section>

<style lang="scss">
	@use "./MixEmptyState.scss";
</style>
