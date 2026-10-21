begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
  select ('13000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.image(n integer) returns uuid language sql immutable as $$
  select ('13010000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
create function pg_temp.actor(n integer, aal text default 'aal1', app_role text default 'user')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.uid(n),'role','authenticated','aal',aal,'app_role',app_role)::text,true);
end;
$$;
create function pg_temp.place(n integer, action text default 'suggest', placement jsonb default
  '{"cropX":52,"cropY":52,"cropZoom":1.05,"rotationDegrees":0,"fitMode":"custom"}', revision bigint default 0)
returns text language sql as $$
  select public.save_food_image_placement(pg_temp.image(n),'https://example.com/placement-'||n||'.png',action,placement,revision)->>'status';
$$;

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at)
select pg_temp.uid(n),'authenticated','authenticated','placement-'||n||'@blendcalc.local',now(),now()
from generate_series(1,99) n;
insert into public.app_role_permissions(role,permission) values('moderator','moderation.catalog.review') on conflict do nothing;
insert into public.app_role_assignments(user_id,role) values(pg_temp.uid(99),'moderator');
insert into public.food_image_placement_contributors(user_id,trusted)
select pg_temp.uid(n),true from generate_series(1,70) n;
insert into public.food_image_assets(id,source,source_reference,image_role,image_url,license_name,
  crop_x,crop_y,crop_zoom,rotation_degrees,fit_mode,placement_version,placement_method,crop_source,
  placement_suggestion_version,placement_suggestion_confidence)
select pg_temp.image(n),'open-food-facts','placement-'||n,'generic','https://example.com/placement-'||n||'.png',
  'Test image licence',50,50,1,0,'custom',2,'automatic-ocr','auto','test-placement-v1',90 from generate_series(1,35) n;
update public.food_image_assets set crop_source='moderator',approved_by=pg_temp.uid(99),approved_at=now() where id=pg_temp.image(6);
update public.food_image_assets set community_placement_locked=true where id=pg_temp.image(7);

select ok(not has_table_privilege('authenticated','public.food_image_assets','update'),'users cannot directly overwrite a shared placement');
select ok(not has_table_privilege('authenticated','public.food_image_placement_preferences','insert'),'personal writes must use the validated owner RPC');
select ok(not has_table_privilege('authenticated','public.food_image_placement_suggestions','insert'),'users cannot forge votes or publication states');
select ok(not has_function_privilege('anon','public.save_food_image_placement(uuid,text,text,jsonb,bigint)','execute'),'anonymous placement writes denied');
select ok(not has_function_privilege('service_role','public.review_food_image_placement(text,uuid,bigint,uuid,uuid,boolean,text)','execute'),'service token cannot invent a user moderation session');

set local role authenticated;
select pg_temp.actor(1);
select is(pg_temp.place(1,'personal'),'personal_saved','ordinary AAL1 account saves personal placement');
select is((select crop_zoom from public.food_image_assets where id=pg_temp.image(1)),1::numeric,'personal adjustment never changes shared image');
select is((select count(*) from public.read_food_image_placement_preferences(array[pg_temp.image(1)])),1::bigint,'personal preference is durable and readable');
select pg_temp.actor(2);
select is((select count(*) from public.read_food_image_placement_preferences(array[pg_temp.image(1)])),0::bigint,'another account receives no personal placement');
select is((select count(*) from public.food_image_placement_preferences),0::bigint,'table RLS also isolates other account preferences');
select pg_temp.actor(1);
select is(pg_temp.place(1,'reset'),'personal_reset','returning to shared placement removes only the personal override');
select is((select count(*) from public.read_food_image_placement_preferences(array[pg_temp.image(1)])),0::bigint,'reset preference stays removed');
select throws_ok($$select pg_temp.place(1,'personal','{}')$$,'22023','Invalid image placement','missing geometry rejected');
select throws_ok($$select pg_temp.place(1,'personal','{"cropX":49,"cropY":50,"cropZoom":1,"rotationDegrees":0,"fitMode":"custom"}')$$,'22023','Invalid image placement','left-only geometry enforced');
select throws_ok($$select pg_temp.place(1,'personal','{"cropX":50,"cropY":50,"cropZoom":9,"rotationDegrees":0,"fitMode":"custom"}')$$,'22023','Invalid image placement','zoom remains bounded');
select throws_ok($$select pg_temp.place(1,'personal','{"cropX":50,"cropY":50,"cropZoom":1,"rotationDegrees":45,"fitMode":"custom"}')$$,'22023','Invalid image placement','quarter-turn rotation enforced');
select throws_ok($$select pg_temp.place(1,'personal','{"cropX":50,"cropY":50,"cropZoom":1,"rotationDegrees":90.1,"fitMode":"custom"}')$$,'22023','Invalid image placement','fractional rotation cannot round into a valid value');
select is(public.save_food_image_placement(pg_temp.image(1),'https://example.com/replaced.png','personal',
  '{"cropX":52,"cropY":52,"cropZoom":1.05,"rotationDegrees":0,"fitMode":"custom"}',0)->>'status','stale','replacement-image edits rejected');
