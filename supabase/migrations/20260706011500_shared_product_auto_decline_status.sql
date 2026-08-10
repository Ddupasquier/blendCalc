alter table public.shared_product_submissions
	drop constraint if exists shared_product_submissions_status_check,
	add constraint shared_product_submissions_status_check
		check (status in ('pending', 'approved', 'rejected', 'auto_declined'));

create index if not exists shared_product_submissions_auto_declined_barcode_created_idx
	on public.shared_product_submissions (barcode, created_at desc)
	where status = 'auto_declined';
