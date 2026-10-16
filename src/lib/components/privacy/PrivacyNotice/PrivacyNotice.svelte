<script lang="ts">
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import AdvertisingPrivacyChoices from "$lib/components/advertising/AdvertisingPrivacyChoices/AdvertisingPrivacyChoices.svelte";
	import GuestAccessPageShell from "$lib/components/auth/GuestAccessPageShell/GuestAccessPageShell.svelte";
	import { APP_NAME, APP_CONTACT_EMAIL } from "$lib/config/brand";
</script>

<GuestAccessPageShell width="wide">
	<article class="privacy-notice">
		<header>
			<a href={resolve("/")}>{APP_NAME}</a>
			<h1>Privacy &amp; advertising</h1>
			<p>Last updated October 15, 2026</p>
		</header>
		<p>
			{APP_NAME} helps you organize food, review nutrition and save recipes. This
			notice explains the information used to provide that service and the choices
			you can make.
		</p>
		<nav aria-label="Privacy sections">
			<a href="#information">Information we use</a>
			<a href="#services">Services and sharing</a>
			<a href="#storage">Cookies and browser storage</a>
			<a href="#advertising-choices">Advertising choices</a>
			<a href="#your-information">Your information and requests</a>
		</nav>
		<section aria-labelledby="information">
			<h2 id="information">Information we use</h2>
			<ul>
				<li>
					Account information, such as your email, sign-in identity, chosen
					name, optional bio and profile image, provides account access and your
					profile.
				</li>
				<li>
					Foods, lists, recipes, favorites, Mix drafts, nutrition goals and
					optional food preferences support the features you choose to use. Food
					preferences can reveal sensitive dietary or health-related
					information.
				</li>
				<li>
					Searches, barcodes and images you submit are processed to find or
					review food information. Nutrition-label recognition can process
					uploaded images on our servers. Include only the food label or product
					you want reviewed.
				</li>
				<li>
					Technical information, including network addresses, request logs,
					browser and device information, page routes and performance
					measurements, helps operate, secure and improve the service.
				</li>
			</ul>
		</section>
		<section aria-labelledby="services">
			<h2 id="services">Services and sharing</h2>
			<p>
				Supabase provides account authentication, database and file storage.
				Vercel hosts the app and provides analytics and performance
				measurements. Resend delivers application email. Google sign-in and
				Cloudflare's sign-in protection process information when you use those
				features. These services may receive technical information as part of
				handling requests.
			</p>
			<p>
				Food searches and barcode lookups may contact food-data providers such
				as USDA and Open Food Facts through our servers. Product information you
				explicitly submit for the shared catalog may become shared food data
				after review. Private saved lists, recipes and food preferences are
				separate from that public catalog. Do not put personal information in
				catalog submissions.
			</p>
			<p>
				Analytics and performance collection include page routes and limited
				interaction events. Query strings and URL fragments are removed before
				Vercel analytics and performance URLs are sent. Security and operational
				logs are separate from advertising.
			</p>
			<p>
				Information may be processed in countries other than your own by these
				service providers. Access can also be necessary for support, moderation,
				security or legal obligations.
			</p>
		</section>
		<section aria-labelledby="storage">
			<h2 id="storage">Cookies and browser storage</h2>
			<p>
				Sign-in cookies keep your session working. A theme cookie and browser
				storage remember appearance, device preferences and temporary app state.
				Account-specific drafts are separated between signed-in accounts.
				Clearing browser storage can remove local drafts and preferences; your
				saved account data is stored separately.
			</p>
			<p>
				The advertising-block preference below stores only your browser's
				choice; it contains no account identifier, food history or health
				information. This choice is separate from sign-in, security, app
				analytics and saved account data.
			</p>
		</section>
		<AdvertisingPrivacyChoices />
		<section aria-labelledby="advertising">
			<h2 id="advertising">Google advertising</h2>
			<p>
				{#if page.data.advertising?.configuration.mode !== "google"}Google ads
					are currently off.{/if}
				When advertising is enabled, Google and its advertising partners may use cookies,
				web beacons, IP addresses and other identifiers to deliver, measure and, where
				permitted, personalize ads. We will not send your saved recipes, food preferences
				or health-related details as advertising targeting data.
			</p>
			<p>
				A separate consent message will provide the applicable advertising
				choices before ads can be requested. Turning off the block above cannot
				replace that consent. You can return here at any time to block
				advertising.
			</p>
			<p>
				Read <a href="https://business.safety.google/privacy/"
					>how Google uses information</a
				>
				and review
				<a href="https://myadcenter.google.com/"
					>Google's ad personalization controls</a
				>.
			</p>
		</section>
		<section aria-labelledby="your-information">
			<h2 id="your-information">Your information and requests</h2>
			<p>
				You can edit your profile, preferences, saved foods and recipes in the
				app. Contact <a href={`mailto:${APP_CONTACT_EMAIL}`}
					>{APP_CONTACT_EMAIL}</a
				> to request access, correction or deletion of account information, or ask
				a privacy question. We may need to verify account ownership before acting.
				Available rights depend on your location.
			</p>
			<p>
				Account information supports your ongoing use of the app. Some security,
				moderation, shared-catalog evidence and backup records may need to
				remain after a deletion request for operational or legal reasons.
				Signing out or clearing browser storage does not delete your account.
			</p>
			<p>
				Promotional email is optional and has separate preferences in Profile.
				Advertising choices do not subscribe you to email. Important account and
				security messages are handled separately.
			</p>
			<p>
				If our data use changes, we will update this notice and its date, and
				ask for any new consent that is needed before the changed advertising
				use.
			</p>
		</section>
	</article>
</GuestAccessPageShell>

<style lang="scss">
	@use "./PrivacyNotice.scss";
</style>