select is(pg_temp.place(1,'suggest',revision=>99),'stale','stale shared revision rejected');
select is(pg_temp.place(1,'personal','{"cropX":52,"cropY":52,"cropZoom":1.05,"rotationDegrees":0,"fitMode":"custom","placementMethod":"smart-ocr","approvedBy":"forged"}'),'personal_saved','manual proposal ignores forged provenance');
select is((select placement->>'placementMethod' from public.food_image_placement_preferences where image_id=pg_temp.image(1)),'manual','browser cannot claim OCR or moderator verification');

select is(pg_temp.place(1),'pending','first qualified contributor leaves a pending proposal');
select is(pg_temp.place(1),'already_submitted','one account cannot vote twice');
select pg_temp.actor(2);
select is(pg_temp.place(1,'suggest','{"cropX":52.4,"cropY":52.3,"cropZoom":1.051,"rotationDegrees":0,"fitMode":"custom"}'),'pending','nearby suggestions combine into the same bounded bucket');
select pg_temp.actor(3);
select is(pg_temp.place(1),'published','third eligible distinct contributor publishes a small matching adjustment');
select is((select crop_zoom from public.food_image_assets where id=pg_temp.image(1)),1.05::numeric,'shared placement updated once');
select is((select placement_revision from public.food_image_assets where id=pg_temp.image(1)),1::bigint,'automatic publication increments shared revision');
select is((select approved_by from public.food_image_assets where id=pg_temp.image(1)),null::uuid,'automatic publication does not invent a moderator');
select is((select count(*) from public.food_image_placement_suggestions where image_id=pg_temp.image(1)),1::bigint,'contributors can read only their own vote');

