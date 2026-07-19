import { createClient } from '@/lib/supabase/server'
import type { RolAdmin } from '@/lib/types'

export async function obtenerRolActual(): Promise<{ userId: string; rol: RolAdmin } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const rol: RolAdmin = user.app_metadata?.rol === 'empleado' ? 'empleado' : 'admin'
  return { userId: user.id, rol }
}
