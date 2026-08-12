import {
	placeApiPublicationHold,
	releaseApiPublicationHold,
} from "$lib/server/api/publicationConcerns.server";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { requireModeratorApiAccess } from "$lib/server/moderation/moderationAccess.server";
import { readLimitedJson } from "$lib/server/security/requestBody.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAXIMUM_REQUEST_BYTES = 16 * 1024;
const SUBJECT_TYPES = ["product", "image", "dataset", "source"] as const;
const REASON_CODES = [
	"accuracy-review",
	"rights-review",
	"attribution-review",
	"privacy-review",
	"source-retirement",
	"legal-request",
] as const;

const isMember = <Value extends string>(
	values: readonly Value[],
	value: unknown,
): value is Value => typeof value === "string" && values.includes(value as Value);

export const POST: RequestHandler = async ({ locals, request }) => {
	const { user } = await requireModeratorApiAccess(locals);
	const payload = await readLimitedJson(request, MAXIMUM_REQUEST_BYTES);
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throwAppError(400, "INVALID_REQUEST");
	}
	const body = payload as Record<string, unknown>;
	const subjectType = body.subjectType;
	const reasonCode = body.reasonCode;
	if (
		!isMember(SUBJECT_TYPES, subjectType) ||
		!isMember(REASON_CODES, reasonCode) ||
		typeof body.subjectReference !== "string" ||
		typeof body.publicMessage !== "string" ||
		typeof body.internalNote !== "string" ||
		(body.concernId !== undefined && typeof body.concernId !== "string")
	) {
		throwAppError(400, "INVALID_REQUEST");
	}
	const subjectReference = body.subjectReference as string;
	const publicMessage = body.publicMessage as string;
	const internalNote = body.internalNote as string;
	const concernId = body.concernId as string | undefined;
	const validatedSubjectType = subjectType as (typeof SUBJECT_TYPES)[number];
	const validatedReasonCode = reasonCode as (typeof REASON_CODES)[number];
	try {
		const hold = requireAppValue(
			await placeApiPublicationHold({
				subject: {
					subjectType: validatedSubjectType,
					subjectReference,
				},
				reasonCode: validatedReasonCode,
				publicMessage,
				internalNote,
				actorUserId: user.id,
				concernId,
			}),
			400,
			"INVALID_REQUEST",
		);
		return json({ data: hold }, {
			status: 201,
			headers: { "cache-control": "private, no-store" },
		});
	} catch (error) {
		if (typeof error === "object" && error && "status" in error) throw error;
		console.error("[api publication hold] Unable to place hold", {
			error: error instanceof Error ? error.message : typeof error,
		});
		return throwAppError(503, "MODERATION_DATA_UNAVAILABLE");
	}
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const { user } = await requireModeratorApiAccess(locals);
	const payload = await readLimitedJson(request, MAXIMUM_REQUEST_BYTES);
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throwAppError(400, "INVALID_REQUEST");
	}
	const body = payload as Record<string, unknown>;
	if (typeof body.holdId !== "string" || typeof body.releaseNote !== "string") {
		throwAppError(400, "INVALID_REQUEST");
	}
	const holdId = body.holdId as string;
	const releaseNote = body.releaseNote as string;
	try {
		const released = await releaseApiPublicationHold({
			holdId,
			actorUserId: user.id,
			releaseNote,
		});
		if (!released) throwAppError(404, "RESOURCE_NOT_FOUND");
		return json({ data: { released: true } }, {
			headers: { "cache-control": "private, no-store" },
		});
	} catch (error) {
		if (typeof error === "object" && error && "status" in error) throw error;
		console.error("[api publication hold] Unable to release hold", {
			error: error instanceof Error ? error.message : typeof error,
		});
		return throwAppError(503, "MODERATION_DATA_UNAVAILABLE");
	}
};
