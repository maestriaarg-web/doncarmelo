import { createServiceClient } from '@/lib/supabase/service'
import type { Producto } from '@/lib/types'

export default async function CatalogoPage() {
  const supabase = createServiceClient()
  const { data: productos, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  const lista = (productos ?? []) as Producto[]

  return (
    <div className="p-4">
      <h1 className="mb-2 text-xl font-semibold text-neutral-900">Catálogo</h1>
      <p className="text-sm text-neutral-500">{lista.length} producto(s) disponibles.</p>
    </div>
  )
}
