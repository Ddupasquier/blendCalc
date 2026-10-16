<script lang="ts">
	import { ADVERTISING_PRIVACY_CHANGED_EVENT } from "$lib/utils/advertising/advertisingConfiguration";
	import {
		reopenGooglePrivacyChoices,
		type GoogleAdvertisingWindow,
	} from "$lib/utils/advertising/googleAdvertisingConsent";
	import { getAdvertisingSession } from "$lib/utils/advertising/advertisingSession.svelte";
	import RoundedActionButton from "$lib/components/common/buttons/RoundedActionButton/RoundedActionButton.svelte";
	import { onMount } from "svelte";
	import ToggleSwitch from "$lib/components/common/forms/ToggleSwitch/ToggleSwitch.svelte";
	import { APP_NAME } from "$lib/config/brand";
	import StatusMessage from "$lib/components/common/feedback/StatusMessage/StatusMessage.svelte";
	import {
		ADVERTISING_BLOCK_STORAGE_KEY,
		readAdvertisingBlock,
		writeAdvertisingBlock,
		type PrivacySignalNavigator,
	} from "$lib/utils/advertising/advertisingPrivacy";

	const session = getAdvertisingSession();
	let providerAvailable = $state(false);
	let blocked = $state(true);
	let ready = $state(false);
	let globalPrivacyControl = $state(false);
	let message = $state("");
	let saveFailed = $state(false);

	const readChoice = () => {
		try {
			blocked = readAdvertisingBlock(
				localStorage.getItem(ADVERTISING_BLOCK_STORAGE_KEY),
				globalPrivacyControl,
			);
		} catch {
			blocked = true;
		}
	};

	onMount(() => {
		globalPrivacyControl =
			(navigator as PrivacySignalNavigator).globalPrivacyControl === true;
		readChoice();
		providerAvailable = Boolean(
			(window as unknown as GoogleAdvertisingWindow).googlefc,
		);
		ready = true;
		const handleStorage = (event: StorageEvent) => {
			if (event.key === null || event.key === ADVERTISING_BLOCK_STORAGE_KEY) {
				readChoice();
				saveFailed = false;
				message = "Advertising preference updated.";
			}
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	});

	const changeChoice = (nextBlocked: boolean) => {
		try {
			if (!writeAdvertisingBlock(localStorage, nextBlocked)) throw new Error();
			blocked = globalPrivacyControl || nextBlocked;
			saveFailed = false;
			message = "Advertising preference saved on this browser.";
			window.dispatchEvent(
				new CustomEvent(ADVERTISING_PRIVACY_CHANGED_EVENT, {
					detail: { persisted: true },
				}),
			);
		} catch {
			blocked = true;
			saveFailed = true;
			window.dispatchEvent(
				new CustomEvent(ADVERTISING_PRIVACY_CHANGED_EVENT, {
					detail: { persisted: false },
				}),
			);
			message =
				"We couldn't save your preference. Advertising remains blocked for this visit.";
		}
	};
</script>

<section
	class="advertising-privacy-choices"
	aria-labelledby="advertising-choices"
>
	<h2 id="advertising-choices">Advertising choices</h2>
	<label class="advertising-privacy-choices__control" for="block-advertising">
		<span class="advertising-privacy-choices__label"
			>Block advertising on this browser</span
		>
		<ToggleSwitch
			id="block-advertising"
			checked={blocked}
			disabled={!ready || globalPrivacyControl}
			ariaLabel="Block advertising on this browser"
			onChange={changeChoice}
		/>
	</label>
	<p>
		This is an extra browser-wide block. Turning it off does not give
		advertising consent or change a paid membership. This block applies to ads
		throughout {APP_NAME}. Each eligible visit must also meet the applicable
		consent requirements.
	</p>
	<p>
		This choice applies to everyone using this browser, including after signing
		out. It stays until you change it or clear this site's browser storage.
		Other browsers and devices have their own choice.
	</p>
	{#if ready && (providerAvailable || session?.state.mode === "preview")}
		<RoundedActionButton
			variant="quiet"
			onclick={() => {
				if (session) {
					session.state.consent = false;
					session.state.reviewingPrivacy = true;
				}
				const opened = reopenGooglePrivacyChoices(
					window as unknown as GoogleAdvertisingWindow,
					"european",
				);
				message = opened
					? "Advertising is paused while you review your choices. Reload the app after making changes."
					: "Google privacy choices are not available on this browser yet.";
			}}>Privacy and cookie settings</RoundedActionButton
		>
		<RoundedActionButton
			variant="quiet"
			onclick={() => {
				if (session) {
					session.state.consent = false;
					session.state.reviewingPrivacy = true;
				}
				const opened = reopenGooglePrivacyChoices(
					window as unknown as GoogleAdvertisingWindow,
					"us",
				);
				message = opened
					? "Advertising is paused while you review your choices. Reload the app after making changes."
					: "Google privacy choices are not available on this browser yet.";
			}}>Do not sell or share my personal information</RoundedActionButton
		>
	{/if}
	{#if globalPrivacyControl}
		<p>
			Your browser's Global Privacy Control signal keeps advertising blocked.
		</p>
	{/if}
	{#if message}
		<StatusMessage tone={saveFailed ? "warning" : "info"} {message} />
	{/if}
</section>

<style lang="scss">
	@use "./AdvertisingPrivacyChoices.scss";
</style>
