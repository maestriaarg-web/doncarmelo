-- supabase/migrations/0007_configuracion_home_comercio.sql
-- Home del comercio: link a la lista de precios actualizada (PDF/Excel en
-- Storage) y al video de embalaje (YouTube). Ambas nullable — el comercio no
-- ve nada de esto hasta que el admin cargue algo. Corré esto en Supabase SQL
-- Editor.

alter table configuracion add column lista_precios_url text;
alter table configuracion add column video_embalaje_url text;

-- Storage: bucket público para la lista de precios, mismo patrón de
-- políticas que el bucket "productos" (0001_init.sql).
insert into storage.buckets (id, name, public)
values ('listas-precios', 'listas-precios', true)
on conflict (id) do nothing;

create policy "listas_precios_public_read" on storage.objects for select
  using (bucket_id = 'listas-precios');
create policy "listas_precios_admin_write" on storage.objects for insert
  with check (bucket_id = 'listas-precios' and auth.role() = 'authenticated');
create policy "listas_precios_admin_update" on storage.objects for update
  using (bucket_id = 'listas-precios' and auth.role() = 'authenticated');
