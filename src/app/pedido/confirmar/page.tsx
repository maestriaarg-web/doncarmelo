import { redirect } from 'next/navigation'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { createServiceClient } from '@/lib/supabase/service'

export default async function ConfirmarPage() {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) redirect('/')

  const supabase = createServiceClient()
  const { data: puntoVenta } = await supabase
    .from('puntos_venta')
    .select('nombre')
    .eq('id', puntoVentaId)
    .maybeSingle()

  if (!puntoVenta) redirect('/')

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold text-neutral-900">Confirmar pedido</h1>
      <p className="text-sm text-neutral-500">Punto de venta: {puntoVenta.nombre}</p>
    </div>
  )
}
