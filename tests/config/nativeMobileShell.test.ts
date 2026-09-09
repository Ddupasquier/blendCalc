import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const capacitorConfig = readFileSync("capacitor.config.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const mobileBootstrap = readFileSync("mobile/web/index.html", "utf8");

describe("native mobile shell", () => {
	it("uses bundled local assets and secure schemes", () => {
		expect(capacitorConfig).toContain('appId: "food.blendcalc"');
		expect(capacitorConfig).toContain('webDir: "mobile/web"');
		expect(capacitorConfig).toContain('androidScheme: "https"');
		expect(capacitorConfig).not.toMatch(/\burl\s*:/);
		expect(capacitorConfig).not.toContain("cleartext");
		expect(capacitorConfig).not.toContain("allowNavigation");
	});

	it("keeps Capacitor packages on one major and exposes maintained commands", () => {
		for (const packageName of [
			"@capacitor/android",
			"@capacitor/core",
			"@capacitor/ios",
		]) {
			expect(packageJson.dependencies[packageName]).toMatch(/^\^?8\./);
		}
		expect(packageJson.dependencies["@capacitor/barcode-scanner"]).toMatch(
			/^\^?3\./,
		);
		expect(packageJson.devDependencies["@capacitor/cli"]).toBe("8.4.3");
		for (const scriptName of [
			"mobile:sync",
			"mobile:sync:ios",
			"mobile:sync:android",
			"mobile:open:ios",
			"mobile:open:android",
			"mobile:doctor",
		]) {
			expect(packageJson.scripts[scriptName]).toBeTruthy();
		}
	});

	it("declares native camera access and the scanner minimum Android SDK", () => {
		const androidVariables = readFileSync("android/variables.gradle", "utf8");
		const androidManifest = readFileSync(
			"android/app/src/main/AndroidManifest.xml",
			"utf8",
		);
		const iosInfo = readFileSync("ios/App/App/Info.plist", "utf8");

		expect(androidVariables).toContain("minSdkVersion = 26");
		expect(androidManifest).toContain("android.permission.CAMERA");
		expect(iosInfo).toContain("NSCameraUsageDescription");
	});

	it("ships a local bootstrap instead of a remote webview", () => {
		expect(mobileBootstrap).toContain("blendCalc mobile");
		expect(mobileBootstrap).not.toMatch(/https?:\/\//);
	});
});
