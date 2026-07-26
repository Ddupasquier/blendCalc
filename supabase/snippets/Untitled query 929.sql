update public.nutrient_relationship_rules set enabled = false where enabled = true;
select count(*) from public.nutrient_relationship_rules where enabled = true;