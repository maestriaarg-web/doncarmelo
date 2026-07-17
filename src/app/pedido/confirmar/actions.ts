'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { calcularTurno, obtenerFechaHoyYManana } from '@/lib/comercio/corte'

export type ConfirmarPedidoInput = {
  items: { productoId: string; cantidad: number }[]
  eleccionFecha: 'hoy' | 'manana'
  tipoEtiqueta: 'grande' | 'chica' | 'ambas'
}

export type ConfirmarPedidoResultado =
  | { error: string }
  | { success: true; fechaEntrega: string; turno: 'manana' | 'tarde' }

export async function confirmarPedido(
  input: ConfirmarPedidoInput
): Promise<ConfirmarPedidoResultado> {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) return { error: 'Sesión inválida, volvé a ingresar tu celular.' }

  if (input.items.length === 0) return { error: 'El carrito está vacío.' }

  // El Server Action es un endpoint público — no confiar en que el cliente
  // mandó cantidades válidas ni productos sin duplicar.
  const cantidadesPorProducto = new Map<string, number>()
  for (const item of input.items) {
    if (!item.productoId || !Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      return { error: 'Hay un producto con una cantidad inválida en el carrito.' }
    }
    cantidadesPorProducto.set(
      item.productoId,
      (cantidadesPorProducto.get(item.productoId) ?? 0) + item.cantidad
    )
  }
  const items = Array.from(cantidadesPorProducto, ([productoId, cantidad]) => ({
    productoId,
    cantidad,
  }))

  const supabase = createServiceClient()

  const { data: puntoVenta, error: errorPuntoVenta } = await supabase
    .from('puntos_venta')
    .select('pedido_minimo, activo')
    .eq('id', puntoVentaId)
    .maybeSingle()

  if (errorPuntoVenta || !puntoVenta || !puntoVenta.activo) {
    return { error: 'Tu punto de venta no está disponible. Contactá a Don Carmelo.' }
  }

  const idsProductos = items.map((i) => i.productoId)
  const { data: productos, error: errorProductos } = await supabase
    .from('productos')
    .select('id, precio_sugerido, disponible, activo')
    .in('id', idsProductos)

  if (errorProductos || !productos) return { error: 'No pudimos verificar los productos.' }

  const productosPorId = new Map(productos.map((p) => [p.id, p]))
  let total = 0
  for (const item of items) {
    const producto = productosPorId.get(item.productoId)
    if (!producto || !producto.activo || !producto.disponible) {
      return {
        error: 'Alguno de los productos del carrito ya no está disponible. Volvé al catálogo.',
      }
    }
    if (producto.precio_sugerido != null) total += producto.precio_sugerido * item.cantidad
  }

  if (puntoVenta.pedido_minimo != null && total < puntoVenta.pedido_minimo) {
    return {
      error: `El pedido mínimo es $${puntoVenta.pedido_minimo}. Te faltan $${(
        puntoVenta.pedido_minimo - total
      ).toFixed(2)}.`,
    }
  }

  const ahora = new Date()
  const { hoy, manana } = obtenerFechaHoyYManana(ahora)

  const { data: filasExcepcion } = await supabase
    .from('excepciones_corte')
    .select('fecha, hora_corte')
    .in('fecha', [hoy, manana])

  const excepciones: Record<string, string> = {}
  for (const fila of filasExcepcion ?? []) {
    excepciones[fila.fecha] = fila.hora_corte
  }

  const resultado = calcularTurno(input.eleccionFecha, ahora, excepciones)

  const { data: pedido, error: errorPedido } = await supabase
    .from('pedidos')
    .insert({
      punto_venta_id: puntoVentaId,
      fecha_entrega: resultado.fechaEntrega,
      turno_reparto: resultado.turno,
      tipo_etiqueta: input.tipoEtiqueta,
      fuera_de_horario: resultado.fueraDeHorario,
    })
    .select('id')
    .single()

  if (errorPedido || !pedido) return { error: 'No pudimos guardar el pedido. Intentá de nuevo.' }

  const { error: errorItems } = await supabase.from('pedido_items').insert(
    items.map((item) => ({
      pedido_id: pedido.id,
      producto_id: item.productoId,
      cantidad: item.cantidad,
    }))
  )

  if (errorItems) {
    // Evita dejar un pedido sin items dando vueltas: si no se pudieron guardar
    // los productos, se borra el pedido recién creado en vez de dejarlo huérfano.
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    return {
      error: 'No pudimos guardar los productos del pedido. Intentá de nuevo.',
    }
  }

  return { success: true, fechaEntrega: resultado.fechaEntrega, turno: resultado.turno }
}
