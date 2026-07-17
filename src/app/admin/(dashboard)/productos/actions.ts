'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProductoInput = {
  nombre: string
  categoria: string
  unidad: string
  precio_sugerido: number | null
  congelado: boolean
  disponible: boolean
  foto_url: string | null
}

export async function crearProducto(input: ProductoInput) {
  const supabase = await createClient()
  const { error } = await supabase.from('productos').insert(input)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/productos')
}

export async function actualizarProducto(id: string, input: ProductoInput) {
  const supabase = await createClient()
  const { error } = await supabase.from('productos').update(input).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/productos')
}

export async function darDeBajaProducto(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('productos').update({ activo: false }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/productos')
}

export async function toggleDisponible(id: string, disponible: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('productos').update({ disponible }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/productos')
}
