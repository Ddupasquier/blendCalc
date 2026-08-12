import {
	API_PUBLICATION_CONCERN_TYPES,
	API_PUBLICATION_REPORTER_TYPES,
	API_PUBLICATION_SUBJECT_TYPES,
	createApiPublicationConcern,
} from "$lib/server/api/publicationConcerns.server";
import {
	requireAppValue,
	throwAppError,
} from "$lib/server/errors/appError.server";
import { readLimitedJson } from "$lib/server/security/requestBody.server";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const MAXIMUM_REQUEST_BYTES = 32 * 1024;

const isMember = <Value extends string>(
	values: readonly Value[],
	value: unknown,
): value is Value => typeof value === "string" && values.includes(value as Value);

export const POST: RequestHandler = async ({ locals, request }) => {
	const payload = await readLimitedJson(request, MAXIMUM_REQUEST_BYTES);
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throwAppError(400, "PUBLICATION_CONCERN_INVALID");
	}
	const body = payload as Record<string, unknown>;
	const reporterType = body.reporterType;
	const concernType = body.concernType;
	const subjectType = body.subjectType;
	if (
		!isMember(API_PUBLICATION_REPORTER_TYPES, reporterType) ||
		!isMember(API_PUBLICATION_CONCERN_TYPES, concernType) ||
		!isMember(API_PUBLICATION_SUBJECT_TYPES, subjectType) ||
		typeof body.contactEmail !== "string" ||
		typeof body.subjectReference !== "string" ||
		typeof body.details !== "string" ||
		(body.contactName !== undefined && typeof body.contactName !== "string") ||
		!Array.isArray(body.evidenceUrls) ||
		!body.evidenceUrls.every((value) => typeof value === "string")
	) {
		throwAppError(400, "PUBLICATION_CONCERN_INVALID");
	}
	const contactName = body.contactName as string | undefined;
	const contactEmail = body.contactEmail as string;
	const subjectReference = body.subjectReference as string;
	const details = body.details as string;
	const evidenceUrls = body.evidenceUrls as string[];
	const validatedReporterType = reporterType as (typeof API_PUBLICATION_REPORTER_TYPES)[number];
	const validatedConcernType = concernType as (typeof API_PUBLICATION_CONCERN_TYPES)[number];
	const validatedSubjectType = subjectType as (typeof API_PUBLICATION_SUBJECT_TYPES)[number];

	let concern;
	try {
		const user = await locals.getVerifiedUser();
		concern = await createApiPublicationConcern({
			reporterType: validatedReporterType,
			contactName,
			contactEmail,
			reporterUserId: user?.id,
			concernType: validatedConcernType,
			subjectType: validatedSubjectType,
			subjectReference,
			details,
			evidenceUrls,
		});
	} catch (error) {
		console.error("[api publication concern] Unable to save report", {
			error: error instanceof Error ? error.message : typeof error,
		});
		throwAppError(503, "PUBLICATION_CONCERN_FAILED");
	}

	return json(
		{
			data: requireAppValue(
				concern,
				400,
				"PUBLICATION_CONCERN_INVALID",
			),
		},
		{
			status: 202,
			headers: { "cache-control": "private, no-store" },
		},
	);
};
