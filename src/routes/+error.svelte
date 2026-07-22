<script lang="ts">
	import { page } from "$app/state";
	import AppError from "$lib/components/app/AppError/AppError.svelte";

	const fallbackMessage =
		"We could not load this screen. Try going back to Ingredients or Home.";
	const message = $derived(page.error?.message || fallbackMessage);
</script>

<AppError status={page.status} {message} />
