import { createClient } from '@/lib/supabase/server'
import type { Producto } from '@/lib/types'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: productos, error } = await supabase
    .from('productos')
    .select('*')
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  const lista = (productos ?? []) as Producto[]

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">Productos</h1>
      <p className="text-sm text-neutral-500">{lista.length} producto(s) cargado(s).</p>
    </div>
  )
}