select pg_temp.actor(80); select is(pg_temp.place(2),'pending','new account can suggest');
select pg_temp.actor(81); select is(pg_temp.place(2),'pending','second new account can suggest');
select pg_temp.actor(82); select is(pg_temp.place(2),'pending','three new accounts do not automatically publish');
select is((select placement_revision from public.food_image_assets where id=pg_temp.image(2)),0::bigint,'unestablished agreement leaves shared image unchanged');
select pg_temp.actor(4); select is(pg_temp.place(3),'pending','first disputed proposal queued');
select pg_temp.actor(5); select is(pg_temp.place(3,'suggest','{"cropX":56,"cropY":56,"cropZoom":1.1,"rotationDegrees":0,"fitMode":"custom"}'),'pending','competing eligible proposal queued');
select pg_temp.actor(6); select is(pg_temp.place(3),'pending','eligible disagreement prevents automatic publication');
select pg_temp.actor(7); select is(pg_temp.place(4,'suggest','{"cropX":80,"cropY":80,"cropZoom":2,"rotationDegrees":0,"fitMode":"custom"}'),'pending','large adjustment queued');
select pg_temp.actor(8); select is(pg_temp.place(4,'suggest','{"cropX":80,"cropY":80,"cropZoom":2,"rotationDegrees":0,"fitMode":"custom"}'),'pending','second large adjustment vote queued');
select pg_temp.actor(9); select is(pg_temp.place(4,'suggest','{"cropX":80,"cropY":80,"cropZoom":2,"rotationDegrees":0,"fitMode":"custom"}'),'pending','three votes cannot auto-approve a large crop');
select pg_temp.actor(10); select is(pg_temp.place(5,'suggest','{"cropX":52,"cropY":52,"cropZoom":1.05,"rotationDegrees":90,"fitMode":"custom"}'),'pending','rotation proposal queued');
select pg_temp.actor(11); select is(pg_temp.place(5,'suggest','{"cropX":52,"cropY":52,"cropZoom":1.05,"rotationDegrees":90,"fitMode":"custom"}'),'pending','second rotation vote queued');
select pg_temp.actor(12); select is(pg_temp.place(5,'suggest','{"cropX":52,"cropY":52,"cropZoom":1.05,"rotationDegrees":90,"fitMode":"custom"}'),'pending','rotation requires moderator review');
select pg_temp.actor(13); select is(pg_temp.place(6,'suggest',revision=>1),'pending','approved placement can receive review suggestions');
select pg_temp.actor(14); select is(pg_temp.place(6,'suggest',revision=>1),'pending','second approved-placement suggestion queued');
select pg_temp.actor(15); select is(pg_temp.place(6,'suggest',revision=>1),'pending','consensus cannot overwrite moderator-approved placement');
select pg_temp.actor(16); select is(pg_temp.place(7,'suggest',revision=>1),'locked','locked placements do not create queue work');
select is(pg_temp.place(7,'personal'),'personal_saved','image lock does not block personal adjustments');

select pg_temp.actor(99,'aal1','moderator');
select throws_ok($$select public.review_food_image_placement('automation',p_enabled=>false)$$,'42501','Moderator verification required','moderator AAL1 cannot control shared publishing');
select pg_temp.actor(1,'aal2','moderator');
select throws_ok($$select public.review_food_image_placement('automation',p_enabled=>false)$$,'42501','Moderator verification required','forged or stale moderator claim needs an actual role assignment');
select pg_temp.actor(99,'aal2','moderator');
select lives_ok($$select public.review_food_image_placement('automation',p_enabled=>false)$$,'verified moderator can pause automation');
select ok((public.get_food_image_placement_workspace()->>'pendingImages')::integer>=5,'moderator workspace groups pending images and counts them');
select is(jsonb_array_length(public.get_food_image_placement_workspace(pg_temp.image(1))->'images'->0->'history'),1,'automatic publication retains reversible history');
select pg_temp.actor(17); select is(pg_temp.place(8),'pending','paused automation accepts suggestion');
select pg_temp.actor(18); select is(pg_temp.place(8),'pending','paused automation accepts second suggestion');
select pg_temp.actor(19); select is(pg_temp.place(8),'pending','global switch blocks automatic publishing despite agreement');
select pg_temp.actor(99,'aal2','moderator');
select lives_ok($$select public.review_food_image_placement('automation',p_enabled=>true)$$,'verified moderator can enable future agreement checks');
select pg_temp.actor(20); select is(pg_temp.place(8),'published','next eligible agreement check can publish after automation resumes');

select pg_temp.actor(99,'aal2','moderator');
select lives_ok($$select public.review_food_image_placement('approve',p_image_id=>pg_temp.image(4),p_revision=>0,
  p_suggestion_id=>(select id from public.food_image_placement_suggestions where image_id=pg_temp.image(4) limit 1))$$,'moderator can approve grouped large change');
