import { createServiceClient } from '@/lib/supabase/service'
import type { UsuarioAdmin } from '@/lib/types'
import { UsuariosClient } from './UsuariosClient'

export default async function UsuariosPage() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.admin.listUsers()

  if (error) throw new Error(error.message)

  const usuarios: UsuarioAdmin[] = data.users.map((usuario) => ({
    id: usuario.id,
    email: usuario.email ?? '(sin email)',
    rol: usuario.app_metadata?.rol === 'empleado' ? 'empleado' : 'admin',
  }))

  return <UsuariosClient usuarios={usuarios} />
}
