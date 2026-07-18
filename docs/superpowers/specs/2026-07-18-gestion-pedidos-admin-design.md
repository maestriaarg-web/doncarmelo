# Gestión de pedidos (admin)

**Fecha:** 2026-07-18
**Sub-proyecto:** 4 de 4 (cierra el alcance completo de Fase 1 del brief original)
**Sub-proyecto anterior:** [Historial, repetir pedido, frecuentes, countdown](2026-07-18-historial-repetir-frecuentes-countdown-design.md) (completo, en producción)
**Siguiente sub-proyecto:** ninguno — con esto se cierra Fase 1. Fase 2 (WhatsApp, roles, conciliación) queda en el backlog del brief original, no arranca automáticamente.

## Contexto

Los tres sub-proyectos anteriores dejaron funcionando: el ABM de productos y puntos de venta, y el flujo completo de pedido del lado del comercio (acceso, catálogo, carrito, corte automático, confirmación, historial, repetir pedido). Los pedidos ya se guardan correctamente en `pedidos`/`pedido_items` — pero Don Carmelo todavía no tiene ninguna pantalla para verlos, prepararlos, o imprimir nada. Este es el último sub-proyecto de Fase 1: le da al admin la capacidad de operar con los pedidos que ya está recibiendo.

No se modifica el modelo de datos — `pedidos`, `pedido_items`, `excepciones_corte` ya existen. Este sub-proyecto es prácticamente todo lectura/agregación sobre datos existentes, más el ABM de `excepciones_corte` (que hasta ahora era una tabla sin pantalla).

## Alcance

**Incluye:**
- Pantalla `/admin/pedidos`: pedidos del día, agrupados por turno (mañana/tarde), navegables por fecha.
- Lista de preparación consolidada por turno (suma de cantidades por producto).
- Remito imprimible por pedido individual, y por turno completo.
- Aviso visual de pedido fuera de horario (usa el campo `fuera_de_horario` ya existente).
- Alerta de pedido atípico (cantidad más del doble del promedio histórico de ese producto para ese comercio).
- ABM de excepciones de corte (`/admin/excepciones`).

**Fuera de alcance** (explícitamente Fase 2 del brief original, no se toca acá):
- Cambiar el estado de un pedido (preparado/entregado) — no hay gestión de estados más allá de `confirmado` en esta etapa.
- Conciliación pedido vs. preparado vs. entregado.
- Cualquier cosa de WhatsApp, roles, o agrupación por zona.

## 1. Pantalla de pedidos (`/admin/pedidos`)

- Nuevo link en el nav del admin, como primer ítem (antes de "Productos" — pasa a ser la pantalla de uso diario).
- Header: fecha seleccionada (default: hoy) con flechas ← → para navegar día anterior/siguiente. Sin límite de rango — Don Carmelo puede ir tan atrás o adelante como quiera.
- Para la fecha seleccionada, se traen todos los `pedidos` con `fecha_entrega` igual a esa fecha, con sus `pedido_items` (cantidad, producto, punto de venta).
- Se separan en dos secciones: **Turno mañana** y **Turno tarde** (según `turno_reparto`). Si un turno no tiene pedidos, se muestra un estado vacío simple ("Sin pedidos para este turno"), no se oculta la sección (Don Carmelo necesita saber que efectivamente no hay nada, no confundirlo con que la pantalla no cargó).
- Dentro de cada turno:
  - **Lista de preparación consolidada**: todos los `pedido_items` de ese turno agrupados por producto, sumando cantidades. Ej: "Bife de chorizo — 8 kg (3 pedidos)". Ordenada por categoría igual que el catálogo, para que sea fácil de seguir armando en el mostrador.
  - **Pedidos individuales**: uno por punto de venta, con su lista de items, tipo de etiqueta, y los badges de aviso (ver secciones 3 y 4). Cada uno con su botón de remito.

## 2. Remito imprimible

- Por cada pedido individual: botón "Imprimir remito" que muestra una vista simple (nombre y dirección del punto de venta, fecha, turno, tipo de etiqueta, lista de items con cantidades) con estilos de impresión (`@media print`) y dispara `window.print()` al cargar o al tocar un botón dedicado.
- Por turno: botón "Imprimir todos los remitos de este turno" que arma una vista con todos los remitos del turno uno tras otro (salto de página entre cada uno vía CSS) y dispara la impresión una sola vez.
- No hace falta una ruta separada por remito — se resuelve como una vista/modal dentro de la misma pantalla de pedidos, mostrada solo al pedir imprimir (para no complicar la navegación).

## 3. Aviso de pedido fuera de horario

- El campo `pedidos.fuera_de_horario` ya se calcula y graba correctamente al confirmar el pedido (sub-proyecto 2). Acá solo se consume: si es `true`, se muestra un badge visual (ej. "⚠ Fuera de horario") junto al pedido individual en la lista.

## 4. Alerta de pedido atípico

- Para cada item de cada pedido del día seleccionado: se busca el historial de `pedido_items` de ese mismo producto para ese mismo punto de venta (pedidos anteriores, sin contar el actual).
- Si hay al menos un pedido previo de ese producto: se calcula el promedio de cantidad pedida históricamente. Si la cantidad del pedido actual es **más del doble** de ese promedio, se marca ese item con un badge ("⚠ Cantidad atípica: 20 (promedio: 6)").
- Si no hay historial previo de ese producto para ese comercio, no se alerta (no hay base de comparación — evita falsos positivos en el primer pedido de un producto nuevo).
- La alerta es a nivel de **item**, no de pedido completo — un pedido puede tener un item marcado y el resto normal.

## 5. ABM de excepciones de corte (`/admin/excepciones`)

- Nuevo link en el nav.
- Mismo patrón visual que el ABM de productos/puntos de venta: listado + formulario de alta/edición.
- Campos: fecha (única, no puede haber dos excepciones para el mismo día), hora de corte, motivo (texto libre, opcional — ej. "Feriado 9 de julio").
- Sin baja lógica — se puede borrar directamente (son registros puntuales de una fecha específica, no hay razón de negocio para mantener excepciones vencidas visibles).

## Testing

Igual que los sub-proyectos anteriores: sin suite automatizada (decisión de spec ya confirmada). Verificación por `npm run build` + `npm run lint` + prueba manual contra Supabase real — usando pedidos reales ya confirmados durante el testing de los sub-proyectos anteriores, más al menos un pedido nuevo creado específicamente para probar la alerta de cantidad atípica (pedir una cantidad muy superior a lo habitual de un producto con historial).
