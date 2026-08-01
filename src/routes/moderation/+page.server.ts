import { createHash } from "node:crypto";
import { fail } from "@sveltejs/kit";
import type { User } from "@supabase/supabase-js";
import type { Actions, PageServerLoad } from "./$types";
import {
	getModerationEmailConfigurationError,
	sendAccountBlockedEmail,
	type ModerationReason,
} from "$lib/server/email/moderationEmail.server";
import { getSupabaseAdminClient } from "$lib/supabase/admin.server";
import {
	canModerateTargetRole,
	type AppRole,
} from "$lib/utils/moderation/moderation";
import { PROFILE_AVATAR_BUCKET } from "$lib/utils/profile/profile";
import { getDefaultDisplayName } from "$lib/utils/profile/profileValidation";
import {
	approveCommunityProductSubmission,
	listPendingProductSubmissions,
	rejectProductSubmission,
} from "$lib/server/products/catalog.server";
import type { FdcFood } from "$lib/utils/food/types";
import { mapWithConcurrency } from "$lib/server/concurrency/mapWithConcurrency";
import {
	constrainCardImagePlacement,
	getStoredImagePlacement,
	isImageFitMode,
	isImagePlacementMethod,
	isImageRotationDegrees,
} from "$lib/utils/food/images/imagePlacement";
import type {
	ImageFitMode,
	ImagePlacementValue,
} from "$lib/utils/food/images/types";
import {
	formatCatalogChangeValue,
	readCatalogUpdateSummary,
} from "$lib/utils/products/catalogUpdateReview";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import {
	listPendingFoodCompatibilityFeedback,
	reviewFoodCompatibilityFeedback,
} from "$lib/server/food-safety/foodCompatibilityFeedback.server";
import { readLimitedFormData } from "$lib/server/security/requestBody.server";
import { requireModeratorAccess } from "$lib/server/moderation/moderationAccess.server";

const PERMANENT_BAN_DURATION = "876000h";
const MODERATION_FORM_MAX_BYTES = 512 * 1024;
const MODERATION_PAGE_SIZE = 100;
const MODERATION_MAX_PAGES = 100;
const MODERATION_DATABASE_BATCH_CONCURRENCY = 4;
const ALLOWED_REASONS = new Set<ModerationReason>([
	"profile_image_policy_violation",
	"harassment_or_abuse",
	"fraud_or_spam",
	"terms_violation",
]);
const isPresent = <Value>(value: Value | null): value is Value => value !== null;

const getReason = (formData: FormData) => {
	const reason = String(formData.get("reason") ?? "") as ModerationReason;
	return ALLOWED_REASONS.has(reason) ? reason : null;
};

const hashEmail = (email: string) => {
	return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
};

const listAuthUsers = async () => {
	const admin = getSupabaseAdminClient();
	const users: User[] = [];

	for (let page = 1; page <= MODERATION_MAX_PAGES; page += 1) {
		const { data, error: listError } = await admin.auth.admin.listUsers({
			page,
			perPage: MODERATION_PAGE_SIZE,
		});

		if (listError) throwAppError(502, "MODERATION_DATA_UNAVAILABLE");

		users.push(...data.users);
		if (data.users.length < MODERATION_PAGE_SIZE) break;
	}

	return { admin, users };
};

const matchesSearch = (
	user: {
		id: string;
		displayName: string;
		email: string;
		role: AppRole | null;
		status: string;
	},
	query: string,
) => {
	if (!query) return true;

	const searchableValues = [
		user.displayName,
		user.email,
		user.id,
		user.role ?? "user",
		user.status,
	];

	return searchableValues.some((value) => value.toLocaleLowerCase().includes(query));
};

