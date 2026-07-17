import { createServiceClient } from '@/lib/supabase/service'
import type { Producto } from '@/lib/types'
import { CatalogoClient } from './CatalogoClient'

// createServiceClient() doesn't touch cookies(), so Next has no signal to render
// this dynamically and would otherwise statically freeze the catalog (including
// disponible status) at build time. Force per-request rendering so stock changes
// show up on refresh, as required by the manual verification steps.
export const dynamic = 'force-dynamic'

export default async function CatalogoPage() {
  const supabase = createServiceClient()
  const { data: productos, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  return <CatalogoClient productos={(productos ?? []) as Producto[]} />
}
