-- Split the editor role into photo_editor and video_editor (either can fill
-- the event's editor slot) and add graphics. Existing editors get both.

update staff
set roles = array(select distinct r from unnest(array_remove(roles, 'editor') || array['photo_editor', 'video_editor']) as r)
where 'editor' = any (roles);

alter table staff drop constraint staff_roles_check;
alter table staff add constraint staff_roles_check
  check (roles <@ array['head', 'photographer', 'videographer', 'photo_editor', 'video_editor',
                        'graphics', 'writer', 'proofreader', 'page_admin']::text[]);