select is((select crop_zoom from public.food_image_assets where id=pg_temp.image(4)),2::numeric,'moderator approval publishes chosen geometry');
select is((select count(*) from public.food_image_placement_suggestions where image_id=pg_temp.image(4) and status='published'),3::bigint,'one moderator decision resolves matching group');
select ok((select community_placement_locked from public.food_image_assets where id=pg_temp.image(4)),'approval protects the placement with a lock');
select lives_ok($$select public.review_food_image_placement('undo',p_image_id=>pg_temp.image(4),p_revision=>1)$$,'current shared change can be undone');
select is((select crop_zoom from public.food_image_assets where id=pg_temp.image(4)),1::numeric,'undo restores previous geometry');
select ok((select community_placement_locked from public.food_image_assets where id=pg_temp.image(4)),'undo retains moderator protection');
select throws_ok($$select public.review_food_image_placement('undo',p_image_id=>pg_temp.image(4),p_revision=>1)$$,'40001','Image changed; refresh before reviewing','stale rollback cannot overwrite newer decisions');
select throws_ok($$select public.review_food_image_placement('reject',p_image_id=>pg_temp.image(3),p_revision=>0,
  p_suggestion_id=>(select id from public.food_image_placement_suggestions where image_id=pg_temp.image(3) limit 1))$$,'22023','Give a review reason','reject needs an evidence note');
select lives_ok($$select public.review_food_image_placement('restrict',p_user_id=>pg_temp.uid(5),p_enabled=>true)$$,'moderator can restrict an abusive contributor');
select pg_temp.actor(5); select is(pg_temp.place(9),'restricted','restricted contributor cannot send shared proposals');
select is(pg_temp.place(9,'personal'),'personal_saved','restricted contributor can still personalize');
select pg_temp.actor(21); select is(pg_temp.place(3),'published','restricted competing vote is excluded from consensus');

