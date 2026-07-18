import { createServiceClient } from '@/lib/supabase/service'
import type { PedidoConItems, Producto } from '@/lib/types'

const SELECT_PEDIDO_CON_ITEMS =
  'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, creado_en, pedido_items(cantidad, producto_id, productos(nombre, unidad, precio_sugerido, activo, disponible))'

export async function obtenerHistorialPedidos(puntoVentaId: string): Promise<PedidoConItems[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_CON_ITEMS)
    .eq('punto_venta_id', puntoVentaId)
    .order('creado_en', { ascending: false })

  // Un error acá NO debe verse como "todavía no hiciste ningún pedido" —
  // eso sería mostrarle al comercio una mentira. Se deja que el error
  // boundary de la página lo maneje en vez de devolver una lista vacía.
  if (error) throw new Error(error.message)

  return (data ?? []) as unknown as PedidoConItems[]
}

export async function obtenerUltimoPedido(puntoVentaId: string): Promise<PedidoConItems | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_CON_ITEMS)
    .eq('punto_venta_id', puntoVentaId)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return (data as unknown as PedidoConItems) ?? null
}

export async function tienePedidosPrevios(puntoVentaId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id')
    .eq('punto_venta_id', puntoVentaId)
    .limit(1)

  if (error) {
    // Esto solo controla si se muestran el botón "repetir" y la sección de
    // frecuentes — un error acá no debe romper el catálogo. Se degrada a
    // "sin historial" (los oculta), pero queda registrado para poder
    // diagnosticarlo si empieza a pasar seguido.
    console.error('tienePedidosPrevios: error consultando pedidos', error)
    return false
  }

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

  const { data: filas, error: errorFilas } = await supabase
    .from('pedido_items')
    .select('producto_id, pedido_id, pedidos!inner(punto_venta_id)')
    .eq('pedidos.punto_venta_id', puntoVentaId)

  if (errorFilas) {
    // Igual que tienePedidosPrevios: es una sección de conveniencia, un
    // error acá solo la oculta (no rompe el catálogo), pero se registra.
    console.error('obtenerProductosFrecuentes: error consultando pedido_items', errorFilas)
    return []
  }

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

  const { data: productos, error: errorProductos } = await supabase
    .from('productos')
    .select('*')
    .in('id', idsRankeados)
    .eq('activo', true)
    .eq('disponible', true)

  if (errorProductos) {
    console.error('obtenerProductosFrecuentes: error consultando productos', errorProductos)
    return []
  }

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
