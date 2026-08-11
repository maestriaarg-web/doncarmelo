# Precio final al preparar — Design

## Contexto

Catalina (usuaria del comercio "Catalina Bar") probó el sistema y señaló que mostrar un precio en el momento de armar el pedido no sirve: la mayoría de los productos son pesables, así que cualquier precio en el catálogo es una estimación, no el monto real que termina pagando. Propuso que el monto final se cargue recién cuando el pedido está preparado (ya pesado y empaquetado), y que viaje en el aviso que recibe el comercio.

Esta es la primera de dos sub-proyectos derivados de esa conversación (el segundo es el rediseño de la pantalla de inicio del comercio, con spec propia).

## Alcance

- Un campo de monto único por pedido (no por línea de producto).
- Obligatorio: no se puede marcar "Preparado" sin cargar un monto mayor a $0.
- El campo se pre-completa con la suma de `precio_sugerido × cantidad` de los ítems del pedido cuando esos precios existen; si no, arranca vacío.
- El monto se muestra tanto en el mensaje de WhatsApp como en el historial de pedidos del comercio — el WhatsApp hoy no le llega a nadie (Twilio sigue en modo sandbox), así que el historial es la vía confiable mientras tanto.
- Formato de moneda: `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` en los 3 puntos nuevos (input, mensaje, historial) — el resto de la app sigue con su formato actual (`$${valor.toFixed(2)}`), no se toca.

Fuera de alcance: editar el monto después de cargado, precio por línea de producto, cualquier cambio a los otros 3 mensajes de WhatsApp (confirmado/entregado/cancelado).

## Modelo de datos

Nueva migración `supabase/migrations/0006_pedidos_monto_final.sql`:

```sql
alter table pedidos add column monto_final numeric null;
```

Nullable: `null` hasta que el pedido pasa a "preparado"; a partir de ahí siempre tiene un valor numérico positivo.

`src/lib/types.ts`: agregar `monto_final: number | null` al tipo `PedidoAdmin` (y a cualquier tipo de historial de comercio que represente la misma fila de `pedidos`).

`src/lib/admin/pedidos.ts` — `SELECT_PEDIDO_ADMIN` hoy no trae precios ni `monto_final`. Pasa de:

```
'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, fuera_de_horario, creado_en, puntos_venta(id, nombre, direccion, zona), pedido_items(id, cantidad, producto_id, productos(nombre, categoria, unidad))'
```

a (agrega `monto_final` al nivel del pedido, y `precio_sugerido` dentro de `productos(...)`):

```
'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, fuera_de_horario, creado_en, monto_final, puntos_venta(id, nombre, direccion, zona), pedido_items(id, cantidad, producto_id, productos(nombre, categoria, unidad, precio_sugerido))'
```

## Flujo en admin (`/admin/pedidos`)

`EstadoPedidoAcciones.tsx` recibe una prop nueva `montoSugerido: number | null`. `TurnoSection.tsx` (línea ~120, donde ya itera `pedido.pedido_items` para listarlos) calcula ese valor con el mismo patrón que ya usa el carrito del comercio en `CatalogoClient.tsx:102` (`item.productos.precio_sugerido != null` para cada item, sumar `precio_sugerido * cantidad`, o `null` si ningún item tiene precio cargado) y se lo pasa a `EstadoPedidoAcciones`. El botón "Marcar preparado" deja de llamar la acción directo: al hacer click, se reemplaza por un input numérico (pre-completado con `montoSugerido` si no es null) + un botón "Confirmar". Cancelar el input vuelve a mostrar el botón original.

Validación en el cliente: no habilita "Confirmar" si el valor es vacío o `<= 0`.

`src/app/admin/(dashboard)/pedidos/actions.ts` — `marcarPreparado` cambia de firma:

```ts
export async function marcarPreparado(pedidoId: string, montoFinal: number): Promise<ActionResult> {
  if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
    return { error: 'Ingresá un monto válido.' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'preparado', monto_final: montoFinal })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  await notificarEstadoPedido(pedidoId, 'preparado')
  return { success: true }
}
```

