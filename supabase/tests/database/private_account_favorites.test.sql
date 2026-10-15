begin;
select plan(31);
insert into auth.users(id,aud,role,email) values
 ('06500000-0000-4000-8000-000000000001','authenticated','authenticated','favorite-one@blendcalc.local'),
 ('06500000-0000-4000-8000-000000000002','authenticated','authenticated','favorite-two@blendcalc.local');
insert into public.shared_product_submissions(id,submitted_by,barcode,product_name,category_option_id,food,consent_to_share)
values ('06500000-0000-4000-8000-000000000006','06500000-0000-4000-8000-000000000001','00987650000034','Favorite shared fixture',(select id from public.custom_food_category_options where enabled limit 1),'{"fdcId":987650001,"description":"Favorite shared fixture","foodNutrients":[]}',true);
insert into public.shared_products(id,barcode,product_name,search_text,source,confidence,status,approved_submission_id,category_option_id,food) values
 ('06500000-0000-4000-8000-000000000003','00987650000034','Favorite shared fixture','favorite shared fixture','usda','source-verified','active','06500000-0000-4000-8000-000000000006',(select id from public.custom_food_category_options limit 1),'{"fdcId":987650001,"description":"Favorite shared fixture","foodNutrients":[]}');
insert into public.custom_foods(id,user_id,fdc_id,food) values
 ('06500000-0000-4000-8000-000000000004','06500000-0000-4000-8000-000000000001',-987650001,jsonb_build_object('fdcId',-987650001,'description','Favorite private fixture','customFood',true,'foodIdentityType','private-custom','customServingWeightGrams',100,'categoryOptionId',(select id from public.custom_food_category_options where enabled order by id limit 1),'foodNutrients',(select jsonb_agg(jsonb_build_object('nutrientId',nutrient_id,'value',0)) from public.nutrient_manual_entry_required_nutrients where enabled)));
insert into public.saved_drinks(id,user_id,name,drink) values
 ('06500000-0000-4000-8000-000000000005','06500000-0000-4000-8000-000000000001','Favorite recipe fixture','{"name":"Favorite recipe fixture","foods":[]}');
insert into public.generic_food_records(dataset_key,source_food_key,description,search_text)
 select key,'favorite-test-food','Favorite generic fixture','favorite generic fixture'
 from public.generic_food_datasets where active and import_enabled limit 1;
select set_config('test.favorite_generic_id',(select application_food_id::text from public.generic_food_records where source_food_key='favorite-test-food' limit 1),true);
select set_config('request.jwt.claim.sub','06500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is(public.set_user_favorite('food','987650001',true),'saved','shared target is supported');
select is(public.set_user_favorite('food','987650001',true),'saved','duplicate request is idempotent');
select is((select count(*) from public.user_shared_product_favorites),1::bigint,'one favorite row');
select is(public.set_user_favorite('food','-987650001',true),'saved','private stable target supported');
select is(public.set_user_favorite('food',current_setting('test.favorite_generic_id'),true),'saved','generic target supported');
select is(public.set_user_favorite('recipe','06500000-0000-4000-8000-000000000005',true),'saved','saved recipe supported');
select is((select count(*) from public.user_food_list_items),0::bigint,'favorites never place list items');
select is(public.set_user_favorite('food','987659999',true),'unavailable','unknown target unavailable');
select throws_ok($$insert into public.user_shared_product_favorites(user_id,product_id) values(auth.uid(),'06500000-0000-4000-8000-000000000003')$$,'42501',null,'direct writes denied');
select is((public.read_user_favorite_food_page('', 'recent',1,0)->>'totalCount')::int,3,'server owns count');
select is(jsonb_array_length(public.read_user_favorite_food_page('', 'recent',1,0)->'items'),1,'page limit enforced');
select is(jsonb_array_length(public.read_user_favorite_food_page('', 'recent',1,3)->'items'),0,'past last page is empty');
select is((public.read_user_favorite_food_page('no-match', 'recent',15,0)->>'totalCount')::int,0,'search count is honest');
select throws_ok($$select public.read_user_favorite_food_page('', 'recent',null,0)$$,'22023',null,'null cannot bypass page limit');
select throws_ok($$select public.read_user_favorite_food_page('', 'recent',101,0)$$,'22023',null,'oversized page rejected');
select is(public.set_user_favorite('food','987650001',false),'saved','unfavorite supported');
select is(public.set_user_favorite('food','987650001',false),'saved','duplicate unfavorite idempotent');
select is(public.set_user_favorite('food','987650001',true),'saved','shared favorite restored');
reset role;
select set_config('request.jwt.claim.sub','06500000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*) from public.user_custom_food_favorites),0::bigint,'second account cannot read private favorite');
select is((public.read_user_favorite_food_page()->>'totalCount')::int,0,'second account cannot read favorite counts');
select is(public.set_user_favorite('food','-987650001',true),'unavailable','second account cannot favorite private target');
select is(public.set_user_favorite('recipe','06500000-0000-4000-8000-000000000005',true),'unavailable','second account cannot favorite recipe');
reset role;
select throws_ok($$insert into public.user_custom_food_favorites(user_id,custom_food_id) values('06500000-0000-4000-8000-000000000002','06500000-0000-4000-8000-000000000004')$$,'23503',null,'composite foreign key independently rejects a different owner');
select ok(not has_function_privilege('anon','public.set_user_favorite(text,text,boolean)','execute'),'anonymous RPC execution denied');
select ok(not has_function_privilege('authenticated','public.resolve_user_favorite_food(bigint)','execute'),'internal resolver is not a browser RPC');
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select throws_ok($$select public.set_user_favorite('food','987650001',true)$$,'42501',null,'missing database identity fails closed');
reset role;
delete from public.generic_food_records where source_food_key='favorite-test-food';
select is((select count(*) from public.user_generic_food_favorites where user_id='06500000-0000-4000-8000-000000000001'),0::bigint,'generic deletion cascades');
delete from public.custom_foods where id='06500000-0000-4000-8000-000000000004';
delete from public.saved_drinks where id='06500000-0000-4000-8000-000000000005';
select is((select count(*) from public.user_custom_food_favorites where user_id='06500000-0000-4000-8000-000000000001'),0::bigint,'private deletion cascades');
select is((select count(*) from public.user_saved_recipe_favorites where user_id='06500000-0000-4000-8000-000000000001'),0::bigint,'recipe deletion cascades');
update public.shared_products set status='retired' where id='06500000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','06500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((public.read_user_favorite_food_page()->>'totalCount')::int,0,'retired target omitted from counts');
select is((select count(*) from public.user_shared_product_favorites),0::bigint,'retired target omitted through RLS');
reset role;
select * from finish();
rollback;
