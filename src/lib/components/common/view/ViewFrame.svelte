<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		appShell = false,
		className = "",
		children,
	}: {
		appShell?: boolean;
		className?: string;
		children: Snippet;
	} = $props();
</script>

<div
	class={["view-frame", className].filter(Boolean).join(" ")}
	class:view-frame--app-shell={appShell}
>
	{@render children()}
</div>

<style lang="scss">
	@use "../../../../styles/variables" as *;

	.view-frame {
		display: flex;
		flex-direction: column;
		gap: $app-vertical-stack-gap;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: $app-shell-surface-page;
		box-sizing: border-box;
	}

	.view-frame--app-shell {
		width: 100%;
		max-width: $ingredient-shell-max-width;
		height: calc(
			100dvh - $ingredient-shell-header-height - $ingredient-shell-nav-height -
				env(safe-area-inset-bottom)
		);
		margin: 0 auto;
		padding: $ingredient-shell-padding-y $ingredient-shell-padding-x 0;
	}

	@media (max-width: $app-breakpoint-xs) {
		.view-frame--app-shell {
			padding-inline: $app-gap-sm;
		}
	}
</style>
