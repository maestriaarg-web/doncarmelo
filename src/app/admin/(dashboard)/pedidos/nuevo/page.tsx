import { createClient } from '@/lib/supabase/server'
import { obtenerFechaHoyYManana } from '@/lib/comercio/corte'
import type { PuntoVenta, Producto } from '@/lib/types'
import { NuevoPedidoForm } from './NuevoPedidoForm'

export const dynamic = 'force-dynamic'

export default async function NuevoPedidoPage() {
  const supabase = await createClient()

  const { data: puntosVenta, error: errorPuntosVenta } = await supabase
    .from('puntos_venta')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (errorPuntosVenta) throw new Error(errorPuntosVenta.message)

  const { data: productos, error: errorProductos } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (errorProductos) throw new Error(errorProductos.message)

  const { hoy, manana } = obtenerFechaHoyYManana(new Date())
  const { data: filasExcepcion } = await supabase
    .from('excepciones_corte')
    .select('fecha, hora_corte')
    .in('fecha', [hoy, manana])

  const excepciones: Record<string, string> = {}
  for (const fila of filasExcepcion ?? []) {
    excepciones[fila.fecha] = fila.hora_corte
  }

  return (
    <NuevoPedidoForm
      puntosVenta={(puntosVenta ?? []) as PuntoVenta[]}
      productos={(productos ?? []) as Producto[]}
      excepciones={excepciones}
    />
  )
}
