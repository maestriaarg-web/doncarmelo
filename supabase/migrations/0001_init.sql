-- Don Carmelo B2B — schema inicial (Fase 1 completa)
-- Corre esto una sola vez en Supabase SQL Editor.

create extension if not exists "pgcrypto";

-- Puntos de venta (comercios)
create table puntos_venta (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  contacto text,
  codigo_acceso text unique not null,
  etiqueta_default text not null default 'ambas'
    check (etiqueta_default in ('grande','chica','ambas')),
  pedido_minimo numeric,
  activo boolean default true,
  creado_en timestamptz default now()
);

-- Catálogo de productos
create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null,
  unidad text not null,
  precio_sugerido numeric,
  congelado boolean default false,
  disponible boolean default true,
  foto_url text,
  activo boolean default true,
  creado_en timestamptz default now()
);

-- Pedidos
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  punto_venta_id uuid not null references puntos_venta(id),
  fecha_entrega date not null,
  turno_reparto text not null check (turno_reparto in ('manana','tarde')),
  tipo_etiqueta text not null check (tipo_etiqueta in ('grande','chica','ambas')),
  estado text not null default 'confirmado' check (estado in ('confirmado','cancelado')),
  fuera_de_horario boolean default false,
  creado_en timestamptz default now()
);

create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad numeric not null check (cantidad > 0)
);

-- Excepciones al corte de las 9am (feriados, eventos puntuales)
create table excepciones_corte (
  id uuid primary key default gen_random_uuid(),
  fecha date unique not null,
  hora_corte time not null,
  motivo text,
  creado_en timestamptz default now()
);

-- RLS: por ahora, cualquier usuario autenticado (el admin) puede leer/escribir todo.
-- Se endurece en Fase 2 cuando haya más de un rol de admin.
alter table puntos_venta enable row level security;
alter table productos enable row level security;
alter table pedidos enable row level security;
alter table pedido_items enable row level security;
alter table excepciones_corte enable row level security;

create policy "admin_full_access" on puntos_venta for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin_full_access" on productos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin_full_access" on pedidos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin_full_access" on pedido_items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin_full_access" on excepciones_corte for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Storage: bucket público para fotos de productos
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

create policy "productos_photos_public_read" on storage.objects for select
  using (bucket_id = 'productos');
create policy "productos_photos_admin_write" on storage.objects for insert
  with check (bucket_id = 'productos' and auth.role() = 'authenticated');
create policy "productos_photos_admin_update" on storage.objects for update
  using (bucket_id = 'productos' and auth.role() = 'authenticated');