const getTargetContext = async (
	actorUserId: string,
	actorRole: AppRole,
	targetUserId: string,
) => {
	if (!targetUserId || targetUserId === actorUserId) {
		throwAppError(400, "MODERATION_SELF_ACTION_FORBIDDEN");
	}

	const admin = getSupabaseAdminClient();
	const [
		{ data: targetAuth, error: targetAuthError },
		{ data: roleRecord },
		{ data: profile },
	] =
		await Promise.all([
			admin.auth.admin.getUserById(targetUserId),
			admin
				.from("app_role_assignments")
				.select("role")
				.eq("user_id", targetUserId)
				.maybeSingle(),
			admin
				.from("profiles")
				.select("display_name")
				.eq("user_id", targetUserId)
				.maybeSingle(),
		]);

	if (targetAuthError) {
		throwAppError(404, "MODERATION_TARGET_NOT_FOUND");
	}
	const targetUser = requireAppValue(
		targetAuth.user,
		404,
		"MODERATION_TARGET_NOT_FOUND",
	);

	const targetRole = (roleRecord?.role as AppRole | undefined) ?? null;
	if (!canModerateTargetRole(actorRole, targetRole)) {
		throwAppError(403, "MODERATION_TARGET_FORBIDDEN");
	}

	return {
		admin,
		targetUser,
		displayName: profile?.display_name ?? getDefaultDisplayName(targetUser.id),
	};
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user: viewer, role } = await requireModeratorAccess(locals);
	const query = url.searchParams.get("q")?.trim().toLocaleLowerCase() ?? "";
	const [
		{ admin, users: authUsers },
		pendingProductSubmissions,
		pendingCompatibilityFeedback,
	] =
		await Promise.all([
			listAuthUsers(),
			listPendingProductSubmissions(),
			listPendingFoodCompatibilityFeedback(),
		]);
	const userIds = authUsers.map((user) => user.id);
	const userIdBatches = Array.from(
		{ length: Math.ceil(userIds.length / MODERATION_PAGE_SIZE) },
		(_, index) =>
			userIds.slice(
				index * MODERATION_PAGE_SIZE,
				(index + 1) * MODERATION_PAGE_SIZE,
			),
	);
	const relatedRecordBatches = await mapWithConcurrency(
		userIdBatches,
		MODERATION_DATABASE_BATCH_CONCURRENCY,
		async (batch) => {
			const [profileResult, moderationResult, roleResult] = await Promise.all([
				admin
					.from("profiles")
					.select("user_id, display_name, avatar_path, avatar_moderation_status")
					.in("user_id", batch),
				admin
					.from("account_moderation")
					.select("user_id, status, public_reason, updated_at")
					.in("user_id", batch),
				admin
					.from("app_role_assignments")
					.select("user_id, role")
					.in("user_id", batch),
			]);

			if (profileResult.error || moderationResult.error || roleResult.error) {
				throwAppError(502, "MODERATION_DATA_UNAVAILABLE");
			}

			return {
				profiles: (profileResult.data ?? []).filter(isPresent),
				moderation: (moderationResult.data ?? []).filter(isPresent),
				roles: (roleResult.data ?? []).filter(isPresent),
			};
		},
	);
	const profiles = relatedRecordBatches.flatMap((batch) => batch.profiles);
	const moderation = relatedRecordBatches.flatMap((batch) => batch.moderation);
	const roles = relatedRecordBatches.flatMap((batch) => batch.roles);

	const profileByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
	const moderationByUserId = new Map(
		(moderation ?? []).map((record) => [record.user_id, record]),
	);
	const roleByUserId = new Map((roles ?? []).map((record) => [record.user_id, record.role]));
	const avatarPaths = (profiles ?? [])
		.map((profile) => profile.avatar_path)
		.filter((path): path is string => Boolean(path));
	const signedAvatarByPath = new Map<string, string>();

	if (avatarPaths.length > 0) {
		const { data: signedAvatars } = await admin.storage
			.from(PROFILE_AVATAR_BUCKET)
			.createSignedUrls(avatarPaths, 10 * 60);
		for (const avatar of signedAvatars ?? []) {
			if (avatar.path && avatar.signedUrl) {
				signedAvatarByPath.set(avatar.path, avatar.signedUrl);
			}
		}
	}

	const users = authUsers.map((user) => {
		const profile = profileByUserId.get(user.id);
		const moderationRecord = moderationByUserId.get(user.id);
		const userRole = (roleByUserId.get(user.id) as AppRole | undefined) ?? null;

		return {
			id: user.id,
			displayName: profile?.display_name ?? getDefaultDisplayName(user.id),
			email: user.email ?? "No email available",
			createdAt: user.created_at,
			role: userRole,
			status: moderationRecord?.status ?? "active",
			publicReason: moderationRecord?.public_reason ?? null,
			avatarModerationStatus: profile?.avatar_moderation_status ?? "none",
			avatarUrl: profile?.avatar_path
				? signedAvatarByPath.get(profile.avatar_path) ?? null
				: null,
		};
	});

	const productSubmissions = pendingProductSubmissions.map(
		(submission) => {
			const food = submission.food as unknown as FdcFood;
			const validationReport = submission.validation_report as {
				valid?: boolean;
				issues?: unknown;
				evidenceComplete?: boolean;
				conflictCount?: number;
				externalLookupFailed?: boolean;
				qaSeed?: boolean;
				imageCrop?: {
					cropX?: number;
					cropY?: number;
					cropZoom?: number;
					rotationDegrees?: ImagePlacementValue["rotationDegrees"];
					fitMode?: ImageFitMode;
					placementVersion?: number;
					placementMethod?: ImagePlacementValue["placementMethod"];
					suggestionVersion?: string;
					suggestionConfidence?: number;
				} | null;
			};
			const validationIssues = Array.isArray(validationReport.issues)
				? validationReport.issues.filter(
						(issue): issue is string => typeof issue === "string" && Boolean(issue.trim()),
					)
				: [];
			const updateSummary = readCatalogUpdateSummary(submission.change_summary);
			return {
				id: submission.id,
				barcode: submission.barcode,
				productName: submission.product_name,
				brandOwner: submission.brand_owner,
				matchedSource: submission.matched_source,
				matchedReference: submission.matched_reference,
				createdAt: submission.created_at,
				evidenceComplete: submission.evidence_complete,
				evidence: [
					{ key: "front", label: "Front of package", url: submission.evidenceUrls.front },
					{ key: "nutrition", label: "Nutrition facts", url: submission.evidenceUrls.nutrition },
					{ key: "barcode", label: "Barcode", url: submission.evidenceUrls.barcode },
				].filter((item) => Boolean(item.url)),
				frontEvidenceUrl: submission.evidenceUrls.front ?? null,
				imageCrop: getStoredImagePlacement({
					cropX: validationReport.imageCrop?.cropX ?? 50,
					cropY: validationReport.imageCrop?.cropY ?? 50,
					cropZoom: validationReport.imageCrop?.cropZoom ?? 1,
					rotationDegrees:
						validationReport.imageCrop?.rotationDegrees,
					fitMode: validationReport.imageCrop?.fitMode,
					placementVersion: validationReport.imageCrop?.placementVersion,
					placementMethod:
						validationReport.imageCrop?.placementMethod,
					suggestionVersion:
						validationReport.imageCrop?.suggestionVersion,
					suggestionConfidence:
						validationReport.imageCrop?.suggestionConfidence,
				}),
				conflictCount: validationReport.conflictCount ?? 0,
				externalLookupFailed: validationReport.externalLookupFailed ?? false,
				validationIssues,
				isQaFixture: validationReport.qaSeed === true,
				submissionKind: submission.submission_kind,
				submissionIntent: submission.submission_intent,
				labelObservedAt: submission.label_observed_at,
				labelObservedDate: submission.label_observed_at.slice(0, 10),
				updateReview: updateSummary
					? {
							baseRevisionNumber: updateSummary.baseRevisionNumber,
							changes: updateSummary.changes.map((change) => ({
								field: change.field,
								label: change.label,
								changeType: change.changeType,
								previousValue: formatCatalogChangeValue(change.previousValue),
								submittedValue: formatCatalogChangeValue(change.submittedValue),
							})),
							sourceChecks: updateSummary.sourceChecks.map((sourceCheck) => ({
								source: sourceCheck.source === "usda"
									? "USDA FoodData Central"
									: "Open Food Facts",
								status: sourceCheck.status === "error"
									? "Check failed"
									: sourceCheck.status === "not-found"
										? "No exact barcode match"
										: sourceCheck.supportsSubmittedValues
											? "Matches proposed label"
											: sourceCheck.supportsCurrentValues
												? "Matches current catalog"
												: "Exact barcode found; values differ",
								sourceReference: sourceCheck.sourceReference,
							})),
						}
					: null,
				nutrients: (food.foodNutrients ?? []).map((nutrient) => ({
					name: nutrient.nutrientName,
					value: nutrient.value,
					unit: nutrient.unitName,
				})),
			};
		},
	);

	return {
		viewerRole: role,
		viewerUserId: viewer.id,
		query: url.searchParams.get("q")?.trim() ?? "",
		resultCount: users.filter((user) => matchesSearch(user, query)).length,
		totalCount: users.length,
		users: users.filter((user) => matchesSearch(user, query)),
		productSubmissions,
		compatibilityFeedback: pendingCompatibilityFeedback.map((feedback) => {
			const policyVersion = feedback.policy_version as unknown as
				| { version_number: number }
				| null;
			return {
				id: feedback.id,
				feedbackType: feedback.feedback_type,
				reportedBy: feedback.reported_by,
				sharedProductId: feedback.shared_product_id,
				sharedProductRevisionId: feedback.shared_product_revision_id,
				sourceKey: feedback.source_key,
				sourceId: feedback.source_id,
				barcode: feedback.barcode,
				foodDescription: feedback.food_description,
				warningId: feedback.warning_id,
				issueCode: feedback.issue_code,
				issueParams: feedback.issue_params,
				factSnapshot: feedback.fact_snapshot,
				preferenceType: feedback.preference_type,
				preferenceValue: feedback.preference_value,
				observedLabelDate: feedback.observed_label_date,
				evidenceUrl: feedback.evidence_signed_url,
				reportReason: feedback.report_reason,
				reportDetails: feedback.report_details,
				createdAt: feedback.created_at,
				policyVersion: policyVersion?.version_number ?? null,
			};
		}),
	};
};

