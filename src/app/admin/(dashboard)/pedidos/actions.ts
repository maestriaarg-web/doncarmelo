'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notificarEstadoPedido } from '@/lib/whatsapp'
import type { ActionResult } from '@/lib/types'

export async function marcarPreparado(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'preparado' })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  await notificarEstadoPedido(pedidoId, 'preparado')
  return { success: true }
}

export async function marcarEntregado(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'entregado' })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  await notificarEstadoPedido(pedidoId, 'entregado')
  return { success: true }
}

export async function cancelarPedido(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'cancelado' })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  await notificarEstadoPedido(pedidoId, 'cancelado')
  return { success: true }
}
