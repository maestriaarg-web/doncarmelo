# Zonas de reparto

**Fecha:** 2026-07-19
**Sub-proyecto:** 4 de 4 de Fase 2 (el último — orden: conciliación, roles, WhatsApp, zonas de reparto)
**Sub-proyecto anterior:** [Integración WhatsApp](2026-07-18-whatsapp-design.md) (completo, en producción, verificado con entrega real).

## Contexto

Hoy `/admin/pedidos` agrupa los pedidos del día por turno (mañana/tarde) y muestra una lista de preparación consolidada por categoría de producto, pero dentro de un turno los pedidos individuales aparecen en el orden en que se crearon — sin ninguna noción de dónde queda cada comercio. El objetivo es sumar una "zona" de reparto como etiqueta libre por punto de venta, para que Don Carmelo pueda organizar el recorrido de entrega dentro de cada turno.

## Alcance

**Incluye:**
- Migración: columna `zona text` (nullable) en `puntos_venta`.
- `/admin/puntos-venta`: campo de zona en el formulario de alta/edición (texto libre con autocompletado de zonas ya usadas, mismo patrón que categoría en productos), zona visible en el listado, y un filtro por zona (mismo patrón que el filtro de categoría en productos). Sin zona cargada se muestra como "Sin zona".
- `/admin/pedidos`: dentro de cada turno, los pedidos individuales se agrupan por zona (agrupamiento nuevo, distinto e independiente de la lista de preparación consolidada existente, que sigue agrupada por categoría de producto).
- Remito imprimible: suma una línea con la zona del comercio, si tiene una cargada.

**Fuera de alcance:**
- Geolocalización, mapas, o cálculo de rutas — es una etiqueta de texto libre para agrupar, nada más.
- Cualquier cambio en la app cliente — los comercios no ven ni eligen zona, es organización interna del admin.
- Migrar/asignar zona a los comercios existentes automáticamente — quedan sin zona hasta que el admin los edite manualmente.
- Cualquier otro ítem fuera de Fase 2.

## Cómo se implementa

- `PuntoVenta.zona: string | null` — mismo patrón que `PuntoVenta.direccion`/`contacto` (campos de texto libre opcionales).
- `PedidoAdmin.puntos_venta.zona: string | null` — se suma al select embebido que ya trae `nombre`/`direccion` en `lib/admin/pedidos.ts`.
- Nueva función pura `agruparPedidosPorZona(pedidos: PedidoAdmin[]): [string, PedidoAdmin[]][]`, mismo patrón que `agruparPorCategoria` ya usado en `TurnoSection` para la lista de preparación — ordena zonas alfabéticamente, con los pedidos sin zona (`null`) agrupados al final bajo "Sin zona".
- `TurnoSection` reemplaza el `<ul>` plano de pedidos individuales por un agrupamiento por zona (con un encabezado de zona entre grupos), manteniendo intacta la lista de preparación consolidada existente arriba.
- `PuntoVentaForm` suma el campo de zona con un `<datalist>` de las zonas ya usadas (recibidas como prop, igual que `categoriasExistentes` en `ProductoForm`).
- `PuntosVentaClient` suma pills de filtro por zona (igual que el filtro de categoría en `ProductosClient`), calculando la lista de zonas existentes a partir de los puntos de venta cargados.

## Testing

Sin suite automatizada (decisión ya confirmada para todo el proyecto). Verificación por `npm run build` + `npm run lint` + prueba manual: cargar zona en 2-3 puntos de venta de prueba (algunos con la misma zona, alguno sin zona), confirmar que el filtro en `/admin/puntos-venta` funciona, crear pedidos para esos comercios y confirmar que `/admin/pedidos` los agrupa correctamente por zona dentro del turno, y que el remito de cada uno muestra la zona correspondiente (o no muestra la línea si no tiene zona cargada).
