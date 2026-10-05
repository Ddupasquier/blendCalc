import { createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const createCurrentAuthenticatorVerificationCode = (
	secret: string,
	currentTimeMilliseconds = Date.now(),
) => {
	if (!/^[A-Z2-7]{16,128}$/u.test(secret)) {
		throw new Error("Invalid authenticator setup key.");
	}
	let bits = "";
	for (const character of secret) {
		bits += BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, "0");
	}
	const bytes = [];
	for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
		bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
	}
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(
		BigInt(Math.floor(currentTimeMilliseconds / 30_000)),
	);
	const digest = createHmac("sha1", Buffer.from(bytes))
		.update(counter)
		.digest();
	const offset = digest[digest.length - 1] & 0x0f;
	return String(
		(digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000,
	).padStart(6, "0");
};
