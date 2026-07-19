-- supabase/migrations/0005_configuracion.sql
-- Tabla de una sola fila para configuración general del sistema. Hoy solo
-- guarda el email de destino del backup semanal; al ser un singleton, una
-- futura configuración nueva se suma como otra columna nullable en vez de
-- necesitar una tabla nueva.
-- Corré esto en Supabase SQL Editor.

create table configuracion (
  id integer primary key default 1,
  backup_email text,
  constraint configuracion_singleton check (id = 1)
);

insert into configuracion (id, backup_email) values (1, null)
on conflict (id) do nothing;

alter table configuracion enable row level security;

create policy "admin_full_access" on configuracion for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
