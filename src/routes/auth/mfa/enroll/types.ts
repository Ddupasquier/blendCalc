import type { ActionData, PageData } from "./$types";

export type MfaEnrollmentSetup = {
	factorId: string;
	qrCodeDataUrl: string;
	secret: string;
};

export type MfaEnrollmentPageProps = {
	data: PageData;
	form: ActionData;
};
