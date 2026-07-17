import { createClient } from '@/lib/supabase/server'
import type { PuntoVenta } from '@/lib/types'

export default async function PuntosVentaPage() {
  const supabase = await createClient()
  const { data: puntosVenta, error } = await supabase
    .from('puntos_venta')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  const lista = (puntosVenta ?? []) as PuntoVenta[]

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">Puntos de venta</h1>
      <p className="text-sm text-neutral-500">{lista.length} punto(s) de venta cargado(s).</p>
    </div>
  )
}
