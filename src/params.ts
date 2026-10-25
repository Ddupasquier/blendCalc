import { defineParams } from "@sveltejs/kit/params";

export const params = defineParams({
	signedInteger: (value: string) =>
		/^-?\d+$/.test(value) && Number.isSafeInteger(Number(value))
			? value
			: undefined,
	uuid: (value: string) =>
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			value,
		)
			? value
			: undefined,
});
