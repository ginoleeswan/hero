-- Derived kinship attachments for the family tree: each relative can point at the
-- family member it hangs from (one step closer to the hero), plus a branch-side hint.
-- Computed by the backfill-family function; null = attaches to the hero spine.
alter table hero_relatives
  add column tree_parent_id uuid references hero_relatives(id) on delete set null,
  add column branch_side text;
create index hero_relatives_tree_parent_id_idx on hero_relatives (tree_parent_id);
