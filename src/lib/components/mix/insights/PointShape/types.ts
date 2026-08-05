export type PointColor = {
	fill: string;
	stroke: string;
};

export type PointShapeProps = {
	points?: number;
	values?: number[];
	goalValues?: number[];
	labels?: string[];
	valueLabels?: string[];
	pointColors?: PointColor[];
	size?: number;
	fillColor?: string;
	strokeColor?: string;
	gridColor?: string;
	goalColor?: string;
	fullWidth?: boolean;
	class?: string;
};
