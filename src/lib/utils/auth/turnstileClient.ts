const TURNSTILE_SCRIPT_ID = "blendcalc-turnstile-script";
const TURNSTILE_SCRIPT_URL =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export type TurnstileWidgetId = string;

export type TurnstileRenderOptions = {
	sitekey: string;
	action: string;
	appearance: "interaction-only";
	responseField: false;
	size: "flexible";
	theme: "auto";
	callback: (token: string) => void;
	"error-callback": () => void;
	"expired-callback": () => void;
};

export type TurnstileClient = {
	render: (
		container: HTMLElement,
		options: TurnstileRenderOptions,
	) => TurnstileWidgetId;
	remove: (widgetId: TurnstileWidgetId) => void;
	reset: (widgetId: TurnstileWidgetId) => void;
};

type TurnstileWindow = Window & {
	turnstile?: TurnstileClient;
};

let turnstileClientPromise: Promise<TurnstileClient> | null = null;

const getLoadedTurnstileClient = () =>
	(window as TurnstileWindow).turnstile ?? null;

export const loadTurnstileClient = (): Promise<TurnstileClient> => {
	const loadedClient = getLoadedTurnstileClient();
	if (loadedClient) return Promise.resolve(loadedClient);
	if (turnstileClientPromise) return turnstileClientPromise;

	turnstileClientPromise = new Promise((resolve, reject) => {
		const existingScript = document.getElementById(
			TURNSTILE_SCRIPT_ID,
		) as HTMLScriptElement | null;
		const script = existingScript ?? document.createElement("script");

		const handleLoad = () => {
			const client = getLoadedTurnstileClient();
			if (client) {
				resolve(client);
				return;
			}
			turnstileClientPromise = null;
			script.remove();
			reject(new Error("Turnstile loaded without its browser API."));
		};
		const handleError = () => {
			turnstileClientPromise = null;
			script.remove();
			reject(new Error("Turnstile could not load."));
		};

		script.addEventListener("load", handleLoad, { once: true });
		script.addEventListener("error", handleError, { once: true });
		if (!existingScript) {
			script.id = TURNSTILE_SCRIPT_ID;
			script.src = TURNSTILE_SCRIPT_URL;
			script.async = true;
			script.defer = true;
			document.head.append(script);
		}
	});

	return turnstileClientPromise;
};
