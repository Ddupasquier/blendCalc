import { env } from "$env/dynamic/private";
import {
	evaluateBlendCalcAPIOperationalAlerts,
	type BlendCalcAPIOperationalAlert,
} from "$lib/server/blendCalcAPI/operations/blendCalcAPIOperationalAlerts.server";
import { readBlendCalcAPIOperationsDashboard } from "$lib/server/blendCalcAPI/operations/blendCalcAPIOperations.server";
import { sendBlendCalcAPIOperationalAlertEmail } from "$lib/server/email/blendCalcAPIOperationalAlertEmail.server";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.CRON_SECRET;
	if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
		throw error(401, "Unauthorized");
	}
	const checkedAt = new Date().toISOString();
	let alerts: BlendCalcAPIOperationalAlert[];
	try {
		alerts = evaluateBlendCalcAPIOperationalAlerts(
			await readBlendCalcAPIOperationsDashboard(),
			new Date(checkedAt),
		);
	} catch (alertError) {
		console.error("[blendCalcAPI] operational dashboard read failed", {
			errorType:
				alertError instanceof Error ? alertError.name : typeof alertError,
		});
		alerts = [
			{
				code: "operations_dashboard_unavailable" as const,
				severity: "critical" as const,
				summary:
					"The protected monitor could not read one or more operational data stores.",
				title: "API operations dashboard unavailable",
			},
		];
	}
	if (alerts.length === 0) {
		return json(
			{ action: "checked", alertCodes: [], alertCount: 0, checkedAt },
			{ headers: { "cache-control": "private, no-store" } },
		);
	}
	const email = await sendBlendCalcAPIOperationalAlertEmail({
		alerts,
		checkedAt,
	});
	if (email.status === "failed") {
		console.error("[blendCalcAPI] operational alert delivery failed", {
			errorCode: email.errorCode,
		});
		throw error(503, "Operational alert delivery is temporarily unavailable.");
	}
	return json(
		{
			action: "sent",
			alertCodes: alerts.map((alert) => alert.code),
			alertCount: alerts.length,
			checkedAt,
		},
		{ headers: { "cache-control": "private, no-store" } },
	);
};
