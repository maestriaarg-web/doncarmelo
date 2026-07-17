import { createClient } from '@/lib/supabase/server'
import type { Producto } from '@/lib/types'
import { ProductosClient } from './ProductosClient'

export default async function ProductosPage() {
  const supabase = await createClient()
  const { data: productos, error } = await supabase
    .from('productos')
    .select('*')
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  return <ProductosClient productos={(productos ?? []) as Producto[]} />
}
