import { createClient } from '@/lib/supabase/server'
import type { PedidoAdmin } from '@/lib/types'

const SELECT_PEDIDO_ADMIN =
  'id, fecha_entrega, turno_reparto, tipo_etiqueta, fuera_de_horario, creado_en, puntos_venta(id, nombre, direccion), pedido_items(id, cantidad, producto_id, productos(nombre, categoria, unidad))'

export async function obtenerPedidosDelDia(fecha: string): Promise<PedidoAdmin[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_ADMIN)
    .eq('fecha_entrega', fecha)
    .order('creado_en', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PedidoAdmin[]
}

export async function obtenerPedidoPorId(id: string): Promise<PedidoAdmin | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_ADMIN)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as unknown as PedidoAdmin) ?? null
}

export type ItemPreparacion = {
  productoId: string
  nombre: string
  categoria: string
  unidad: string
  cantidadTotal: number
  cantidadPedidos: number
}

/**
 * Suma las cantidades de cada producto entre todos los pedidos dados
 * (pensado para un turno completo), para armar la lista de preparación.
 */
export function consolidarPreparacion(pedidos: PedidoAdmin[]): ItemPreparacion[] {
  const mapa = new Map<string, ItemPreparacion>()

  for (const pedido of pedidos) {
    for (const item of pedido.pedido_items) {
      const producto = item.productos
      if (!producto) continue

      const existente = mapa.get(item.producto_id)
      if (existente) {
        existente.cantidadTotal += item.cantidad
        existente.cantidadPedidos += 1
      } else {
        mapa.set(item.producto_id, {
          productoId: item.producto_id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          unidad: producto.unidad,
          cantidadTotal: item.cantidad,
          cantidadPedidos: 1,
        })
      }
    }
  }

  return Array.from(mapa.values()).sort(
    (a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre)
  )
}

async function obtenerPromedioHistorico(
  puntoVentaId: string,
  productoId: string,
  excluirPedidoId: string
): Promise<number | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedido_items')
    .select('cantidad, pedido_id, pedidos!inner(punto_venta_id)')
    .eq('producto_id', productoId)
    .eq('pedidos.punto_venta_id', puntoVentaId)
    .neq('pedido_id', excluirPedidoId)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return null

  const filas = data as unknown as { cantidad: number }[]
  const total = filas.reduce((acc, fila) => acc + fila.cantidad, 0)
  return total / filas.length
}

/**
 * Devuelve el set de claves "pedidoId:productoId" cuya cantidad es más del
 * doble del promedio histórico de ese producto para ese punto de venta.
 * Sin pedidos previos de ese producto para ese comercio, no hay base de
 * comparación y no se marca (evita falsos positivos en un producto nuevo).
 */
export async function calcularCantidadesAtipicas(pedidos: PedidoAdmin[]): Promise<Set<string>> {
  const atipicos = new Set<string>()

  // Sin cache por (puntoVenta, producto): cada pedido excluye SU PROPIO id de
  // la consulta, así que dos pedidos del mismo día con el mismo comercio y
  // producto necesitan cada uno su propio promedio (si uno reutilizara el
  // promedio del otro, terminaría comparándose contra un promedio que lo
  // incluye a él mismo).
  for (const pedido of pedidos) {
    const puntoVentaId = pedido.puntos_venta?.id
    if (!puntoVentaId) continue

    for (const item of pedido.pedido_items) {
      const promedio = await obtenerPromedioHistorico(puntoVentaId, item.producto_id, pedido.id)
      if (promedio != null && item.cantidad > promedio * 2) {
        atipicos.add(`${pedido.id}:${item.producto_id}`)
      }
    }
  }

  return atipicos
}