select pg_temp.actor(90);
select is(pg_temp.place(21),'pending','first daily suggestion allowed');
select is(pg_temp.place(22),'pending','second daily suggestion allowed');
select is(pg_temp.place(23),'pending','third daily suggestion allowed');
select is(pg_temp.place(24),'pending','fourth daily suggestion allowed');
select is(pg_temp.place(25),'pending','fifth daily suggestion allowed');
select is(pg_temp.place(26),'limit_reached','pending/daily limit rejects a sixth suggestion');
select throws_ok($$select public.get_food_image_placement_workspace()$$,'42501','Moderator verification required','ordinary account cannot read private moderation workspace');
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select pg_temp.place(1,'personal')$$,'42501','Authentication required','missing verified identity cannot write preferences');
reset role;
update public.food_image_placement_suggestions set status='rejected' where user_id=pg_temp.uid(90);
set local role authenticated;
select pg_temp.actor(90);
select is(pg_temp.place(26),'limit_reached','clearing pending proposals does not reset the daily limit');
reset role;
update public.food_image_placement_suggestions set created_at=now()-interval '2 days' where user_id=pg_temp.uid(90);
set local role authenticated;
select pg_temp.actor(90); select is(pg_temp.place(26),'pending','daily window expires without recurring infrastructure');
reset role;
update public.food_image_assets set image_url='https://example.com/replacement.png' where id=pg_temp.image(7);
set local role authenticated;
select pg_temp.actor(16);
select is((select count(*) from public.read_food_image_placement_preferences(array[pg_temp.image(7)])),0::bigint,'personal crop for old bytes is not applied to a replacement URL');
reset role;
update auth.users set created_at=now()-interval '31 days' where id=pg_temp.uid(70);
update public.food_image_placement_contributors set trusted=false where user_id=pg_temp.uid(70);
insert into public.shared_product_submissions(submitted_by,barcode,product_name,food,consent_to_share,status,reviewed_by,reviewed_at)
select pg_temp.uid(70),lpad(n::text,14,'0'),'Established contributor fixture','{}',true,'approved',pg_temp.uid(99),now()
from generate_series(7001,7003) n;
select ok(private.food_image_placement_contributor_eligible(pg_temp.uid(70)),'confirmed account aged 30 days with three reviewed products qualifies without manual trust');
update auth.users set created_at=now()-interval '29 days' where id=pg_temp.uid(70);
select ok(not private.food_image_placement_contributor_eligible(pg_temp.uid(70)),'approved history does not bypass the account-age floor');
update auth.users set created_at=now()-interval '31 days',email_confirmed_at=null where id=pg_temp.uid(70);
select ok(not private.food_image_placement_contributor_eligible(pg_temp.uid(70)),'unconfirmed address cannot count toward automatic approval');
update auth.users set email_confirmed_at=now(),banned_until=now()+interval '1 day' where id=pg_temp.uid(70);
select ok(not private.food_image_placement_contributor_eligible(pg_temp.uid(70)),'banned accounts do not count toward approval');
set local role authenticated;
select pg_temp.actor(70);
select throws_ok($$select pg_temp.place(1,'personal')$$,'42501','Authentication required','account ban also prevents personal writes through stale sessions');
select pg_temp.actor(99,'aal2','moderator');
select lives_ok($$select public.review_food_image_placement('lock',p_image_id=>pg_temp.image(1),p_revision=>1,p_enabled=>true)$$,'moderator can lock an automatically published placement');
select lives_ok($$select public.review_food_image_placement('undo',p_image_id=>pg_temp.image(1),p_revision=>2)$$,'a lock does not hide the preceding geometry from rollback');
select is((select crop_zoom from public.food_image_assets where id=pg_temp.image(1)),1::numeric,'rollback after locking restores the real previous crop');
reset role;
insert into auth.users(id,aud,role,email,email_confirmed_at)
select pg_temp.uid(n),'authenticated','authenticated','placement-'||n||'@blendcalc.local',now() from generate_series(1001,1200) n;
insert into public.food_image_placement_suggestions(image_id,user_id,base_revision,placement)
select pg_temp.image(30),pg_temp.uid(n),0,'{"cropX":80,"cropY":80,"cropZoom":2,"rotationDegrees":0,"fitMode":"custom","placementVersion":2,"placementMethod":"manual"}'::jsonb
from generate_series(1001,1200) n;
set local role authenticated;
select pg_temp.actor(71); select is(pg_temp.place(30),'limit_reached','per-image backlog is bounded at 200 votes');
select pg_temp.actor(64); select is(pg_temp.place(10),'pending','trusted contributor starts agreement');
select pg_temp.actor(65); select is(pg_temp.place(10),'pending','second trusted contributor agrees');
select pg_temp.actor(99,'aal2','moderator');
select lives_ok($$select public.review_food_image_placement('trust',p_user_id=>pg_temp.uid(64),p_enabled=>false)$$,'moderator can revoke contributor trust');
select pg_temp.actor(66); select is(pg_temp.place(10),'pending','revoked trust no longer counts toward the third vote');
select pg_temp.actor(99,'aal2','moderator');
select lives_ok($$select public.review_food_image_placement('trust',p_user_id=>pg_temp.uid(64),p_enabled=>true)$$,'moderator can restore contributor trust');
select pg_temp.actor(67); select is(pg_temp.place(10),'published','restored trust applies on the next bounded agreement check');
reset role;
set local role authenticated;
select pg_temp.actor(1);
select throws_ok($$select public.publish_food_image_placement(pg_temp.image(11),'https://example.com/placement-11.png',0,
  '{"cropX":60,"cropY":60,"cropZoom":1.5,"rotationDegrees":90,"fitMode":"custom"}')$$,'42501','Moderator verification required','ordinary account cannot bypass review through direct publishing');
select pg_temp.actor(99,'aal1','moderator');
select throws_ok($$select public.publish_food_image_placement(pg_temp.image(11),'https://example.com/placement-11.png',0,
  '{"cropX":60,"cropY":60,"cropZoom":1.5,"rotationDegrees":90,"fitMode":"custom"}')$$,'42501','Moderator verification required','direct publishing also requires AAL2');
select pg_temp.actor(99,'aal2','moderator');
select lives_ok($$select public.publish_food_image_placement(pg_temp.image(11),'https://example.com/placement-11.png',0,
  '{"cropX":60,"cropY":60,"cropZoom":1.5,"rotationDegrees":90,"fitMode":"custom","placementMethod":"smart-ocr","suggestionVersion":"test-label-v1","suggestionConfidence":88}')$$,'direct moderator publishing retains accepted OCR provenance');
