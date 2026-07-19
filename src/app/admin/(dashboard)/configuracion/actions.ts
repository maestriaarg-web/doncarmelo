// src/app/admin/(dashboard)/configuracion/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { obtenerRolActual } from '@/lib/admin/auth'
import type { ActionResult } from '@/lib/types'

// Server Actions se invocan por id de acción, no por ruta — proxy.ts protege
// el RENDER de /admin/configuracion, pero no la ejecución de esta función si
// alguien arma el request a mano. Por eso valida el rol del que llama por su
// cuenta (mismo patrón que src/app/admin/(dashboard)/usuarios/actions.ts).
async function exigirAdmin(): Promise<{ userId: string } | { error: string }> {
  const actual = await obtenerRolActual()
  if (!actual || actual.rol !== 'admin') return { error: 'No autorizado.' }
  return { userId: actual.userId }
}

export async function actualizarBackupEmail(email: string | null): Promise<ActionResult> {
  const auth = await exigirAdmin()
  if ('error' in auth) return auth

  const supabase = await createClient()
  const { error } = await supabase.from('configuracion').update({ backup_email: email }).eq('id', 1)

  if (error) return { error: error.message }
  revalidatePath('/admin/configuracion')
  return { success: true }
}
