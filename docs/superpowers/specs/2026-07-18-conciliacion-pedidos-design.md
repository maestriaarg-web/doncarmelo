# Conciliación de pedidos

**Fecha:** 2026-07-18
**Sub-proyecto:** 1 de 4 de Fase 2 (backlog original: conciliación, roles, WhatsApp, zonas de reparto — se abordan en ese orden)
**Sub-proyecto anterior:** [Pase de diseño UI/UX](2026-07-18-ui-ux-design.md) (completo, en producción). Antes de eso, [Gestión de pedidos (admin)](2026-07-18-gestion-pedidos-admin-design.md) cerró Fase 1 completa.

## Contexto

Hoy la tabla `pedidos` tiene una columna `estado` (`text not null default 'confirmado' check (estado in ('confirmado','cancelado'))`), pero en la práctica nunca cambia de `'confirmado'` — no existe ninguna pantalla ni acción que la modifique. `/admin/pedidos` muestra pedidos del día agrupados por turno con una lista de preparación consolidada, pero no hay forma de marcar que un pedido ya se armó o ya se entregó, ni de cancelarlo si el comercio llama para bajarlo.

Este sub-proyecto agrega ese seguimiento: confirmado → preparado → entregado, más cancelado como salida alternativa en cualquier punto del flujo.

## Alcance

**Incluye:**
- Migración: sumar `'preparado'` y `'entregado'` al check constraint de `pedidos.estado`.
- Botones secuenciales por pedido en `/admin/pedidos`: "Marcar preparado" → "Marcar entregado", más un link "Cancelar" (con confirmación del navegador) siempre disponible mientras el pedido no esté ya entregado o cancelado.
- Badge visual de estado en cada pedido de la lista del admin.
- Tres Server Actions puntuales: `marcarPreparado`, `marcarEntregado`, `cancelarPedido`.
- Los pedidos cancelados se **excluyen** de la lista de preparación consolidada (`consolidarPreparacion`) y del cálculo de promedio histórico para la alerta de cantidad atípica (`calcularCantidadesAtipicas`/`obtenerPromedioHistorico`) — pero siguen apareciendo en la lista de pedidos del día con su badge, para que quede registro visual.
- Labels amigables del estado en `/pedido/historial` (lado comercio), reemplazando el string crudo de la base.

**Fuera de alcance:**
- Validación de máquina de estados del lado del servidor (ej. impedir pasar de confirmado a entregado sin pasar por preparado) — es una herramienta interna de un solo usuario admin, la UI ya guía el orden correcto con los botones secuenciales.
- Notificar al comercio cuando cambia el estado (eso es la integración de WhatsApp, sub-proyecto separado de Fase 2).
- Reabrir/deshacer una cancelación — si se cancela por error, se resuelve manualmente contactando al comercio y creando un pedido nuevo si hace falta.
- Cualquier otro ítem de Fase 2 (roles, WhatsApp, zonas de reparto).

## Migración de base de datos

```sql
alter table pedidos drop constraint pedidos_estado_check;
alter table pedidos add constraint pedidos_estado_check
  check (estado in ('confirmado', 'preparado', 'entregado', 'cancelado'));
```

(El nombre exacto de la constraint se confirma leyendo `supabase/migrations/0001_init.sql` al momento de escribir el plan — Postgres nombra las check constraints automáticamente como `<tabla>_<columna>_check` salvo que se haya nombrado explícitamente, así que este es el nombre esperado pero se verifica antes de escribir el código final del plan.)

## Interacción en `/admin/pedidos`

Por cada pedido en la lista (dentro de `TurnoSection`):
- Si `estado === 'confirmado'`: botón "Marcar preparado".
- Si `estado === 'preparado'`: botón "Marcar entregado".
- Si `estado === 'entregado'` o `'cancelado'`: sin botón de avance, solo el badge.
- Mientras `estado` no sea `'entregado'` ni `'cancelado'`: link "Cancelar" (rojo, con `confirm()` antes de ejecutar — a diferencia de "Baja"/"Borrar" en otras pantallas del admin, cancelar un pedido real de un comercio amerita ese paso extra).

Badge por estado (mismo patrón visual que los badges de fuera-de-horario/atípico ya existentes, con colores distintos):
- `confirmado`: sin badge (es el estado por defecto, no necesita resaltarse).
- `preparado`: badge gris/neutro "Preparado".
- `entregado`: badge verde "✓ Entregado".
- `cancelado`: badge rojo tachado "Cancelado".

## Efecto en cálculos existentes

- `consolidarPreparacion` (lista de preparación consolidada): recibe la lista de pedidos ya filtrada por turno — se le agrega un filtro previo excluyendo `estado === 'cancelado'` antes de sumar cantidades.
- `obtenerPromedioHistorico` (base del cálculo de cantidad atípica): la query a `pedido_items`/`pedidos` suma un `.neq('pedidos.estado', 'cancelado')` (o equivalente) para no contar pedidos cancelados como historial real de consumo.
- `obtenerPedidosDelDia` en sí no cambia — sigue trayendo todos los pedidos del día sin importar estado, para que la lista completa (con badges) siga siendo la fuente de verdad visual.

## Lado comercio (`/pedido/historial`)

Se agrega un mapa de labels (mismo patrón que `ETIQUETA_LABEL` ya usado en varias pantallas):

```ts
const ESTADO_LABEL: Record<string, string> = {
  confirmado: 'Confirmado',
  preparado: 'En preparación',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}
```

## Testing

Sin suite automatizada (decisión ya confirmada para todo el proyecto). Verificación por `npm run build` + `npm run lint` + prueba manual contra Supabase real: aplicar la migración, marcar un pedido real como preparado y después entregado verificando que el badge y los botones cambian correctamente, cancelar otro pedido y confirmar que desaparece de la lista de preparación consolidada sin desaparecer de la lista general, y confirmar que un producto con historial que incluye un pedido cancelado no cuenta ese pedido cancelado en su promedio para la alerta de cantidad atípica.
