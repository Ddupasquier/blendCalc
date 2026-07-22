export type BasicIconProps = {
	class?: string;
	size?: number | string;
	strokeWidth?: number | string;
	title?: string;
};

export type SolidIconProps = Omit<BasicIconProps, "strokeWidth">;
