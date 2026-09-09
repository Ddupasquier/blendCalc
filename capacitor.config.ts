import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "food.blendcalc",
	appName: "blendCalc",
	webDir: "mobile/web",
	loggingBehavior: "debug",
	server: {
		androidScheme: "https",
		iosScheme: "capacitor",
	},
};

export default config;