select is((select placement_method from public.food_image_assets where id=pg_temp.image(11)),'smart-ocr','accepted placement method is preserved');
select is((select actor_id from public.food_image_placement_history where image_id=pg_temp.image(11) and revision=1),pg_temp.uid(99),'shared publication history retains the authenticated moderator');
select is((select approved_by from public.food_image_assets where id=pg_temp.image(11)),pg_temp.uid(99),'browser cannot forge the approving moderator');
select ok((public.get_privileged_tool_action_summary()->>'pendingImagePlacementReviews')::integer>0,'existing role-aware summary includes pending images in the same snapshot');
select throws_ok($$select public.publish_food_image_placement(pg_temp.image(11),'https://example.com/placement-11.png',0,
  '{"cropX":60,"cropY":60,"cropZoom":1.5,"rotationDegrees":90,"fitMode":"custom"}')$$,'40001','Image changed; refresh before reviewing','stale direct publisher cannot overwrite newer shared placement');
reset role;
set local role authenticated;
select pg_temp.actor(24); select is(pg_temp.place(12,'suggest','{"cropX":58,"cropY":58,"cropZoom":1.1,"rotationDegrees":0,"fitMode":"custom"}'),'pending','bounded first adjustment starts agreement');
select pg_temp.actor(25); select is(pg_temp.place(12,'suggest','{"cropX":58,"cropY":58,"cropZoom":1.1,"rotationDegrees":0,"fitMode":"custom"}'),'pending','bounded first adjustment gets second vote');
select pg_temp.actor(26); select is(pg_temp.place(12,'suggest','{"cropX":58,"cropY":58,"cropZoom":1.1,"rotationDegrees":0,"fitMode":"custom"}'),'published','bounded first adjustment publishes');
select pg_temp.actor(27); select is(pg_temp.place(12,'suggest','{"cropX":66,"cropY":66,"cropZoom":1.2,"rotationDegrees":0,"fitMode":"custom"}',1),'pending','next proposed step is queued');
select pg_temp.actor(28); select is(pg_temp.place(12,'suggest','{"cropX":66,"cropY":66,"cropZoom":1.2,"rotationDegrees":0,"fitMode":"custom"}',1),'pending','second drift vote remains pending');
select pg_temp.actor(29); select is(pg_temp.place(12,'suggest','{"cropX":66,"cropY":66,"cropZoom":1.2,"rotationDegrees":0,"fitMode":"custom"}',1),'pending','small steps cannot accumulate beyond the original movement budget');
select is((select crop_zoom from public.food_image_assets where id=pg_temp.image(12)),1.1::numeric,'cumulative drift leaves current shared placement unchanged');
reset role;
insert into public.account_moderation(user_id,status) values(pg_temp.uid(99),'banned');
set local role authenticated;
select pg_temp.actor(99,'aal2','moderator');
select is((select count(*) from public.food_image_placement_contributors),0::bigint,'blocked moderator cannot read contributor controls using a stale token');
select is((select count(*) from public.food_image_placement_history),0::bigint,'blocked moderator cannot read private placement history');
select is((select count(*) from public.food_image_placement_policy),0::bigint,'blocked moderator cannot read private automation controls');
select throws_ok($$select public.get_food_image_placement_workspace()$$,'42501','Authentication required','blocked moderator cannot call the private workspace RPC');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok($$update public.food_image_assets set crop_x=60,crop_zoom=1.1,crop_source='moderator',approved_by=pg_temp.uid(98),approved_at=now() where id=pg_temp.image(35)$$,'deployed application service-role crop writes remain compatible with the expansion');
select is((select placement_revision from public.food_image_assets where id=pg_temp.image(35)),1::bigint,'legacy shared writes still advance the new revision');
select ok(exists(select 1 from public.food_image_placement_history where image_id=pg_temp.image(35) and actor_id is null),'legacy service writes do not invent an authenticated audit actor');
reset role;
select * from finish();
rollback;
