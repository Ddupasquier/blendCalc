drop index if exists public.shared_product_submissions_user_pending_barcode_unique;

create unique index shared_product_submissions_pending_barcode_unique
	on public.shared_product_submissions (barcode)
	where status = 'pending';
