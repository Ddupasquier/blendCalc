import type {
	PrivilegedToolInformation,
	PrivilegedToolInformationKey,
} from "./types";

export const privilegedToolInformationByTool = {
	"product-submissions": {
		title: "About product submissions",
		purpose:
			"Use this queue to decide whether submitted package information is ready to become shared blendCalc catalog data.",
		reviewSteps: [
			"Confirm the barcode, product identity, and package photos belong together.",
			"Compare reported differences, nutrition values, and any outside-source checks.",
			"Approve only supported information, or reject it with a clear correction reason.",
		],
		decisionEffect:
			"Approval publishes the reviewed catalog revision. Rejection keeps the submission out of the shared catalog and preserves the review record.",
		guardrail:
			"Missing evidence, unresolved identity problems, and test fixtures cannot be approved.",
	},
	"food-warning-reports": {
		title: "About food warning reports",
		purpose:
			"Use this queue when someone says a food warning is missing or appears to be incorrect.",
		reviewSteps: [
			"Confirm the exact food, user setting, warning, and policy version involved.",
			"Compare the package evidence and stored matching facts.",
			"Record whether the report is supported and which correction workflow should happen next.",
		],
		decisionEffect:
			"Saving a review records the evidence-backed next step. It does not silently rewrite product data or food-safety rules.",
		guardrail:
			"When the evidence is incomplete, preserve the uncertainty instead of assuming a food is safe.",
	},
	"profile-images": {
		title: "About profile image reports",
		purpose:
			"Use this queue only for profile images another user has reported. Ordinary uploads do not require approval.",
		reviewSteps: [
			"Inspect the exact reported image and every reason attached to it.",
			"Keep the image when the report is unsupported, or remove it when the image breaks the rules.",
			"Write a short private note explaining what you verified.",
		],
		decisionEffect:
			"Keeping an image dismisses its pending reports. Removing it clears only that exact current image and preserves the private review history.",
		guardrail:
			"A report never hides an image automatically, and a replacement image must not be removed because an older image was reported.",
	},
	"account-access": {
		title: "About account access",
		purpose:
			"Use this tool to inspect an account's current standing and block or restore access when policy requires it.",
		reviewSteps: [
			"Search for the exact account and open its summary.",
			"Review role, account status, image status, sharing restrictions, and prior moderator rejections.",
			"Open Access controls only when an account-level action is necessary.",
		],
		decisionEffect:
			"Blocking stops account access and records the reason shown to the user. Restoring access reverses the block without deleting moderation history.",
		guardrail:
			"You cannot moderate yourself, and protected roles require a more privileged reviewer.",
	},
	"catalog-review-work": {
		title: "About catalog review work",
		purpose:
			"Use this queue to resolve catalog conflicts, provider changes, and possible official recall matches.",
		reviewSteps: [
			"Confirm the exact product and evidence behind the reported change or match.",
			"Keep the current revision only when its existing evidence remains stronger.",
			"Route supported changes through a correction so approval creates a new revision.",
		],
		decisionEffect:
			"Review decisions preserve the current catalog revision until a separate evidence-backed correction is approved.",
		guardrail:
			"A provider response or probable match never overwrites canonical product data by itself.",
	},
	"data-operations": {
		title: "About data operations",
		purpose:
			"Use this workspace to understand why catalog records, source policies, mappings, datasets, or revisions need operational work.",
		reviewSteps: [
			"Start with publication readiness and open the affected product or data area.",
			"Confirm whether the issue has an evidence-only repair or requires reviewed source material.",
			"Run supported repairs as a dry run before applying any bounded change.",
		],
		decisionEffect:
			"Operational repairs preserve immutable evidence and report every changed, skipped, and unresolved record.",
		guardrail:
			"Data operations never invent missing facts or turn an unreviewed source into public API data.",
	},
} satisfies Record<PrivilegedToolInformationKey, PrivilegedToolInformation>;
