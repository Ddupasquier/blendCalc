<script lang="ts">
	import { resolve } from "$app/paths";
	import LegalNoticeShell from "$lib/components/privacy/LegalNoticeShell/LegalNoticeShell.svelte";
	import { APP_NAME, APP_CONTACT_EMAIL } from "$lib/config/brand";
</script>

<LegalNoticeShell>
	<header>
		<a href={resolve("/")}>{APP_NAME}</a>
		<h1>Terms of service</h1>
		<p>Effective October 16, 2026</p>
	</header>
	<p>
		{APP_NAME} is operated by ModernCraft LLC, Oregon. These terms describe the consumer
		app and the rules for using it. Contact
		<a href={`mailto:${APP_CONTACT_EMAIL}`}>{APP_CONTACT_EMAIL}</a> with questions
		about the service, your account or these terms.
	</p>
	<nav aria-label="Terms sections">
		<a href="#the-service">The service</a>
		<a href="#accounts">Accounts and access</a>
		<a href="#food-information">Food information and safety</a>
		<a href="#your-content">Private content and shared submissions</a>
		<a href="#acceptable-use">Acceptable use</a>
		<a href="#privacy-and-ads">Privacy and advertising</a>
		<a href="#payments">Charges and paid offers</a>
		<a href="#changes-and-support">Changes, restrictions and support</a>
	</nav>
	<section aria-labelledby="the-service">
		<h2 id="the-service">The service</h2>
		<p>
			{APP_NAME} helps you organize food and shopping lists, review available nutrition,
			allergen and recall information, build Mixes, save and reuse recipes, and manage
			favorites and optional food preferences. These consumer terms do not provide
			developer API access or permission to redistribute third-party catalog data
			or images.
		</p>
	</section>
	<section aria-labelledby="accounts">
		<h2 id="accounts">Accounts and access</h2>
		<p>
			Some features require a signed-in account. Keep your sign-in credentials
			private and contact support if you suspect unauthorized access. Use only
			accounts you are authorized to access. Any pilot invitation may specify
			additional participation requirements.
		</p>
		<p>
			Signing out or clearing browser storage does not delete your account or
			saved account data. Contact support for account requests; we may need to
			verify account ownership before acting.
		</p>
	</section>
	<section aria-labelledby="food-information">
		<h2 id="food-information">Food information and safety</h2>
		<p>
			Information can come from third-party datasets, package labels, community
			submissions and your own entries. Values and warnings can be incomplete,
			outdated or incorrectly recognized. Missing information does not mean
			zero, and the absence of an allergen warning does not establish that a
			food is safe for you. Check the current package label and confirm scanned
			or recognized suggestions before saving them.
		</p>
		<p>
			The app provides organizational and informational tools. It does not
			diagnose or treat medical conditions, guarantee product safety or replace
			qualified medical or dietary advice. Use qualified advice for personal
			medical and allergy decisions.
		</p>
	</section>
	<section aria-labelledby="your-content">
		<h2 id="your-content">Private content and shared submissions</h2>
		<p>
			You allow ModernCraft LLC to store and process content you provide as
			needed to deliver the features you choose. Private lists, recipes, food
			preferences and account drafts are separate from the shared product
			catalog. Using these private features does not submit that information for
			public catalog publication.
		</p>
		<p>
			When you explicitly submit product facts or images to the shared catalog,
			you permit their review and publication in that catalog. Submit only
			material you are entitled to provide, and do not include personal or
			health information. Third-party rights and licences remain applicable;
			this permission does not transfer ownership of third-party material or
			grant public API redistribution rights. Contact support to request a
			correction or raise a rights concern.
		</p>
	</section>
	<section aria-labelledby="acceptable-use">
		<h2 id="acceptable-use">Acceptable use</h2>
		<ul>
			<li>
				Use the app lawfully and respect other people's privacy and rights.
			</li>
			<li>
				Do not access another account or private information without
				authorization.
			</li>
			<li>Do not bypass security or rate limits, or disrupt the service.</li>
			<li>
				Do not submit unlawful or infringing material or fabricated catalog
				evidence.
			</li>
			<li>
				Do not harass other people or manufacture advertising clicks or
				impressions.
			</li>
		</ul>
	</section>
	<section aria-labelledby="privacy-and-ads">
		<h2 id="privacy-and-ads">Privacy and advertising</h2>
		<p>
			The <a href={resolve("/privacy")}>Privacy &amp; advertising notice</a>
			explains information, service providers, cookies, analytics and your choices.
			Advertising remains subject to the applicable consent and opt-out controls and
			the independent browser advertising block. Turning that block off does not give
			advertising consent. The app does not supply your private food, recipe, preference
			or health fields as Google advertising targeting fields.
		</p>
	</section>
	<section aria-labelledby="payments">
		<h2 id="payments">Charges and paid offers</h2>
		<p>
			There is currently no paid checkout or subscription offer in the app. An
			ad-free eligibility record is not a purchase or billing agreement. Any
			future paid offer will need its own price, duration, payment, cancellation
			and refund terms before activation. These terms introduce no charge or
			automatic renewal.
		</p>
	</section>
	<section aria-labelledby="changes-and-support">
		<h2 id="changes-and-support">Changes, restrictions and support</h2>
		<p>
			The app and source information can change. We may restrict access to deal
			with abuse, security issues or rights concerns. Contact support to request
			a review of an account restriction or to report a service or content
			problem. The current terms are available on this page.
		</p>
		<p>
			For access, correction or deletion requests, use the contact and process
			described in the <a href={resolve("/privacy")}>privacy notice</a>.
			Clearing local drafts does not remove saved account records, moderation
			evidence or backup records.
		</p>
	</section>
</LegalNoticeShell>
