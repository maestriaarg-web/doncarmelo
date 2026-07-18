'use server'

import { getPuntoVentaId } from '@/lib/comercio/session'
import { obtenerUltimoPedido } from '@/lib/comercio/pedidos'
import type { ItemCarrito } from '@/lib/types'

export type RepetirPedidoResultado =
  | { error: string }
  | { success: true; items: ItemCarrito[]; omitidos: number }

export async function repetirUltimoPedido(): Promise<RepetirPedidoResultado> {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) return { error: 'Sesión inválida, volvé a ingresar tu celular.' }

  let ultimoPedido
  try {
    ultimoPedido = await obtenerUltimoPedido(puntoVentaId)
  } catch {
    return { error: 'No pudimos cargar tu último pedido. Intentá de nuevo.' }
  }
  if (!ultimoPedido) return { error: 'Todavía no hiciste ningún pedido.' }

  const items: ItemCarrito[] = []
  let omitidos = 0

  for (const item of ultimoPedido.pedido_items) {
    const producto = item.productos
    if (!producto || !producto.activo || !producto.disponible) {
      omitidos++
      continue
    }
    items.push({
      productoId: item.producto_id,
      nombre: producto.nombre,
      unidad: producto.unidad,
      precioSugerido: producto.precio_sugerido,
      cantidad: item.cantidad,
    })
  }

  if (items.length === 0) {
    return { error: 'Los productos de tu último pedido ya no están disponibles.' }
  }

  return { success: true, items, omitidos }
}
