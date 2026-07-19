'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export type PuntoVentaInput = {
  nombre: string
  direccion: string | null
  contacto: string | null
  celular: string
  zona: string | null
  etiqueta_default: 'grande' | 'chica' | 'ambas'
  pedido_minimo: number | null
}

// Deja solo dígitos, así "3492 40-1234" y "3492401234" se guardan (y comparan) igual.
function normalizarCelular(celular: string): string {
  return celular.replace(/\D/g, '')
}

export async function crearPuntoVenta(input: PuntoVentaInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('puntos_venta')
    .insert({ ...input, celular: normalizarCelular(input.celular) })
  if (error) return { error: error.message }
  revalidatePath('/admin/puntos-venta')
  return { success: true }
}

export async function actualizarPuntoVenta(id: string, input: PuntoVentaInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('puntos_venta')
    .update({ ...input, celular: normalizarCelular(input.celular) })
    .eq('id', id)
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
