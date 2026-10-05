begin;
select plan(34);

insert into auth.users (id, aud, role, email) values
('99978000-0000-4000-8000-000000009001','authenticated','authenticated','pagination-admin@blendcalc.local'),
('99978000-0000-4000-8000-000000009002','authenticated','authenticated','pagination-user@blendcalc.local');
insert into public.app_role_assignments(user_id,role) values ('99978000-0000-4000-8000-000000009001','admin');

-- Trusted synthetic fixture construction, not an application write bypass.
select set_config('blendcalc.catalog_product_purge','active',true);

insert into public.shared_products(id,barcode,product_name,search_text,food,source,confidence,category_option_id)
select ('99978000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
    lpad((9790000000000+i)::text,14,'0'), 'QA Pagination '||i, 'qa pagination '||i,
    jsonb_build_object('fdcId',979000+i,'description','QA Pagination '||i,'foodNutrients','[]'::jsonb),
    'community-reviewed','moderator-reviewed',
    (select category_option_id from public.shared_products where barcode='00021130462506')
from generate_series(1,61) i;
select set_config('blendcalc.catalog_product_purge','',true);
insert into public.shared_product_revisions(shared_product_id,revision_number,food,source)
select id,1,food,'community-reviewed' from public.shared_products
where id::text like '99978000-%';

insert into public.shared_product_conflicts(id,shared_product_id,barcode,field_path,observed_values,severity,created_at)
select ('99978100-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    ('99978000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    lpad((9790000000000+i)::text,14,'0'), 'ingredients', '[{"value":"different evidence"}]',
    'high','2026-10-03T12:00:00.123456Z'
from generate_series(1,61) i;
insert into public.shared_product_conflicts(id,shared_product_id,barcode,field_path,observed_values,severity,created_at)
select ('99978200-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    '99978000-0000-4000-8000-000000000001', '09790000000001',
    'nutrient:'||(10000+i), '[{"value":12}]', 'high','2026-10-03T12:00:00.123456Z'
from generate_series(1,60) i;

insert into public.shared_product_observations(id,barcode,source,source_license,raw_payload,content_hash)
select ('99978300-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    lpad((9790000000000+i)::text,14,'0'),'usda','public-domain','{}',repeat('a',64)
from generate_series(1,61) i;
insert into public.catalog_provider_product_snapshots(id,shared_product_id,provider_key,source_reference,observation_id,content_hash,normalized_snapshot,observed_at)
select ('99978400-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    ('99978000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'usda','QA-pagination-'||i,
    ('99978300-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,repeat('b',64), '{}','2026-10-03T12:00:00.123456Z'
from generate_series(1,61) i;
insert into public.catalog_provider_change_reviews(id,shared_product_id,provider_key,snapshot_id,change_summary,material_field_paths,created_at)
select ('99978500-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    ('99978000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'usda',
    ('99978400-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    '{"changes":[{"field":"ingredients","label":"Ingredients","severity":"high","previousValue":"old","observedValue":"new"}]}',
    array['ingredients'],'2026-10-03T12:00:00.123456Z'
from generate_series(1,61) i;

-- Independent synthetic providers preserve the one-pending-review-per-provider
-- constraint while exercising more than three exact-product pages. Disabled sources
-- are fixture identities only; no external adapter or provider is contacted.
insert into public.product_data_sources(key,display_name,source_type,enabled)
select 'qa-99978-provider-'||i,'QA Pagination Provider '||i,'external_api',false
from generate_series(1,60) i;
insert into public.catalog_provider_product_snapshots(id,shared_product_id,provider_key,source_reference,observation_id,content_hash,normalized_snapshot,observed_at)
select ('99978a00-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    '99978000-0000-4000-8000-000000000001','qa-99978-provider-'||i,'QA-pagination-extra-'||i,
    '99978300-0000-4000-8000-000000000001',repeat(md5('provider-page-'||i),2),'{}','2026-10-03T12:00:00.123456Z'
from generate_series(1,60) i;
insert into public.catalog_provider_change_reviews(id,shared_product_id,provider_key,snapshot_id,change_summary,material_field_paths,created_at)
select ('99978b00-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    '99978000-0000-4000-8000-000000000001','qa-99978-provider-'||i,
    ('99978a00-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    '{"changes":[{"field":"ingredients","label":"Ingredients","severity":"high","previousValue":"old","observedValue":"new"}]}',
    array['ingredients'],'2026-10-03T12:00:00.123456Z'
from generate_series(1,60) i;

insert into public.official_food_safety_alerts(id,provider_key,external_alert_id,alert_type,status,product_description,source_url,current_content_hash,is_active)
select ('99978600-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    'open-fda-food-enforcement','QA-pagination-'||i,'recall','ongoing','QA notice '||i,
    'https://example.invalid/qa',repeat('c',64),true
from generate_series(1,61) i;
insert into public.official_food_safety_alert_matches(id,alert_id,shared_product_id,match_type,status,detected_at)
select ('99978700-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    ('99978600-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    '99978000-0000-4000-8000-000000000001','manual','needs_review','2026-10-03T12:00:00.123456Z'
from generate_series(1,61) i;

select ok(not has_function_privilege('anon','public.get_catalog_review_page(text,uuid,jsonb,integer)','execute'),'anonymous cannot read pages');
select ok(not has_table_privilege('authenticated','private.catalog_review_page_entries','select'),'browser cannot read private projection');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"99978000-0000-4000-8000-000000009002","role":"authenticated","app_role":"user","aal":"aal2"}',true);
select throws_ok($$select public.get_catalog_review_page('products')$$,'42501','MFA-verified catalog-review access is required.','ordinary user refused');
select set_config('request.jwt.claims','{"sub":"99978000-0000-4000-8000-000000009001","role":"authenticated","app_role":"admin","aal":"aal1"}',true);
select throws_ok($$select public.get_catalog_review_page('products')$$,'42501','MFA-verified catalog-review access is required.','AAL1 privileged user refused');
select set_config('request.jwt.claims','{"sub":"99978000-0000-4000-8000-000000009001","role":"authenticated","app_role":"admin","aal":"aal2"}',true);
select throws_ok($$select public.get_catalog_review_page('products',null,null,21)$$,'22023','Invalid catalog review page.','page cap cannot be bypassed');
select throws_ok($$select public.get_catalog_review_page('conflicts')$$,'22023','Invalid catalog review page.','decision page requires exact product');

create temporary table pagination_results (queue text, page integer, result jsonb);
insert into pagination_results values ('products',1,public.get_catalog_review_page('products'));
select is(jsonb_array_length(result->'items'),20,'first inbox page bounded') from pagination_results;
select is((result->'items'->0->>'productId'),'99978000-0000-4000-8000-000000000001','recall product first') from pagination_results;
select is((result->'items'->0->'counts'->>'conflicts')::integer,61,'product counts include unloaded decisions') from pagination_results;
insert into pagination_results
select 'products',2,public.get_catalog_review_page('products',null,result->'nextCursor') from pagination_results where queue='products' and page=1;
insert into pagination_results
select 'products',3,public.get_catalog_review_page('products',null,result->'nextCursor') from pagination_results where queue='products' and page=2;
select is((select count(distinct item->>'productId')::integer from pagination_results,jsonb_array_elements(result->'items') item where queue='products'),60,'three product pages contain no duplicates');

insert into pagination_results values
('conflicts',1,public.get_catalog_review_page('conflicts','99978000-0000-4000-8000-000000000001')),
('safetyMatches',1,public.get_catalog_review_page('safetyMatches','99978000-0000-4000-8000-000000000001')),
('providerChanges',1,public.get_catalog_review_page('providerChanges','99978000-0000-4000-8000-000000000061'));
select is((result->>'total')::integer,61,'exact conflict total beyond first page') from pagination_results where queue='conflicts';
select is((result->>'total')::integer,61,'exact recall total beyond first page') from pagination_results where queue='safetyMatches';
select is((result->>'total')::integer,1,'product-specific provider work not filtered from global first page') from pagination_results where queue='providerChanges';
insert into pagination_results values ('providerMulti',1,public.get_catalog_review_page('providerChanges','99978000-0000-4000-8000-000000000001'));
select is((result->>'total')::integer,61,'provider count includes unloaded exact-product work') from pagination_results where queue='providerMulti';
select is(jsonb_array_length(result->'items'),20,'provider page is bounded') from pagination_results where queue='providerMulti';
insert into pagination_results select 'providerMulti',2,public.get_catalog_review_page('providerChanges','99978000-0000-4000-8000-000000000001',result->'nextCursor') from pagination_results where queue='providerMulti' and page=1;
insert into pagination_results select 'providerMulti',3,public.get_catalog_review_page('providerChanges','99978000-0000-4000-8000-000000000001',result->'nextCursor') from pagination_results where queue='providerMulti' and page=2;
insert into pagination_results select 'providerMulti',4,public.get_catalog_review_page('providerChanges','99978000-0000-4000-8000-000000000001',result->'nextCursor') from pagination_results where queue='providerMulti' and page=3;
select is((select count(distinct item->>'id')::integer from pagination_results,jsonb_array_elements(result->'items') item where queue='providerMulti'),61,'provider pages preserve tied timestamps without gaps or duplicates');
insert into pagination_results
select queue,2,public.get_catalog_review_page(queue,'99978000-0000-4000-8000-000000000001',result->'nextCursor') from pagination_results where page=1 and queue in ('conflicts','safetyMatches');
insert into pagination_results
select queue,3,public.get_catalog_review_page(queue,'99978000-0000-4000-8000-000000000001',result->'nextCursor') from pagination_results where page=2 and queue in ('conflicts','safetyMatches');
select is((select count(distinct item->>'id')::integer from pagination_results,jsonb_array_elements(result->'items') item where queue='conflicts'),60,'tied conflict timestamps have no duplicates or gaps');
select is((select count(distinct item->>'id')::integer from pagination_results,jsonb_array_elements(result->'items') item where queue='safetyMatches'),60,'tied recall timestamps have no duplicates or gaps');
insert into pagination_results
select queue,4,public.get_catalog_review_page(queue,'99978000-0000-4000-8000-000000000001',result->'nextCursor') from pagination_results where page=3 and queue in ('conflicts','safetyMatches');
select is(jsonb_array_length(result->'items'),1,'partial final conflict page') from pagination_results where queue='conflicts' and page=4;
select is(result->'nextCursor','null'::jsonb,'final recall page has no continuation') from pagination_results where queue='safetyMatches' and page=4;
select lives_ok($$select public.review_official_food_safety_alert_match('99978700-0000-4000-8000-000000000001','dismissed','Synthetic nonmatching package control.')$$,'terminal recall decision still works');
select isnt(public.get_catalog_review_page('safetyMatches','99978000-0000-4000-8000-000000000001')->>'revision',(select result->>'revision' from pagination_results where queue='safetyMatches' and page=1),'completion changes revision');
select is(public.get_catalog_review_page('conflicts','99978000-0000-4000-8000-000000000001')->>'revision',(select result->>'revision' from pagination_results where queue='conflicts' and page=1),'unrelated recall completion preserves conflict evidence revision');
select lives_ok($$select public.review_catalog_provider_change('99978500-0000-4000-8000-000000000061','rejected','Synthetic newer observation is not supported.')$$,'terminal provider decision still works');
select is((public.get_catalog_review_page('providerChanges','99978000-0000-4000-8000-000000000061')->>'total')::integer,0,'completed exact-product queue is empty');
select is((public.get_catalog_review_page('safetyMatches','99978000-0000-4000-8000-000000000001',(select result->'nextCursor' from pagination_results where queue='safetyMatches' and page=1))->'items'->0->>'id'),'99978700-0000-4000-8000-000000000021','removing earlier work does not offset-skip later item');

reset role;
insert into public.shared_product_conflicts(id,shared_product_id,barcode,field_path,observed_values,severity)
select ('99978800-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
    '99978000-0000-4000-8000-000000000001','09790000000001',
    'nutrient:'||(20000+i),'[{"value":15}]','high'
from generate_series(1,140) i;
create temporary table atomic_review as
select jsonb_agg(jsonb_build_object('conflictId',id,'outcome','insufficient_evidence','note','Synthetic atomic review: evidence is insufficient.') order by id) as decisions
from public.catalog_actionable_product_conflicts where shared_product_id='99978000-0000-4000-8000-000000000001';
grant select on atomic_review to authenticated;
set local role authenticated;
select throws_ok($$select public.finish_catalog_conflict_review(
    '99978000-0000-4000-8000-000000000001',
    (select decisions from atomic_review))$$,
    '22023','Choose one outcome for every current catalog conflict.','201-field review refused atomically');
reset role;
update public.shared_product_conflicts set status='resolved',resolved_at=now(),resolution_note='Synthetic upper-bound control.'
where id='99978800-0000-4000-8000-000000000140';
update atomic_review set decisions=(select jsonb_agg(jsonb_build_object('conflictId',id,'outcome','insufficient_evidence','note','Synthetic atomic review: evidence is insufficient.') order by id)
from public.catalog_actionable_product_conflicts where shared_product_id='99978000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select jsonb_array_length(decisions) from atomic_review),200,'all current fields included at upper bound');
select throws_ok($$select public.finish_catalog_conflict_review('99978000-0000-4000-8000-000000000001',(select decisions - 0 from atomic_review))$$,
    '40001','The catalog conflicts changed. Refresh before finishing this review.','partial review refused');
select throws_ok($$select public.finish_catalog_conflict_review('99978000-0000-4000-8000-000000000001',(select jsonb_set(decisions,'{199,note}','"too short"') from atomic_review))$$,
    '22023','Every decision needs a field-specific explanation between 20 and 2000 characters.','invalid last field rolls back earlier decisions');
reset role;
select is((select count(*)::integer from public.catalog_conflict_review_dispositions where shared_product_id='99978000-0000-4000-8000-000000000001'),0,'rollback leaves no partial dispositions');
set local role authenticated;
select is((public.finish_catalog_conflict_review('99978000-0000-4000-8000-000000000001',(select decisions from atomic_review))->>'insufficientEvidenceCount')::integer,200,'200 fields finish in one atomic transaction');
select is((public.get_catalog_review_page('conflicts','99978000-0000-4000-8000-000000000001')->>'total')::integer,0,'finished evidence leaves actionable conflict queue');
reset role;
delete from public.app_role_assignments where user_id='99978000-0000-4000-8000-000000009001';
set local role authenticated;
select throws_ok($$select public.get_catalog_review_page('products')$$,'42501','MFA-verified catalog-review access is required.','stale privileged JWT cannot bypass current role revocation');

select * from finish();
rollback;
