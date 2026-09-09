/**
 * Purpose: Define and load the source-controlled Supabase Auth email catalog used by
 * local development, hosted configuration, and readiness verification.
 * Do not run directly; use the hosted Auth configuration or audit commands.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const AUTH_EMAIL_TEMPLATE_DEFINITIONS = [
	{
		key: "confirmation",
		filename: "confirmation.html",
		subject: "Welcome to blendCalc — confirm your email",
		requiredVariables: [".Email", ".ConfirmationURL"],
	},
	{
		key: "recovery",
		filename: "recovery.html",
		subject: "Reset your blendCalc password",
		requiredVariables: [".Email", ".ConfirmationURL"],
	},
	{
		key: "invite",
		filename: "invite.html",
		subject: "You’re invited to blendCalc",
		requiredVariables: [".Email", ".ConfirmationURL"],
	},
	{
		key: "magic_link",
		filename: "magic_link.html",
		subject: "Your blendCalc sign-in link",
		requiredVariables: [".Email", ".ConfirmationURL", ".Token"],
	},
	{
		key: "email_change",
		filename: "email_change.html",
		subject: "Confirm your new blendCalc email",
		requiredVariables: [".NewEmail", ".ConfirmationURL"],
	},
	{
		key: "reauthentication",
		filename: "reauthentication.html",
		subject: "{{ .Token }} is your blendCalc verification code",
		requiredVariables: [".Token"],
	},
];

export const AUTH_EMAIL_NOTIFICATION_DEFINITIONS = [
	{
		key: "password_changed",
		filename: "password_changed_notification.html",
		subject: "Your blendCalc password was changed",
		requiredVariables: [".Email"],
	},
	{
		key: "email_changed",
		filename: "email_changed_notification.html",
		subject: "Your blendCalc email was changed",
		requiredVariables: [".OldEmail", ".Email"],
	},
	{
		key: "mfa_factor_enrolled",
		filename: "mfa_factor_enrolled_notification.html",
		subject: "A blendCalc verification method was added",
		requiredVariables: [".FactorType", ".Email"],
	},
	{
		key: "mfa_factor_unenrolled",
		filename: "mfa_factor_unenrolled_notification.html",
		subject: "A blendCalc verification method was removed",
		requiredVariables: [".FactorType", ".Email"],
	},
	{
		key: "identity_linked",
		filename: "identity_linked_notification.html",
		subject: "A sign-in method was linked to blendCalc",
		requiredVariables: [".Provider", ".Email"],
	},
	{
		key: "identity_unlinked",
		filename: "identity_unlinked_notification.html",
		subject: "A sign-in method was removed from blendCalc",
		requiredVariables: [".Provider", ".Email"],
	},
];

export const AUTH_EMAIL_TEMPLATE_DIRECTORY = "supabase/templates";

export const loadAuthEmailTemplateCatalog = ({
	rootDirectory = process.cwd(),
} = {}) => ({
	templates: AUTH_EMAIL_TEMPLATE_DEFINITIONS.map((definition) => ({
		...definition,
		content: readFileSync(
			resolve(
				rootDirectory,
				AUTH_EMAIL_TEMPLATE_DIRECTORY,
				definition.filename,
			),
			"utf8",
		),
	})),
	notifications: AUTH_EMAIL_NOTIFICATION_DEFINITIONS.map((definition) => ({
		...definition,
		content: readFileSync(
			resolve(
				rootDirectory,
				AUTH_EMAIL_TEMPLATE_DIRECTORY,
				definition.filename,
			),
			"utf8",
		),
	})),
});

export const buildAuthEmailTemplatePatch = (catalog) => {
	const patch = {
		mailer_notifications_phone_changed_enabled: false,
	};

	for (const template of catalog.templates) {
		patch[`mailer_subjects_${template.key}`] = template.subject;
		patch[`mailer_templates_${template.key}_content`] = template.content;
	}
	for (const notification of catalog.notifications) {
		patch[`mailer_subjects_${notification.key}_notification`] =
			notification.subject;
		patch[`mailer_templates_${notification.key}_notification_content`] =
			notification.content;
		patch[`mailer_notifications_${notification.key}_enabled`] = true;
	}

	return patch;
};

export const getAuthEmailTemplatePatch = (options) =>
	buildAuthEmailTemplatePatch(loadAuthEmailTemplateCatalog(options));

export const validateAuthEmailTemplateCatalog = (catalog) => {
	const findings = [];
	for (const template of [...catalog.templates, ...catalog.notifications]) {
		for (const variable of template.requiredVariables) {
			if (!template.content.includes(`{{ ${variable} }}`)) {
				findings.push(`${template.filename} is missing {{ ${variable} }}.`);
			}
		}
		if (!template.content.toLowerCase().includes("<!doctype html>")) {
			findings.push(`${template.filename} is missing an HTML doctype.`);
		}
		if (/https?:\/\/(?!\{\{)/i.test(template.content)) {
			findings.push(`${template.filename} contains a remote URL.`);
		}
		if (/<(?:script|img)\b/i.test(template.content)) {
			findings.push(`${template.filename} contains script or image markup.`);
		}
	}
	return findings;
};
