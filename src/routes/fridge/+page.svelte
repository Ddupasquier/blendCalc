<section class="starter-page">
	<h1>Starter workspace</h1>
	<p>
		You are signed in. Use this protected route as your first feature page and
		build from here.
	</p>
</section>

<style lang="scss">
	@use "../../styles/variables" as *;

	.starter-page {
		display: grid;
		gap: $app-gap-sm;
		max-width: 40rem;
		padding: clamp($app-gap-md, 5vw, 3rem);
		margin: 0 auto;
	}
</style>
