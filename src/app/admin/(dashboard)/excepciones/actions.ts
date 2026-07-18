'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export type ExcepcionCorteInput = {
  fecha: string
  hora_corte: string
  motivo: string | null
}

export async function crearExcepcion(input: ExcepcionCorteInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('excepciones_corte').insert(input)
  if (error) return { error: error.message }
  revalidatePath('/admin/excepciones')
  return { success: true }
}

export async function actualizarExcepcion(
  id: string,
  input: ExcepcionCorteInput
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('excepciones_corte').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/excepciones')
  return { success: true }
}

export async function borrarExcepcion(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('excepciones_corte').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/excepciones')
  return { success: true }
}
