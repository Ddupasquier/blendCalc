export type PaginationProps = {
	page: number;
	pageSize: number;
	totalItems: number;
	onPageChange: (page: number) => void;
	label?: string;
};
