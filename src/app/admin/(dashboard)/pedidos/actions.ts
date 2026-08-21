'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notificarEstadoPedido } from '@/lib/whatsapp'
import { calcularTurno, obtenerFechaHoyYManana } from '@/lib/comercio/corte'
import type { ActionResult } from '@/lib/types'

export type CrearPedidoManualInput = {
  puntoVentaId: string
  items: { productoId: string; cantidad: number }[]
  eleccionFecha: 'hoy' | 'manana'
  tipoEtiqueta: 'grande' | 'chica' | 'ambas'
}

export type CrearPedidoManualResultado =
  | { error: string }
  | { success: true; fechaEntrega: string; turno: 'manana' | 'tarde' }

/**
 * Carga un pedido a nombre de un punto de venta desde el panel admin, para
 * pedidos que llegan por audio de WhatsApp u otro canal fuera de la app.
 * Reusa la misma tabla/lógica de corte que un pedido hecho desde /pedido —
 * solo cambia el origen (punto_venta_id explícito en vez de la cookie del
 * comercio) y se marca cargado_por_admin para distinguirlo visualmente.
 */
export async function crearPedidoManual(
  input: CrearPedidoManualInput
): Promise<CrearPedidoManualResultado> {
  if (!input.puntoVentaId) return { error: 'Elegí un punto de venta.' }
  if (input.items.length === 0) return { error: 'Agregá al menos un producto.' }

  const cantidadesPorProducto = new Map<string, number>()
  for (const item of input.items) {
    if (!item.productoId || !Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      return { error: 'Hay un producto con una cantidad inválida.' }
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

  const supabase = await createClient()

  const { data: puntoVenta, error: errorPuntoVenta } = await supabase
    .from('puntos_venta')
    .select('activo')
    .eq('id', input.puntoVentaId)
    .maybeSingle()

  if (errorPuntoVenta || !puntoVenta || !puntoVenta.activo) {
    return { error: 'Ese punto de venta no existe o está inactivo.' }
  }

  const idsProductos = items.map((i) => i.productoId)
  const { data: productos, error: errorProductos } = await supabase
    .from('productos')
    .select('id, activo')
    .in('id', idsProductos)

  if (errorProductos || !productos) return { error: 'No pudimos verificar los productos.' }

  const productosPorId = new Map(productos.map((p) => [p.id, p]))
  for (const item of items) {
    const producto = productosPorId.get(item.productoId)
    if (!producto || !producto.activo) {
      return { error: 'Alguno de los productos elegidos ya no está disponible.' }
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
      punto_venta_id: input.puntoVentaId,
      fecha_entrega: resultado.fechaEntrega,
      turno_reparto: resultado.turno,
      tipo_etiqueta: input.tipoEtiqueta,
      fuera_de_horario: resultado.fueraDeHorario,
      cargado_por_admin: true,
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
    return { error: 'No pudimos guardar los productos del pedido. Intentá de nuevo.' }
  }

  revalidatePath('/admin/pedidos')
  await notificarEstadoPedido(pedido.id, 'confirmado')

  return { success: true, fechaEntrega: resultado.fechaEntrega, turno: resultado.turno }
}

export async function marcarPreparado(pedidoId: string, montoFinal: number): Promise<ActionResult> {
  if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
    return { error: 'Ingresá un monto válido.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'preparado', monto_final: montoFinal })
    .eq('id', pedidoId)
    .eq('estado', 'confirmado')

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  await notificarEstadoPedido(pedidoId, 'preparado')
  return { success: true }
}

export async function marcarEntregado(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'entregado' })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  await notificarEstadoPedido(pedidoId, 'entregado')
  return { success: true }
}

export async function cancelarPedido(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'cancelado' })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  await notificarEstadoPedido(pedidoId, 'cancelado')
  return { success: true }
}
