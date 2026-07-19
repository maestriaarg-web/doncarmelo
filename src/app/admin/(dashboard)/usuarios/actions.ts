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

export async function crearUsuario(input: UsuarioInput): Promise<ActionResult> {
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
  const actual = await obtenerRolActual()
  if (actual?.userId === userId) {
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
  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, { password })

  if (error) return { error: error.message }
  return { success: true }
}

export async function eliminarUsuario(userId: string): Promise<ActionResult> {
  const actual = await obtenerRolActual()
  if (actual?.userId === userId) {
    return { error: 'No podés eliminarte a vos mismo.' }
  }

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.deleteUser(userId)

  if (error) return { error: error.message }
  revalidatePath('/admin/usuarios')
  return { success: true }
}
