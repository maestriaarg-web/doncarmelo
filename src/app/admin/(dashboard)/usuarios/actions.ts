'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { obtenerRolActual } from '@/lib/admin/auth'
import type { ActionResult, RolAdmin } from '@/lib/types'

export type UsuarioInput = {
  email: string
  password: string
  rol: RolAdmin
}

// Server Actions se invocan por id de acción, no por ruta — proxy.ts protege
// el RENDER de /admin/usuarios, pero no la ejecución de estas funciones si
// alguien arma el request a mano. Por eso cada una valida el rol del que
// llama por su cuenta, en vez de confiar únicamente en el proxy/nav.
async function exigirAdmin(): Promise<{ userId: string } | { error: string }> {
  const actual = await obtenerRolActual()
  if (!actual || actual.rol !== 'admin') return { error: 'No autorizado.' }
  return { userId: actual.userId }
}

export async function crearUsuario(input: UsuarioInput): Promise<ActionResult> {
  const auth = await exigirAdmin()
  if ('error' in auth) return auth

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { rol: input.rol },
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/usuarios')
  return { success: true }
}

export async function cambiarRolUsuario(userId: string, rol: RolAdmin): Promise<ActionResult> {
  const auth = await exigirAdmin()
  if ('error' in auth) return auth
  if (auth.userId === userId) {
    return { error: 'No podés cambiar tu propio rol.' }
  }

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { rol },
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/usuarios')
  return { success: true }
}

export async function resetearPassword(userId: string, password: string): Promise<ActionResult> {
  const auth = await exigirAdmin()
  if ('error' in auth) return auth

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, { password })

  if (error) return { error: error.message }
  return { success: true }
}

export async function eliminarUsuario(userId: string): Promise<ActionResult> {
  const auth = await exigirAdmin()
  if ('error' in auth) return auth
  if (auth.userId === userId) {
    return { error: 'No podés eliminarte a vos mismo.' }
  }

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/usuarios')
  return { success: true }
}
