import {
	GOOGLE_ADSENSE_PUBLISHER,
	GOOGLE_ADSENSE_CONTENT_SLOT,
} from "./advertisingConfiguration";

export type GoogleAdWindow = Window & {
	adsbygoogle?: Array<Record<string, unknown>>;
};
const SCRIPT_ID = "blendcalc-google-advertising";

/** One SDK per document, DOM listeners rather than inline event attributes. */
export const loadGoogleAdvertising = (document: Document): Promise<void> => {
	const existing = document.getElementById(
		SCRIPT_ID,
	) as HTMLScriptElement | null;
	if (existing?.dataset.loaded === "true") return Promise.resolve();
	if (existing?.dataset.failed === "true")
		return Promise.reject(new Error("Advertising unavailable"));
	return new Promise((resolve, reject) => {
		const script = existing ?? document.createElement("script");
		const clean = () => {
			script.removeEventListener("load", loaded);
			script.removeEventListener("error", failed);
			clearTimeout(timer);
		};
		const loaded = () => {
			script.dataset.loaded = "true";
			clean();
			resolve();
		};
		const failed = () => {
			script.dataset.failed = "true";
			clean();
			reject(new Error("Advertising unavailable"));
		};
		const timer = setTimeout(failed, 12_000);
		script.addEventListener("load", loaded);
		script.addEventListener("error", failed);
		if (!existing) {
			script.id = SCRIPT_ID;
			script.async = true;
			script.crossOrigin = "anonymous";
			script.referrerPolicy = "origin";
			const nonce =
				document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
			if (nonce) script.nonce = nonce;
			script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${GOOGLE_ADSENSE_PUBLISHER}`;
			document.head.appendChild(script);
		}
	});
};

/** An unfilled slot disappears. Filled is delivery state, never a billable-impression claim. */
export const requestGoogleDisplayAd = (
	node: HTMLElement,
	target: GoogleAdWindow,
	allowed: () => boolean,
	onUnavailable: () => void,
) => {
	if (!allowed() || !node.isConnected || node.dataset.adRequested === "true")
		return () => {};
	node.dataset.adRequested = "true";
	node.classList.add("adsbygoogle");
	node.dataset.adClient = GOOGLE_ADSENSE_PUBLISHER;
	node.dataset.adSlot = GOOGLE_ADSENSE_CONTENT_SLOT;
	node.dataset.adFormat = "auto";
	node.dataset.fullWidthResponsive = "true";
	const observer = new MutationObserver(() => {
		if (node.dataset.adStatus === "unfilled") onUnavailable();
	});
	observer.observe(node, {
		attributes: true,
		attributeFilter: ["data-ad-status"],
	});
	const timer = setTimeout(() => {
		if (node.dataset.adStatus !== "filled") onUnavailable();
	}, 12_000);
	try {
		if (allowed()) (target.adsbygoogle ??= []).push({});
	} catch {
		onUnavailable();
	}
	return () => {
		observer.disconnect();
		clearTimeout(timer);
	};
};
