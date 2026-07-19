'use client'

import { useState } from 'react'
import type { RolAdmin, UsuarioAdmin } from '@/lib/types'
import { NuevoUsuarioForm } from './NuevoUsuarioForm'
import { cambiarRolUsuario, resetearPassword, eliminarUsuario } from './actions'

function UsuarioRow({ usuario }: { usuario: UsuarioAdmin }) {
  const [mostrarReset, setMostrarReset] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCambiarRol(rol: RolAdmin) {
    setCargando(true)
    setError(null)
    const result = await cambiarRolUsuario(usuario.id, rol)
    if ('error' in result) setError(result.error)
    setCargando(false)
  }

  async function handleResetear() {
    setCargando(true)
    setError(null)
    const result = await resetearPassword(usuario.id, nuevaPassword)
    if ('error' in result) {
      setError(result.error)
    } else {
      setMostrarReset(false)
      setNuevaPassword('')
    }
    setCargando(false)
  }

  async function handleEliminar() {
    if (!confirm(`¿Seguro que querés eliminar a ${usuario.email}?`)) return
    setCargando(true)
    setError(null)
    const result = await eliminarUsuario(usuario.id)
    if ('error' in result) setError(result.error)
    setCargando(false)
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[12rem] flex-1">
          <p className="font-medium text-foreground">{usuario.email}</p>
        </div>
        <select
          value={usuario.rol}
          onChange={(e) => handleCambiarRol(e.target.value as RolAdmin)}
          disabled={cargando}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="empleado">Empleado</option>
          <option value="admin">Admin</option>
        </select>
        <button
          onClick={() => setMostrarReset((actual) => !actual)}
          className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          Resetear contraseña
        </button>
        <button
          onClick={handleEliminar}
          disabled={cargando}
          className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>

      {mostrarReset && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <input
            type="password"
            value={nuevaPassword}
            onChange={(e) => setNuevaPassword(e.target.value)}
            placeholder="Contraseña nueva"
            minLength={6}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleResetear}
            disabled={cargando || nuevaPassword.length < 6}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  )
}

export function UsuariosClient({ usuarios }: { usuarios: UsuarioAdmin[] }) {
  const [modo, setModo] = useState<'lista' | 'nuevo'>('lista')

  if (modo === 'nuevo') {
    return <NuevoUsuarioForm onDone={() => setModo('lista')} />
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Usuarios</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover"
        >
          + Nuevo usuario
        </button>
      </div>

      <ul className="space-y-2">
        {usuarios.map((usuario) => (
          <UsuarioRow key={usuario.id} usuario={usuario} />
        ))}
        {usuarios.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No hay usuarios cargados.</p>
        )}
      </ul>
    </div>
  )
}
