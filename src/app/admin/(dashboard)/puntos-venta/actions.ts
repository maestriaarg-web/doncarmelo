'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PuntoVentaInput = {
  nombre: string
  direccion: string | null
  contacto: string | null
  codigo_acceso: string
  etiqueta_default: 'grande' | 'chica' | 'ambas'
  pedido_minimo: number | null
}

export async function crearPuntoVenta(input: PuntoVentaInput) {
  const supabase = await createClient()
  const { error } = await supabase.from('puntos_venta').insert(input)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/puntos-venta')
}

export async function actualizarPuntoVenta(id: string, input: PuntoVentaInput) {
  const supabase = await createClient()
  const { error } = await supabase.from('puntos_venta').update(input).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/puntos-venta')
}

export async function cambiarActivoPuntoVenta(id: string, activo: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('puntos_venta').update({ activo }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/puntos-venta')
}
