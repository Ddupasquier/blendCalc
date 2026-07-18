const normalizeProductIdentityText = (value?: string | null) =>
	(value ?? "")
		.trim()
		.toLocaleLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const tokenizeProductIdentity = (value?: string | null) =>
	normalizeProductIdentityText(value)
		.split(/\s+/)
		.filter((token) => token.length > 1);

const getProductNameTokenOverlap = (
	left?: string | null,
	right?: string | null,
) => {
	const leftTokens = new Set(tokenizeProductIdentity(left));
	const rightTokens = new Set(tokenizeProductIdentity(right));
	if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
	const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
	return shared / Math.min(leftTokens.size, rightTokens.size);
};

export const productNamesDiffer = (
	left?: string | null,
	right?: string | null,
) => {
	const normalizedLeft = normalizeProductIdentityText(left);
	const normalizedRight = normalizeProductIdentityText(right);
	return Boolean(
		normalizedLeft &&
			normalizedRight &&
			normalizedLeft !== normalizedRight,
	);
};

export const productNamesAreUnrelated = (
	left?: string | null,
	right?: string | null,
) => {
	const normalizedLeft = normalizeProductIdentityText(left);
	const normalizedRight = normalizeProductIdentityText(right);
	if (!normalizedLeft || !normalizedRight) return false;
	if (
		normalizedLeft.includes(normalizedRight) ||
		normalizedRight.includes(normalizedLeft)
	) {
		return false;
	}
	return getProductNameTokenOverlap(normalizedLeft, normalizedRight) < 0.2;
};
