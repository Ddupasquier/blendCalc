export type ProductImageFrameProps = {
	src: string;
	alt: string;
	loading?: "eager" | "lazy";
	onError?: () => void;
};
