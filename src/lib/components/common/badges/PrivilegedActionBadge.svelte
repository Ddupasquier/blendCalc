<script lang="ts">
	import Crown from "$lib/assets/icons/Crown.svelte";

	let {
		label = "Admin or moderator action",
		class: className = "",
	}: {
		label?: string;
		class?: string;
	} = $props();
</script>

<span
	class={`privileged-action-badge ${className}`.trim()}
	aria-hidden="true"
	title={label}
>
	<Crown size="var(--privileged-action-badge-icon-size)" />
</span>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.privileged-action-badge {
		--privileged-action-badge-icon-size: #{$app-privileged-action-badge-icon-size};

		display: inline-grid;
		place-items: center;
		flex: 0 0 auto;
		width: $app-privileged-action-badge-size;
		height: $app-privileged-action-badge-size;
		color: $app-privileged-badge-text;
		background: $app-privileged-badge-bg;
		border: 1px solid $app-privileged-badge-border;
		border-radius: $ingredient-radius-pill;
		line-height: 1;
	}
</style>