export const actions: Actions = {
	reviewCompatibilityFeedback: async ({ locals, request }) => {
		const { user } = await requireModeratorAccess(locals);
		const formData = await readLimitedFormData(
			request,
			MODERATION_FORM_MAX_BYTES,
		);
		const feedbackId = String(formData.get("feedbackId") ?? "");
		const status = String(formData.get("status") ?? "");
		const resolutionAction = String(
			formData.get("resolutionAction") ?? "none",
		);
		const reviewNote = String(formData.get("reviewNote") ?? "").trim();

		if (
			!feedbackId ||
			(status !== "confirmed" && status !== "dismissed") ||
			![
				"none",
				"rule_review",
				"source_correction",
				"product_correction",
				"duplicate",
			].includes(resolutionAction) ||
			!reviewNote
		) {
			return fail(400, {
				compatibilityReviewError:
					"Choose an outcome, next step, and add a review note.",
			});
		}

		try {
			const reviewed = await reviewFoodCompatibilityFeedback(user.id, {
				id: feedbackId,
				status,
				resolutionAction: resolutionAction as
					| "none"
					| "rule_review"
					| "source_correction"
					| "product_correction"
					| "duplicate",
				reviewNote,
			});
			return reviewed
				? {
					compatibilityReviewSuccess:
						"Compatibility report reviewed.",
				}
				: fail(409, {
					compatibilityReviewError:
						"That report was already reviewed. Refresh the page.",
				});
		} catch {
			return fail(500, {
				compatibilityReviewError:
					"We couldn’t save that compatibility review.",
			});
		}
	},
	approveProduct: async ({ locals, request }) => {
		const { user } = await requireModeratorAccess(locals);
		const formData = await readLimitedFormData(
			request,
			MODERATION_FORM_MAX_BYTES,
		);
		const submissionId = String(formData.get("submissionId") ?? "");
		const fitModeValue = String(formData.get("imageFitMode") ?? "");
		const placementMethodValue = String(
			formData.get("imagePlacementMethod") ?? "manual",
		);
		if (!isImageFitMode(fitModeValue)) {
			return fail(400, { productReviewError: "Choose a valid image placement." });
		}
		if (!isImagePlacementMethod(placementMethodValue)) {
			return fail(400, { productReviewError: "Choose a valid image placement method." });
		}
		const usesSmartSuggestion =
			placementMethodValue === "smart-ocr" ||
			placementMethodValue === "smart-ocr-adjusted";
		const suggestionVersion = String(
			formData.get("imageSuggestionVersion") ?? "",
		).trim();
		const suggestionConfidence = Number(
			formData.get("imageSuggestionConfidence"),
		);
		const rotationDegrees = Number(
			formData.get("imageRotationDegrees") ?? 0,
		);
		if (!isImageRotationDegrees(rotationDegrees)) {
			return fail(400, {
				productReviewError: "Choose a supported image rotation.",
			});
		}
		if (
			usesSmartSuggestion &&
			(!suggestionVersion || !Number.isFinite(suggestionConfidence))
		) {
			return fail(400, {
				productReviewError: "Smart image placement provenance is incomplete.",
			});
		}
		const imageCrop = constrainCardImagePlacement({
			cropX: Number(formData.get("imageCropX") ?? 50),
			cropY: Number(formData.get("imageCropY") ?? 50),
			cropZoom: Number(formData.get("imageCropZoom") ?? 1),
			rotationDegrees,
			fitMode: fitModeValue,
			placementVersion: Number(formData.get("imagePlacementVersion") ?? 1),
			placementMethod: placementMethodValue,
			...(usesSmartSuggestion
				? {
					suggestionVersion,
					suggestionConfidence,
				}
				: {}),
		});
		if (!submissionId) {
			return fail(400, { productReviewError: "Choose a product submission." });
		}

		try {
			await approveCommunityProductSubmission(submissionId, user.id, imageCrop);
			return { productReviewSuccess: "Product approved for shared search." };
		} catch {
			return fail(500, {
				productReviewError: "The product could not be approved.",
			});
		}
	},
	rejectProduct: async ({ locals, request }) => {
		const { user } = await requireModeratorAccess(locals);
		const formData = await readLimitedFormData(
			request,
			MODERATION_FORM_MAX_BYTES,
		);
		const submissionId = String(formData.get("submissionId") ?? "");
		const reviewNote = String(formData.get("reviewNote") ?? "").trim();
		if (!submissionId || !reviewNote) {
			return fail(400, {
				productReviewError: "Add a short rejection reason.",
			});
		}

		try {
			await rejectProductSubmission(submissionId, user.id, reviewNote);
			return { productReviewSuccess: "Product submission rejected." };
		} catch {
			return fail(500, {
				productReviewError: "The product could not be rejected.",
			});
		}
	},
	ban: async ({ locals, request }) => {
		const { user: actor, role: actorRole } = await requireModeratorAccess(locals);
		const formData = await readLimitedFormData(
			request,
			MODERATION_FORM_MAX_BYTES,
		);
		const targetUserId = String(formData.get("targetUserId") ?? "");
		const reason = getReason(formData);

		if (!reason) return fail(400, { moderationError: "Choose a valid block reason." });

		const { admin, targetUser, displayName } = await getTargetContext(
			actor.id,
			actorRole,
			targetUserId,
		);
		const { data: currentModeration, error: moderationLookupError } = await admin
			.from("account_moderation")
			.select("status")
			.eq("user_id", targetUserId)
			.maybeSingle();
		if (moderationLookupError) {
			return fail(500, { moderationError: "The account status could not be checked." });
		}
		if (currentModeration?.status === "banned") {
			return { moderationWarning: "That account is already blocked." };
		}
		const emailConfigurationError = getModerationEmailConfigurationError();
		if (emailConfigurationError) {
			return fail(503, {
				moderationError:
					"Account not blocked. Configure the moderation email service before blocking users.",
			});
		}
		if (!targetUser.email) {
			return fail(400, {
				moderationError:
					"Account not blocked because it has no email address for the required notice.",
			});
		}

		const { error: authBanError } = await admin.auth.admin.updateUserById(targetUserId, {
			ban_duration: PERMANENT_BAN_DURATION,
		});

		if (authBanError) {
			return fail(502, { moderationError: "Supabase Auth did not block that account." });
		}

		const publicReason = "This account was blocked for violating the community rules.";
		const { error: moderationError } = await admin.from("account_moderation").upsert({
			user_id: targetUserId,
			status: "banned",
			public_reason: publicReason,
			expires_at: null,
			moderated_by: actor.id,
		});

		if (moderationError) {
			return fail(500, {
				moderationError: "The login was blocked, but the moderation record could not be saved.",
			});
		}

		if (targetUser.email) {
			const { error: blocklistError } = await admin.from("blocked_signup_emails").upsert({
				email_hash: hashEmail(targetUser.email),
				source_user_id: targetUserId,
				blocked_by: actor.id,
				reason,
				expires_at: null,
			});

			if (blocklistError) {
				return fail(500, {
					moderationError:
						"The account was blocked, but its email could not be added to the signup blocklist.",
				});
			}
		}

		const { data: moderationAction, error: actionError } = await admin
			.from("moderation_actions")
			.insert({
				target_user_id: targetUserId,
				actor_user_id: actor.id,
				action: "ban",
				reason_code: reason,
			})
			.select("id")
			.single();

		if (actionError || !moderationAction) {
			return fail(500, {
				moderationError:
					"The account was blocked, but the moderation audit record could not be saved.",
			});
		}

		if (reason === "profile_image_policy_violation") {
			await admin
				.from("profiles")
				.update({ avatar_moderation_status: "rejected" })
				.eq("user_id", targetUserId);
		}

		const recipientEmailHash = hashEmail(targetUser.email);
		const { data: delivery, error: deliveryInsertError } = await admin
			.from("moderation_email_deliveries")
			.insert({
				moderation_action_id: moderationAction.id,
				target_user_id: targetUserId,
				recipient_email_hash: recipientEmailHash,
				template: "account_blocked",
				provider: "resend",
				status: "pending",
			})
			.select("id")
			.single();

		if (deliveryInsertError || !delivery) {
			return {
				moderationWarning:
					"Account blocked, but the notification email could not be queued for delivery.",
			};
		}

		const emailResult = await sendAccountBlockedEmail({
			email: targetUser.email,
			displayName,
			moderationActionId: moderationAction.id,
			reason,
		});
		const attemptedAt = new Date().toISOString();

		if (emailResult.status === "failed") {
			await admin
				.from("moderation_email_deliveries")
				.update({
					status: "failed",
					error_code: emailResult.errorCode.slice(0, 120),
					error_message: emailResult.errorMessage.slice(0, 1000),
					attempted_at: attemptedAt,
				})
				.eq("id", delivery.id);

			return {
				moderationWarning:
					"Account blocked, but the notification email failed. Check the delivery ledger before retrying.",
			};
		}

		const { error: deliveryUpdateError } = await admin
			.from("moderation_email_deliveries")
			.update({
				status: "sent",
				provider_message_id: emailResult.providerMessageId,
				attempted_at: attemptedAt,
				sent_at: attemptedAt,
			})
			.eq("id", delivery.id);

		if (deliveryUpdateError) {
			return {
				moderationWarning:
					"Account blocked and the email provider accepted the notice, but the delivery ledger could not be updated.",
			};
		}

		return {
			moderationSuccess: "Account blocked and notification email accepted for delivery.",
		};
	},
	unban: async ({ locals, request }) => {
		const { user: actor, role: actorRole } = await requireModeratorAccess(locals);
		const formData = await readLimitedFormData(
			request,
			MODERATION_FORM_MAX_BYTES,
		);
		const targetUserId = String(formData.get("targetUserId") ?? "");
		const { admin } = await getTargetContext(actor.id, actorRole, targetUserId);
		const { data: currentModeration, error: moderationLookupError } = await admin
			.from("account_moderation")
			.select("status")
			.eq("user_id", targetUserId)
			.maybeSingle();
		if (moderationLookupError) {
			return fail(500, { moderationError: "The account status could not be checked." });
		}
		if (!currentModeration || currentModeration.status !== "banned") {
			return { moderationWarning: "That account already has access." };
		}
		const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, {
			ban_duration: "none",
		});

		if (authError) {
			return fail(502, { moderationError: "Supabase Auth did not restore that account." });
		}

		const { error: moderationError } = await admin.from("account_moderation").upsert({
			user_id: targetUserId,
			status: "active",
			public_reason: null,
			expires_at: null,
			moderated_by: actor.id,
		});

		if (moderationError) {
			return fail(500, {
				moderationError: "The login was restored, but the moderation record could not be saved.",
			});
		}

		await Promise.all([
			admin.from("blocked_signup_emails").delete().eq("source_user_id", targetUserId),
			admin.from("moderation_actions").insert({
				target_user_id: targetUserId,
				actor_user_id: actor.id,
				action: "unban",
				reason_code: "moderator_reversal",
			}),
		]);

		return { moderationSuccess: "Account access restored." };
	},
};
