'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export type PuntoVentaInput = {
  nombre: string
  direccion: string | null
  contacto: string | null
  codigo_acceso: string
  etiqueta_default: 'grande' | 'chica' | 'ambas'
  pedido_minimo: number | null
}

export async function crearPuntoVenta(input: PuntoVentaInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('puntos_venta').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/admin/puntos-venta')
  return { success: true }
}

export async function actualizarPuntoVenta(id: string, input: PuntoVentaInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('puntos_venta').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/puntos-venta')
  return { success: true }
}

export async function cambiarActivoPuntoVenta(id: string, activo: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('puntos_venta').update({ activo }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/puntos-venta')
  return { success: true }
}
