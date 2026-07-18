import { createServiceClient } from '@/lib/supabase/service'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { tienePedidosPrevios, obtenerProductosFrecuentes } from '@/lib/comercio/pedidos'
import type { Producto } from '@/lib/types'
import { CatalogoClient } from './CatalogoClient'

export const dynamic = 'force-dynamic'

export default async function CatalogoPage() {
  const puntoVentaId = await getPuntoVentaId()

  const supabase = createServiceClient()
  const { data: productos, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  const hayHistorial = puntoVentaId ? await tienePedidosPrevios(puntoVentaId) : false
  const productosFrecuentes =
    puntoVentaId && hayHistorial ? await obtenerProductosFrecuentes(puntoVentaId) : []

  return (
    <CatalogoClient
      productos={(productos ?? []) as Producto[]}
      hayHistorial={hayHistorial}
      productosFrecuentes={productosFrecuentes}
    />
  )
}
