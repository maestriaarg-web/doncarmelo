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

  const supabase = createServiceClient()

  const { data: puntoVenta, error: errorPuntoVenta } = await supabase
    .from('puntos_venta')
    .select('pedido_minimo, activo')
    .eq('id', puntoVentaId)
    .maybeSingle()

  if (errorPuntoVenta || !puntoVenta || !puntoVenta.activo) {
    return { error: 'Tu punto de venta no está disponible. Contactá a Don Carmelo.' }
  }

  const idsProductos = input.items.map((i) => i.productoId)
  const { data: productos, error: errorProductos } = await supabase
    .from('productos')
    .select('id, precio_sugerido, disponible, activo')
    .in('id', idsProductos)

  if (errorProductos || !productos) return { error: 'No pudimos verificar los productos.' }

  const productosPorId = new Map(productos.map((p) => [p.id, p]))
  let total = 0
  for (const item of input.items) {
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
    input.items.map((item) => ({
      pedido_id: pedido.id,
      producto_id: item.productoId,
      cantidad: item.cantidad,
    }))
  )

  if (errorItems) {
    return {
      error: 'El pedido se guardó pero hubo un error con los productos. Contactá a Don Carmelo.',
    }
  }

  return { success: true, fechaEntrega: resultado.fechaEntrega, turno: resultado.turno }
}
