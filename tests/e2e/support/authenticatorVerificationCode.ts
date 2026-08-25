import { createHmac } from "node:crypto";

const AUTHENTICATOR_TIME_STEP_SECONDS = 30;
const AUTHENTICATOR_CODE_DIGITS = 6;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const decodeBase32Secret = (secret: string) => {
	let bitBuffer = "";
	for (const character of secret.toUpperCase().replaceAll(/[^A-Z2-7]/gu, "")) {
		const alphabetIndex = BASE32_ALPHABET.indexOf(character);
		if (alphabetIndex < 0) {
			throw new Error(
				"The authenticator setup key contains an invalid character.",
			);
		}
		bitBuffer += alphabetIndex.toString(2).padStart(5, "0");
	}

	const decodedBytes: number[] = [];
	for (let bitIndex = 0; bitIndex + 8 <= bitBuffer.length; bitIndex += 8) {
		decodedBytes.push(
			Number.parseInt(bitBuffer.slice(bitIndex, bitIndex + 8), 2),
		);
	}
	return Buffer.from(decodedBytes);
};

export const createCurrentAuthenticatorVerificationCode = (
	secret: string,
	currentTimeMilliseconds = Date.now(),
) => {
	const timeStep = Math.floor(
		currentTimeMilliseconds / 1000 / AUTHENTICATOR_TIME_STEP_SECONDS,
	);
	const timeStepBuffer = Buffer.alloc(8);
	timeStepBuffer.writeBigUInt64BE(BigInt(timeStep));
	const digest = createHmac("sha1", decodeBase32Secret(secret))
		.update(timeStepBuffer)
		.digest();
	const offset = digest[digest.length - 1] & 0x0f;
	const truncatedCode =
		((digest[offset] & 0x7f) << 24) |
		((digest[offset + 1] & 0xff) << 16) |
		((digest[offset + 2] & 0xff) << 8) |
		(digest[offset + 3] & 0xff);

	return String(truncatedCode % 10 ** AUTHENTICATOR_CODE_DIGITS).padStart(
		AUTHENTICATOR_CODE_DIGITS,
		"0",
	);
};
