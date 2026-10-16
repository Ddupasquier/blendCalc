export type AdvertisingConfiguration = {
	mode: "disabled" | "preview" | "google";
};

// Public identifiers from the reviewed AdSense account, never credentials.
export const GOOGLE_ADSENSE_PUBLISHER = "ca-pub-4750881749573716";
export const GOOGLE_ADSENSE_CONTENT_SLOT = "1144802452";
export const ADVERTISING_PRIVACY_CHANGED_EVENT =
	"blendcalc:advertising-privacy-changed";
