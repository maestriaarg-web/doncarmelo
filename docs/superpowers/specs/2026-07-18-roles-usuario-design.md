# Roles de usuario

**Fecha:** 2026-07-18
**Sub-proyecto:** 2 de 4 de Fase 2 (orden: conciliación, roles, WhatsApp, zonas de reparto)
**Sub-proyecto anterior:** [Conciliación de pedidos](2026-07-18-conciliacion-pedidos-design.md) (completo, en producción).

## Contexto

Hoy el panel admin tiene un único usuario de Supabase Auth (creado con `scripts/create-admin-user.mjs`), sin ningún concepto de roles ni permisos diferenciados. Las políticas RLS de las tablas admin (`admin_full_access` en `puntos_venta`, `productos`, `pedidos`, `pedido_items`, `excepciones_corte`) dan acceso total a **cualquier** usuario autenticado, sin distinción.

Don Carmelo quiere sumar empleados que puedan operar `/admin/pedidos` (ver pedidos, marcar preparado/entregado/cancelado, imprimir remitos) sin tener acceso a productos, puntos de venta, precios, ni excepciones de corte.

## Alcance

**Incluye:**
- Dos roles: `admin` (acceso total, como hoy) y `empleado` (solo `/admin/pedidos` y sus rutas de remito).
- El rol se guarda en `app_metadata` de Supabase Auth (no `user_metadata`) — es el único campo del usuario que no puede editarse desde el cliente, solo con la service-role key. Ausencia de `rol` se interpreta como `admin` (compatibilidad con el usuario existente, sin migración de datos).
- Enforcement **solo a nivel interfaz** (decisión explícita, confirmada con el usuario): `proxy.ts` redirige a un empleado que pida una ruta fuera de lo permitido, y el nav oculta los links restringidos. No se tocan las políticas RLS existentes — queda documentado como deuda conocida, no como bug.
- Pantalla nueva `/admin/usuarios` (solo accesible para `admin`): listar usuarios, crear usuario nuevo (email + contraseña inicial + rol), cambiar el rol de un usuario existente, resetear contraseña, eliminar usuario.
- Protección anti-bloqueo: un usuario no puede cambiar su propio rol a `empleado` ni eliminarse a sí mismo desde esta pantalla.

**Fuera de alcance:**
- Enforcement a nivel de base de datos (políticas RLS por rol) — explícitamente diferido, la interfaz es la única barrera por ahora.
- Roles adicionales más allá de `admin`/`empleado` (ej. "solo lectura", permisos granulares por pantalla).
- Autoservicio de cambio de contraseña por parte del propio usuario — solo el admin puede resetear contraseñas ajenas desde `/admin/usuarios`.
- Invitación por email / flujo de "aceptar invitación" — el admin define la contraseña inicial directamente, sin envío de correo (no hay infraestructura de email en este proyecto todavía, Resend queda para Fase 1 original sin usar).
- Cualquier otro ítem de Fase 2 (WhatsApp, zonas de reparto).

## Cómo se lee y aplica el rol

Nuevo helper en `src/lib/admin/auth.ts`:

```ts
export async function obtenerRolActual(): Promise<'admin' | 'empleado'>
```

Lee la sesión actual (vía el cliente RLS-scoped ya usado en el resto del admin) y devuelve `user.app_metadata.rol as 'admin' | 'empleado'` si existe, o `'admin'` si es `undefined` (compatibilidad con el usuario existente).

**Rutas permitidas para `empleado`:** `/admin/pedidos` (y su búsqueda por fecha), `/admin/remito/[id]`, `/admin/remitos`. Cualquier otra ruta bajo `/admin/*` (incluyendo `/admin/usuarios`) redirige a `/admin/pedidos`.

`proxy.ts` ya lee la sesión de Supabase Auth para el guard de autenticación existente — se suma la lectura de `app_metadata.rol` sobre esa misma sesión, sin queries adicionales.

## Pantalla `/admin/usuarios`

Mismo patrón visual que el resto del ABM admin (listado + formulario de alta/edición). Cada fila muestra email y rol actual. Acciones por usuario: cambiar rol (select admin/empleado), "Resetear contraseña" (pide una nueva contraseña y la aplica), "Eliminar" (con confirmación, ya que es una acción destructiva sobre una cuenta real).

Las Server Actions de esta pantalla (`crearUsuario`, `cambiarRolUsuario`, `resetearPassword`, `eliminarUsuario`) usan el **service-role client** (`@/lib/supabase/service`), no el RLS-scoped client que usa el resto del admin — es la única excepción a esa regla en todo el proyecto, porque `supabase.auth.admin.*` son operaciones privilegiadas que no pasan por RLS en absoluto (no son queries a una tabla). Antes de ejecutar `cambiarRolUsuario` o `eliminarUsuario`, cada acción compara el `userId` objetivo contra el id del usuario que hace la llamada (obtenido de la sesión actual) y devuelve error si coinciden — bloquea que alguien se saque a sí mismo el rol admin o se elimine a sí mismo.

## Testing

Sin suite automatizada (decisión ya confirmada para todo el proyecto). Verificación por `npm run build` + `npm run lint` + prueba manual: crear un usuario con rol `empleado`, loguearse con esas credenciales en una sesión distinta, confirmar que solo ve "Pedidos" en el nav y que cualquier URL admin fuera de eso redirige a `/admin/pedidos`. Confirmar que el intento de auto-degradarse el rol o auto-eliminarse desde `/admin/usuarios` da error. Confirmar que el usuario admin original (sin `app_metadata.rol`) sigue teniendo acceso completo sin ningún cambio manual.
