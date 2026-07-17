'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export type ProductoInput = {
  nombre: string
  categoria: string
  unidad: string
  precio_sugerido: number | null
  congelado: boolean
  disponible: boolean
  foto_url: string | null
}

export async function crearProducto(input: ProductoInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('productos').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/admin/productos')
  return { success: true }
}

export async function actualizarProducto(id: string, input: ProductoInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('productos').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/productos')
  return { success: true }
}

export async function darDeBajaProducto(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('productos').update({ activo: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/productos')
  return { success: true }
}

export async function toggleDisponible(id: string, disponible: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('productos').update({ disponible }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/productos')
  return { success: true }
}
