// src/app/admin/(dashboard)/configuracion/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { Configuracion } from '@/lib/types'
import { ConfiguracionForm } from './ConfiguracionForm'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: configuracion, error } = await supabase
    .from('configuracion')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) throw new Error(error.message)

  return <ConfiguracionForm configuracion={configuracion as Configuracion} />
}
