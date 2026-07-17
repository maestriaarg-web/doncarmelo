import { createClient } from '@/lib/supabase/server'
import type { PuntoVenta } from '@/lib/types'
import { PuntosVentaClient } from './PuntosVentaClient'

export default async function PuntosVentaPage() {
  const supabase = await createClient()
  const { data: puntosVenta, error } = await supabase
    .from('puntos_venta')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  return <PuntosVentaClient puntosVenta={(puntosVenta ?? []) as PuntoVenta[]} />
}
