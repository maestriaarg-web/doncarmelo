import { createClient } from '@/lib/supabase/server'
import type { ExcepcionCorte } from '@/lib/types'
import { ExcepcionesClient } from './ExcepcionesClient'

export default async function ExcepcionesPage() {
  const supabase = await createClient()
  const { data: excepciones, error } = await supabase
    .from('excepciones_corte')
    .select('*')
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)

  return <ExcepcionesClient excepciones={(excepciones ?? []) as ExcepcionCorte[]} />
}
