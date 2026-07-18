# Historial, repetir último pedido, productos frecuentes y countdown visual

**Fecha:** 2026-07-18
**Sub-proyecto:** 3 de N (ver roadmap en el brief de proyecto — Fase 1: app cliente, panel admin)
**Sub-proyecto anterior:** [App cliente — catálogo, carrito, corte automático](2026-07-17-app-cliente-catalogo-carrito-design.md) (completo, en producción)
**Siguiente sub-proyecto:** por definir — con esto se cierra el resto del alcance de Fase 1 del brief original

## Contexto

Los dos sub-proyectos anteriores dejaron el flujo de pedido funcionando de punta a punta: acceso por celular, catálogo, carrito, cálculo automático del corte, confirmación. Este sub-proyecto agrega las cuatro cosas que se dejaron explícitamente para después (definido junto con el usuario al arrancar el sub-proyecto 2): historial de pedidos, "repetir último pedido", productos frecuentes, y el countdown visual del corte (hasta ahora solo texto plano).

Las cuatro dependen de tener pedidos reales guardados (`pedidos`/`pedido_items`), que ya existen gracias al sub-proyecto anterior — no hace falta modelo de datos nuevo.

## Alcance

**Incluye:**
- Pantalla de historial de pedidos propios (`/pedido/historial`).
- Botón "Repetir último pedido" en el catálogo, condicional a tener historial.
- Sección "Mis productos frecuentes" arriba del catálogo, condicional a tener historial.
- Countdown visual (barra de progreso con 3 franjas de color) reemplazando el texto plano en `/pedido/confirmar`.

**Fuera de alcance:** cualquier otra cosa del brief original no mencionada acá ya está construida en los sub-proyectos 1 y 2.

## 1. Historial de pedidos (`/pedido/historial`)

- Nuevo link en el catálogo que lleva a esta pantalla.
- Lista los pedidos del punto de venta (vía cookie de sesión, mismo mecanismo que el resto de la app cliente), ordenados por `creado_en` descendente (más reciente primero).
- Por pedido se muestra: fecha de entrega, turno (mañana/tarde), estado, y un resumen de items (cantidad de productos distintos + primeros 2-3 nombres, ej. "3 productos: Bife de chorizo, Hamburguesas x4 y 1 más").
- Sin paginación en esta etapa — el volumen esperado de una carnicería chica no la justifica. Se agrega más adelante si hace falta.
- Consulta server-side con el service client (`createServiceClient`), igual patrón que el resto de la app cliente — nunca expone la base directo al browser del comercio.

## 2. Repetir último pedido

- Botón grande, arriba del todo en `/pedido` (el catálogo), **visible solo si el punto de venta tiene al menos un pedido previo** — se oculta por completo para comercios nuevos sin historial (evita un botón roto/confuso el primer día).
- Al tocarlo: el servidor busca el pedido más reciente del punto de venta con sus `pedido_items`, arma un carrito con esos productos y cantidades, y lo guarda en `sessionStorage` (mismo mecanismo que ya usa el carrito) antes de redirigir a `/pedido/confirmar`.
- **Nunca confirma directo** — el comercio siempre pasa por la pantalla de confirmar como con cualquier pedido, puede ajustar cantidades, sacar productos, cambiar la fecha, etc.
- Si algún producto del pedido repetido ya no existe, está dado de baja, o quedó no disponible: se omite del carrito precargado (no rompe el flujo) y se muestra un aviso breve en la pantalla de confirmar, ej. "2 productos de tu último pedido ya no están disponibles y no se agregaron."
- Si el pedido repetido queda completamente vacío (todos sus productos dejaron de existir): se muestra un mensaje claro ("Los productos de tu último pedido ya no están disponibles") en vez de mandar a un carrito vacío sin explicación.

## 3. Productos frecuentes

- Sección nueva arriba del catálogo (`/pedido`), antes del buscador.
- Muestra los **5 productos que aparecieron en más pedidos distintos** del punto de venta (se cuenta en cuántos pedidos apareció cada producto, no la cantidad total pedida — un producto pedido en gran volumen una sola vez no cuenta como "frecuente").
- Cada uno con foto chica, nombre, y un botón rápido que agrega 1 unidad al carrito sin tener que buscarlo en el catálogo de abajo.
- **Se oculta completamente** si el punto de venta no tiene historial todavía (nada que mostrar, no tiene sentido un placeholder vacío).
- Solo cuenta productos que siguen `activo` y `disponible` hoy (no tiene sentido sugerir algo que ya no se puede pedir).
- Consulta: agrupar `pedido_items` por `producto_id` a través de los `pedidos` del punto de venta, contando pedidos distintos (no filas de `pedido_items` — si el mismo producto aparece una sola vez por pedido, coincide, pero se calcula explícitamente por si esto cambia).

## 4. Countdown visual (barra de progreso)

- Reemplaza el texto plano actual en `/pedido/confirmar` ("Este pedido entra en el reparto de la MAÑANA/TARDE") por una barra de progreso horizontal con 3 franjas de color fijas a lo largo del día:
  - Verde: 00:00 hasta la hora de corte (09:00 por defecto, o la excepción del día si existe) — "todavía llegás a la mañana".
  - Ámbar: desde el corte hasta las 20:00 — "vas al reparto de la tarde".
  - Rojo: después de las 20:00 — "ya cerramos por hoy".
- Un marcador vertical sobre la barra indica la hora actual dentro de esas franjas.
- Debajo de la barra, el mismo mensaje de estado que ya existe hoy (texto), ahora acompañando al visual en vez de ser el único indicador.
- Es puramente visual — no cambia la lógica de `calcularTurno` en absoluto, solo consume el mismo resultado que ya se calcula (incluida la hora de corte real, contemplando excepciones) para dibujar la barra correctamente.
- Cuando `eleccionFecha === 'manana'`, la barra no aplica (elegir "mañana" siempre da turno mañana, sin importar la hora actual — no hay nada que visualizar contra el reloj). En ese caso se muestra un estado simple, sin barra: un cartel verde fijo con el mismo mensaje de siempre ("Este pedido entra en el reparto de la MAÑANA"), sin marcador de hora ni franjas.

## Testing

Igual que los sub-proyectos anteriores: sin suite automatizada (decisión de spec ya confirmada). Verificación por `npm run build` + `npm run lint` + prueba manual contra Supabase real, con un punto de venta de prueba que ya tenga al menos un pedido confirmado (para poder probar historial, repetir, y productos frecuentes con datos reales) y otro sin pedidos (para confirmar que esas secciones se ocultan correctamente).
