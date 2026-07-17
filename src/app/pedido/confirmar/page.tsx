import { redirect } from 'next/navigation'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { createServiceClient } from '@/lib/supabase/service'
import { obtenerFechaHoyYManana } from '@/lib/comercio/corte'
import type { PuntoVenta } from '@/lib/types'
import { ConfirmarClient } from './ConfirmarClient'

export default async function ConfirmarPage() {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) redirect('/')

  const supabase = createServiceClient()

  const { data: puntoVenta } = await supabase
    .from('puntos_venta')
    .select('*')
    .eq('id', puntoVentaId)
    .maybeSingle()

  if (!puntoVenta) redirect('/')

  const { hoy, manana } = obtenerFechaHoyYManana(new Date())
  const { data: filasExcepcion } = await supabase
    .from('excepciones_corte')
    .select('fecha, hora_corte')
    .in('fecha', [hoy, manana])

  const excepciones: Record<string, string> = {}
  for (const fila of filasExcepcion ?? []) {
    excepciones[fila.fecha] = fila.hora_corte
  }

  return <ConfirmarClient puntoVenta={puntoVenta as PuntoVenta} excepciones={excepciones} />
}
