# Setup del proyecto + ABM admin (productos y puntos de venta)

**Fecha:** 2026-07-17
**Sub-proyecto:** 1 de N (ver roadmap completo en el brief de proyecto — Fase 1: app cliente, panel admin)
**Siguiente sub-proyecto:** App cliente — catálogo + carrito + corte automático

## Contexto

Almacén Don Carmelo (Rafaela, Santa Fe) vende carne orgánica de pastizales al por mayor a comercios que le revenden. Hoy reciben pedidos por un Google Form de 5 páginas sin login ni historial, y arman la preparación a mano juntando formularios. Este proyecto reemplaza ese flujo con un sistema propio B2B.

Este sub-proyecto es la base de todo lo demás: deja el repo scaffoldeado, conectado a Supabase/Vercel, con el modelo de datos completo de Fase 1 creado en Postgres, y un panel admin funcional para cargar productos y puntos de venta (los datos de prueba que van a hacer falta para construir la app cliente en el siguiente sub-proyecto).

No incluye: pantalla de pedidos, lista de preparación, remitos, alertas de horario/atípicos, ni la app cliente. Eso son sub-proyectos posteriores.

## Stack y arquitectura

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS**, deploy automático en Vercel (team `tatitosrafaela`).
- **Supabase**: proyecto nuevo dedicado en la org "Rolebyte's Org" (Postgres + Auth + Storage). Storage para fotos de productos (bucket público `productos`).
- **Resend**: se deja la dependencia instalada y la env var reservada, pero no se usa todavía (entra en el sub-proyecto de pedidos, Fase 1 tardía).
- **Repo**: GitHub, org/usuario Rolebyte. No existía al momento de este diseño — se crea al finalizar el scaffold inicial, con confirmación del usuario antes del primer push.

### Autenticación — dos mecanismos distintos, sin mezclar

1. **Admin (Don Carmelo)**: Supabase Auth, email/password. Un solo usuario creado a mano en el dashboard de Supabase (no hay self-signup ni recuperación de contraseña automatizada en esta etapa). Rutas bajo `/admin` protegidas por middleware que exige sesión válida.
2. **Comercios (app cliente, se construye en el próximo sub-proyecto pero el mecanismo se define acá porque toca `puntos_venta`)**: sin Supabase Auth. El comercio ingresa su `codigo_acceso`, un Route Handler lo valida server-side contra `puntos_venta.codigo_acceso`, y si es válido setea una **cookie httpOnly persistente** (no localStorage) en el dispositivo. Las queries del comercio siempre pasan por el servidor (Server Actions / Route Handlers) usando la service role key — nunca se expone la base directamente al browser del comercio. Decisión confirmada explícitamente con el usuario (se evaluó localStorage puro y se descartó por seguridad).

## Modelo de datos (Postgres, completo para toda la Fase 1)

Se crean **todas** las tablas de Fase 1 en este sub-proyecto (aunque el ABM de esta etapa solo cubre `productos` y `puntos_venta`), para no tener que migrar el schema a mitad del desarrollo de la app cliente.

```sql
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
  precio_sugerido numeric,        -- nullable: no todos los productos lo tienen cargado todavía
  congelado boolean default false,
  disponible boolean default true, -- controla tachado/agotado en catálogo cliente
  foto_url text,
  activo boolean default true,     -- baja lógica, nunca hard delete
  creado_en timestamptz default now()
);

-- Pedidos
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  punto_venta_id uuid not null references puntos_venta(id),
  fecha_entrega date not null,
  turno_reparto text not null check (turno_reparto in ('manana','tarde')), -- calculado en servidor, nunca elegido por el usuario
  tipo_etiqueta text not null check (tipo_etiqueta in ('grande','chica','ambas')),
  estado text not null default 'confirmado' check (estado in ('confirmado','cancelado')),
  fuera_de_horario boolean default false, -- true si se cargó pasado el corte de su franja
  creado_en timestamptz default now()
);

create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad numeric not null check (cantidad > 0)
);

-- Excepciones al corte de las 9am (feriados, eventos puntuales) — editable desde el admin, sin tocar código
create table excepciones_corte (
  id uuid primary key default gen_random_uuid(),
  fecha date unique not null,
  hora_corte time not null,
  motivo text,
  creado_en timestamptz default now()
);
```

Notas:
- `turno_reparto` y `fuera_de_horario` se calculan server-side al confirmar un pedido, comparando la hora actual contra el corte (9am por defecto, o el valor de `excepciones_corte` para esa `fecha_entrega` si existe). No se implementa la lógica de escritura de pedidos en este sub-proyecto, pero el schema queda listo.
- El admin usa `auth.users` de Supabase Auth — no hace falta tabla propia en Fase 1 (Fase 2 sí va a necesitar roles, se evalúa en su momento).
- RLS: en esta etapa, política simple `auth.role() = 'authenticated'` para lectura/escritura completa desde el admin. Se endurece cuando haya más de un usuario admin (Fase 2, backlog: roles preparación/facturación/dueño).

## Alcance del ABM (este sub-proyecto)

**Login admin**
- Pantalla email/password vía Supabase Auth. Redirige a `/admin` si la sesión es válida; si no, a login.

**ABM Productos** (`/admin/productos`)
- Listado agrupado por categoría, con foto miniatura, filtros por categoría/congelado/disponible.
- Alta y edición: nombre, categoría, unidad, precio sugerido, congelado (switch), disponible (switch), foto (upload a Supabase Storage), activo.
- Baja lógica únicamente (`activo = false`).

**ABM Puntos de venta** (`/admin/puntos-venta`)
- Listado con estado activo/inactivo.
- Alta y edición: nombre, dirección, contacto, código de acceso (único, editable), etiqueta default, pedido mínimo, activo.

**Explícitamente fuera de alcance de este sub-proyecto**: pantalla de pedidos del día, lista de preparación consolidada, remitos imprimibles, aviso de pedido fuera de horario, alerta de pedido atípico, y toda la app cliente (catálogo, carrito, corte visual, repetir pedido, historial). Esos son los próximos sub-proyectos, en el orden que definió el usuario en el brief original.

## Pendientes que no bloquean este sub-proyecto

- Catálogo completo de productos con precios reales: se carga con datos de prueba/placeholder mientras se define con el cliente.
- Cuenta corriente / saldo por punto de venta: no forma parte del modelo de datos de Fase 1; si se confirma que hace falta, se agrega como tabla nueva sin romper lo existente.
- Zona/radio de reparto: no afecta la lógica de turnos (que es puramente horaria), así que no bloquea ningún diseño de esta etapa.

## Testing

- Validación manual del ABM (crear/editar/dar de baja productos y puntos de venta) contra el Supabase real del proyecto.
- Se corre `npm run build` y `npm run lint` antes de cada commit relevante.
- No se arma suite automatizada en este sub-proyecto (alcance chico, CRUD directo); se evalúa agregar tests cuando entre la lógica de corte automático (más crítica y con más ramas).