El componente que renderiza `EstadoPedidoAcciones` (dentro de `TurnoSection.tsx`) ya tiene acceso a los `pedido_items` con `precio_sugerido` — se le agrega el cálculo del `montoSugerido` ahí mismo, mismo patrón que ya existe en `CatalogoClient.tsx`.

## Mensaje de WhatsApp

`src/lib/whatsapp.ts`:

- `notificarEstadoPedido` agrega `monto_final` al `select` de `pedidos`.
- `MENSAJE_POR_ESTADO.preparado` cambia de firma para aceptar el monto:

```ts
preparado: (fecha, turno, montoFinal) =>
  `Tu pedido para el ${fecha} (turno ${turno}) ya está preparado. Total a pagar: ${formatearMonto(montoFinal)}.`,
```

Donde `formatearMonto` es una función chica nueva en el mismo archivo:

```ts
function formatearMonto(monto: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto)
}
```

Los otros 3 mensajes (`confirmado`, `entregado`, `cancelado`) mantienen su firma actual `(fecha, turno) => string` sin cambios — `MENSAJE_POR_ESTADO` pasa a tener firmas heterogéneas por estado, así que su tipo `Record<EstadoPedido, (fecha: string, turno: string) => string>` se ajusta a `Record<EstadoPedido, (fecha: string, turno: string, montoFinal: number | null) => string>`, y los 3 mensajes que no usan el monto simplemente lo ignoran en la firma (parámetro sin usar, TypeScript lo permite).

Si `monto_final` viniera `null` en el estado "preparado" (no debería pasar dado que ahora es obligatorio, pero por si una fila vieja quedó sin migrar), el mensaje debe seguir andando sin el monto: `formatearMonto` no se llama y el mensaje cae al texto genérico actual ("...ya está preparado.") sin el segmento de total.

## Historial del comercio (`/pedido/historial`)

`src/lib/comercio/pedidos.ts` — `SELECT_PEDIDO_CON_ITEMS` ya trae `precio_sugerido` (se usa para "repetir pedido"), pero no `monto_final`. Pasa de:

```
'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, creado_en, pedido_items(cantidad, producto_id, productos(nombre, unidad, precio_sugerido, activo, disponible))'
```

a (agrega `monto_final` al nivel del pedido):

```
'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, creado_en, monto_final, pedido_items(cantidad, producto_id, productos(nombre, unidad, precio_sugerido, activo, disponible))'
```

`PedidoConItems` en `src/lib/types.ts` agrega `monto_final: number | null`.

`src/app/pedido/historial/page.tsx` — dentro de la tarjeta de cada pedido, si `pedido.estado` es `'preparado'` o `'entregado'` y `pedido.monto_final != null`, se agrega una línea:

```tsx
{(pedido.estado === 'preparado' || pedido.estado === 'entregado') && pedido.monto_final != null && (
  <p className="mt-1 text-sm font-medium text-foreground">
    Total a pagar: {formatearMonto(pedido.monto_final)}
  </p>
)}
```

`formatearMonto` se define localmente en este archivo (mismo cuerpo que en `whatsapp.ts` — son dos superficies distintas, cliente vs servidor de WhatsApp, no vale la pena una utilidad compartida para 3 líneas de código, YAGNI).

## Testing

- Server Action `marcarPreparado`: rechaza `montoFinal` 0, negativo, `NaN`; acepta positivo y persiste `estado` + `monto_final` en un solo `update`.
- `notificarEstadoPedido('preparado', ...)`: arma el mensaje con el monto formateado cuando `monto_final` no es null; no rompe si viniera null.
- Smoke test end-to-end (post-implementación): marcar preparado un pedido de prueba con y sin `precio_sugerido` cargado en sus productos, confirmar que el input se pre-completa o no según corresponda, y que el historial del comercio de prueba muestra el monto.
