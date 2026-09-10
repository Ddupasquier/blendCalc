import type {
	PrivilegedToolInformation,
	PrivilegedToolInformationKey,
} from "./types";

export const privilegedToolInformationByTool = {
	"product-submissions": {
		title: "About product submissions",
		purpose:
			"Use this queue to decide whether submitted package information is ready to become shared blendCalc catalog data.",
		whenToUse:
			"Use it whenever the launcher shows a red Product submissions count. A clear queue needs no routine check.",
		reviewSteps: [
			"Confirm the barcode, product identity, and package photos belong together.",
			"Compare reported differences, nutrition values, and any outside-source checks.",
			"Approve only supported information, or reject it with a clear correction reason.",
		],
		completion:
			"The submission is approved from complete evidence or rejected with a specific correction note in its private review record.",
		decisionEffects: [
			"Approve: publishes the reviewed values as a shared catalog revision, removes the submission from this queue, and makes the product available to shared search.",
			"Reject: publishes nothing, removes the submission from this queue, and saves your correction reason in the private submission record.",
		],
		guardrail:
			"Missing evidence, unresolved identity problems, and test fixtures cannot be approved.",
	},
	"food-warning-reports": {
		title: "About food warning reports",
		purpose:
			"Use this queue when someone says a food warning is missing or appears to be incorrect.",
		whenToUse:
			"Treat every red Food warning reports count as safety-sensitive review work and handle the oldest report first.",
		reviewSteps: [
			"Confirm the exact food, user setting, warning, and policy version involved.",
			"Compare the package evidence and stored matching facts.",
			"Record whether the report is supported and which correction workflow should happen next.",
		],
		completion:
			"The report has a supported outcome, an internal evidence note, and a specific follow-up owner when correction is required.",
		decisionEffects: [
			"Confirm the report: closes it as supported and creates the correction work you select when follow-up is required. The live product and warning policy do not change until that separate work is completed.",
			"Dismiss the report: closes it as unsupported or duplicate, creates no new correction work, and leaves the current product data and warning behavior unchanged.",
		],
		guardrail:
			"When the evidence is incomplete, preserve the uncertainty instead of assuming a food is safe.",
	},
	"profile-images": {
		title: "About profile image reports",
		purpose:
			"Use this queue only for profile images another user has reported. Ordinary uploads do not require approval.",
		whenToUse:
			"Use it only when the launcher shows reported images waiting. Do not routinely approve unreported profile images.",
		reviewSteps: [
			"Inspect the exact reported image and every reason attached to it.",
			"Keep the image when the report is unsupported, or remove it when the image breaks the rules.",
			"Write a short private note explaining what you verified.",
		],
		completion:
			"The exact reported image is kept or removed once, and all reports attached to that image are resolved.",
		decisionEffects: [
			"Keep the image: leaves that exact image visible and dismisses every pending report attached to it.",
			"Remove the image: clears only that exact current image, resolves its pending reports, and preserves the private review history. A replacement image is not affected.",
		],
		guardrail:
			"A report never hides an image automatically, and a replacement image must not be removed because an older image was reported.",
	},
	"account-access": {
		title: "About account access",
		purpose:
			"Use this tool to inspect an account's current standing and block or restore access when policy requires it.",
		whenToUse:
			"Open it for a specific account question or policy escalation. It has no inbox and does not need routine clearing.",
		reviewSteps: [
			"Search for the exact account and open its summary.",
			"Review role, account status, image status, sharing restrictions, and prior moderator rejections.",
			"Open Access controls only when an account-level action is necessary.",
		],
		completion:
			"You verified the intended account and either confirmed its current standing or recorded the necessary access change.",
		decisionEffects: [
			"Block access: prevents the account from signing in and emails the selected public reason to the user.",
			"Restore access: lets the account sign in again immediately while preserving the complete private moderation history.",
		],
		guardrail:
			"You cannot moderate yourself, and protected roles require a more privileged reviewer.",
	},
	"catalog-review-work": {
		title: "About catalog review work",
		purpose:
			"Use this queue to resolve catalog conflicts, provider changes, and possible official recall matches.",
		whenToUse:
			"Use it when its red count is nonzero, beginning with possible recalls. You may also open it at zero to inspect standing catalog review tools.",
		reviewSteps: [
			"Confirm the exact product and evidence behind the reported change or match.",
			"Keep the current revision only when its existing evidence remains stronger.",
			"Route supported changes through a correction so approval creates a new revision.",
		],
		completion:
			"Every item has an evidence-based decision and any supported data change has been routed into a separate correction.",
		decisionEffects: [
			"Confirm a recall match: marks the product as covered by the official notice and creates in-app safety alerts for users who saved it. Dismiss the match: closes it without showing that notice for the product.",
			"Keep a provider observation: closes the observation as rejected and leaves the current revision active. If the provider evidence is stronger, leave it open and start a separate correction; only approval of that correction creates a new revision.",
		],
		guardrail:
			"A provider response or probable match never overwrites canonical product data by itself.",
	},
	"data-operations": {
		title: "About data operations",
		purpose:
			"Use this workspace to understand why catalog records, source policies, mappings, datasets, or revisions need operational work.",
		whenToUse:
			"Use red action counts for required work. Monitoring, source, dataset, and policy totals are reference information unless explicitly marked as needing attention.",
		reviewSteps: [
			"Start with publication readiness and open the affected product or data area.",
			"Confirm whether the issue has an evidence-only repair or requires reviewed source material.",
			"Run supported repairs as a dry run before applying any bounded change.",
		],
		completion:
			"Each affected subject can publish safely, maps to reviewed identities, and has an explainable revision history.",
		decisionEffects: [
			"Dry run: previews the exact records that would change, be skipped, or remain unresolved without changing stored data.",
			"Apply repair: changes only the bounded records shown by the supported repair and preserves immutable source and revision evidence. Leaving without applying changes nothing.",
		],
		guardrail:
			"Data operations never invent missing facts or turn an unreviewed source into public API data.",
	},
} satisfies Record<PrivilegedToolInformationKey, PrivilegedToolInformation>;
