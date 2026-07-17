'use server'

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { setPuntoVentaCookie } from '@/lib/comercio/session'

function normalizarCelular(celular: string): string {
  return celular.replace(/\D/g, '')
}

export async function ingresarConCelular(formData: FormData) {
  const celular = normalizarCelular(String(formData.get('celular') ?? ''))

  if (!celular) {
    redirect('/?error=' + encodeURIComponent('Ingresá un número de celular.'))
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('puntos_venta')
    .select('id')
    .eq('celular', celular)
    .eq('activo', true)
    .maybeSingle()

  if (!data) {
    redirect(
      '/?error=' +
        encodeURIComponent('No encontramos ese número. Verificalo o contactá a Don Carmelo.')
    )
  }

  await setPuntoVentaCookie(data.id)
  redirect('/pedido')
}
