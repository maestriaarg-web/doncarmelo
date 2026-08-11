import { createServiceClient } from '@/lib/supabase/service'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { tienePedidosPrevios, obtenerProductosFrecuentes } from '@/lib/comercio/pedidos'
import type { Configuracion, Producto } from '@/lib/types'
import { CatalogoClient } from './CatalogoClient'
import { HomeComercioBanner } from './HomeComercioBanner'

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

  const { data: configuracion } = await supabase
    .from('configuracion')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  const config = configuracion as Configuracion | null

  const hayHistorial = puntoVentaId ? await tienePedidosPrevios(puntoVentaId) : false
  const productosFrecuentes =
    puntoVentaId && hayHistorial ? await obtenerProductosFrecuentes(puntoVentaId) : []

  return (
    <>
      <HomeComercioBanner
        listaPreciosUrl={config?.lista_precios_url ?? null}
        videoEmbalajeUrl={config?.video_embalaje_url ?? null}
      />
      <CatalogoClient
        productos={(productos ?? []) as Producto[]}
        hayHistorial={hayHistorial}
        productosFrecuentes={productosFrecuentes}
      />
    </>
  )
}
