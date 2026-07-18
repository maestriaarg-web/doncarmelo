import { createServiceClient } from '@/lib/supabase/service'
import type { PedidoConItems, Producto } from '@/lib/types'

const SELECT_PEDIDO_CON_ITEMS =
  'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, creado_en, pedido_items(cantidad, producto_id, productos(nombre, unidad, precio_sugerido, activo, disponible))'

export async function obtenerHistorialPedidos(puntoVentaId: string): Promise<PedidoConItems[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_CON_ITEMS)
    .eq('punto_venta_id', puntoVentaId)
    .order('creado_en', { ascending: false })

  return (data ?? []) as unknown as PedidoConItems[]
}

export async function obtenerUltimoPedido(puntoVentaId: string): Promise<PedidoConItems | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_CON_ITEMS)
    .eq('punto_venta_id', puntoVentaId)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as unknown as PedidoConItems) ?? null
}

export async function tienePedidosPrevios(puntoVentaId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('pedidos')
    .select('id')
    .eq('punto_venta_id', puntoVentaId)
    .limit(1)

  return (data?.length ?? 0) > 0
}

/**
 * Los 5 (por defecto) productos que aparecieron en más pedidos DISTINTOS del
 * punto de venta (no la cantidad total pedida). Solo productos que siguen
 * activos y disponibles hoy.
 */
export async function obtenerProductosFrecuentes(
  puntoVentaId: string,
  limite = 5
): Promise<Producto[]> {
  const supabase = createServiceClient()

  const { data: filas } = await supabase
    .from('pedido_items')
    .select('producto_id, pedido_id, pedidos!inner(punto_venta_id)')
    .eq('pedidos.punto_venta_id', puntoVentaId)

  if (!filas || filas.length === 0) return []

  const pedidosPorProducto = new Map<string, Set<string>>()
  for (const fila of filas as unknown as { producto_id: string; pedido_id: string }[]) {
    const set = pedidosPorProducto.get(fila.producto_id) ?? new Set<string>()
    set.add(fila.pedido_id)
    pedidosPorProducto.set(fila.producto_id, set)
  }

  const idsRankeados = Array.from(pedidosPorProducto.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .map(([productoId]) => productoId)

  const { data: productos } = await supabase
    .from('productos')
    .select('*')
    .in('id', idsRankeados)
    .eq('activo', true)
    .eq('disponible', true)

  if (!productos) return []

  const productosPorId = new Map(productos.map((p) => [p.id, p as Producto]))
  const ranking: Producto[] = []
  for (const id of idsRankeados) {
    const producto = productosPorId.get(id)
    if (producto) ranking.push(producto)
    if (ranking.length === limite) break
  }
  return ranking
}
