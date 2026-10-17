<script lang="ts">
	import { resolve } from "$app/paths";
</script>

<div class="public-policy-links">
	<a class="public-policy-links__link" href={resolve("/privacy")}
		>Privacy &amp; advertising</a
	>
	<a class="public-policy-links__link" href={resolve("/terms")}
		>Terms of service</a
	>
</div>

<style lang="scss">
	@use "./PublicPolicyLinks.scss";
</style>
