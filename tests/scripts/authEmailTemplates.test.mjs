import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	AUTH_EMAIL_NOTIFICATION_DEFINITIONS,
	AUTH_EMAIL_TEMPLATE_DEFINITIONS,
	getAuthEmailTemplatePatch,
	loadAuthEmailTemplateCatalog,
	validateAuthEmailTemplateCatalog,
} from "../../scripts/lib/auth/auth_email_templates.mjs";

describe("Auth email template catalog", () => {
	it("loads every supported Auth message from tracked HTML", () => {
		const catalog = loadAuthEmailTemplateCatalog();

		expect(catalog.templates).toHaveLength(6);
		expect(catalog.notifications).toHaveLength(6);
		expect(validateAuthEmailTemplateCatalog(catalog)).toEqual([]);
		for (const template of [...catalog.templates, ...catalog.notifications]) {
			expect(template.content).toContain("blendCalc");
			expect(template.content).toContain("#1a1a2e");
			expect(template.content).not.toMatch(/unsubscribe|marketing/i);
		}
	});

	it("maps subjects, content, and notification choices to hosted fields", () => {
		const patch = getAuthEmailTemplatePatch();

		for (const definition of AUTH_EMAIL_TEMPLATE_DEFINITIONS) {
			expect(patch[`mailer_subjects_${definition.key}`]).toBe(
				definition.subject,
			);
			expect(patch[`mailer_templates_${definition.key}_content`]).toContain(
				"<!doctype html>",
			);
		}
		for (const definition of AUTH_EMAIL_NOTIFICATION_DEFINITIONS) {
			expect(patch[`mailer_notifications_${definition.key}_enabled`]).toBe(
				true,
			);
		}
		expect(patch.mailer_notifications_phone_changed_enabled).toBe(false);
	});

	it("keeps local Mailpit configuration aligned with the catalog", () => {
		const config = readFileSync("supabase/config.toml", "utf8");

		for (const definition of AUTH_EMAIL_TEMPLATE_DEFINITIONS) {
			expect(config).toContain(`[auth.email.template.${definition.key}]`);
			expect(config).toContain(`subject = "${definition.subject}"`);
			expect(config).toContain(
				`content_path = "./supabase/templates/${definition.filename}"`,
			);
		}
		for (const definition of AUTH_EMAIL_NOTIFICATION_DEFINITIONS) {
			expect(config).toContain(`[auth.email.notification.${definition.key}]`);
			expect(config).toContain(`subject = "${definition.subject}"`);
		}
		expect(config).toContain("[auth.email.notification.phone_changed]\n");
		expect(config).toContain(
			"[auth.email.notification.phone_changed]\nenabled = false",
		);
	});
});
