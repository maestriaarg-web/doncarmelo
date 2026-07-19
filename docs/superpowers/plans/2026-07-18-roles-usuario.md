# Roles de usuario Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir más de un usuario en el panel admin, con dos roles — `admin` (acceso total, como hoy) y `empleado` (solo `/admin/pedidos` y remitos) — enforced a nivel interfaz, más una pantalla para que el admin cree/gestione esos usuarios.

**Architecture:** El rol se guarda en `app_metadata` de Supabase Auth (no `user_metadata` — ese campo solo se puede escribir con la service-role key, así que un empleado no puede auto-asignarse el rol admin). `proxy.ts` y el nav del admin leen ese rol de la sesión actual para bloquear/ocultar rutas. La pantalla de gestión de usuarios usa la Admin API de Supabase Auth (`supabase.auth.admin.*`), que requiere el service-role client — única excepción documentada a la regla de "admin usa el cliente RLS-scoped" en todo el proyecto, porque esas operaciones no pasan por RLS en absoluto.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind v4, Supabase Auth — sin cambios de versión. Sin migración de base de datos en este plan (el rol no es una columna de tabla).

## Global Constraints

- Next.js 16.2.10 / React 19.2.4 / TypeScript / Tailwind v4 — ya instaladas, no se cambian.
- No hay suite de tests automatizada (decisión ya confirmada para todo el proyecto) — verificación es `npm run build` + `npm run lint` + prueba manual contra Supabase real.
- `ActionResult` pattern (`{error: string} | {success: true}`, nunca `throw`) para las cuatro Server Actions de este plan.
- **Excepción documentada:** las Server Actions y el `page.tsx` de `/admin/usuarios` usan `createServiceClient()` de `@/lib/supabase/service`, no el cliente RLS-scoped que usa el resto del panel admin. Es la única pantalla de todo el proyecto que lo hace, porque `supabase.auth.admin.*` (listar/crear/editar/borrar usuarios de Supabase Auth) son operaciones privilegiadas que no pasan por políticas RLS — no son queries a una tabla.
- Ausencia de `app_metadata.rol` se interpreta como `'admin'` — el usuario admin original (creado antes de este plan) sigue teniendo acceso completo sin ninguna migración de datos.
- `cambiarRolUsuario` y `eliminarUsuario` deben rechazar la operación si el `userId` objetivo es el mismo que el del usuario que hace la llamada — evita que alguien se saque su propio rol admin o se elimine a sí mismo y quede bloqueado del panel.
- Enforcement es **solo a nivel interfaz** (decisión explícita del spec) — no se tocan las políticas RLS existentes (`admin_full_access`), eso queda fuera de alcance.
- Rutas permitidas para `empleado`: `/admin/pedidos` (y su navegación por fecha), `/admin/remito/[id]`, `/admin/remitos`. Cualquier otra ruta bajo `/admin/*` redirige a `/admin/pedidos`.

---

## File Structure

```
src/lib/types.ts                                        # (modify) RolAdmin, UsuarioAdmin
src/lib/admin/auth.ts                                    # (create) obtenerRolActual()
src/proxy.ts                                              # (modify) redirect de empleado fuera de rutas permitidas
src/app/admin/(dashboard)/layout.tsx                       # (modify) nav condicional por rol

src/app/admin/(dashboard)/usuarios/page.tsx                 # (create) listado (service-role client)
src/app/admin/(dashboard)/usuarios/actions.ts                # (create) crearUsuario, cambiarRolUsuario, resetearPassword, eliminarUsuario
src/app/admin/(dashboard)/usuarios/NuevoUsuarioForm.tsx       # (create) alta de usuario
src/app/admin/(dashboard)/usuarios/UsuariosClient.tsx          # (create) listado + acciones por fila
```

---

### Task 1: Rol de usuario — tipos, lectura, enforcement

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/admin/auth.ts`
- Modify: `src/proxy.ts`
- Modify: `src/app/admin/(dashboard)/layout.tsx`

**Interfaces:**
- Produces: `RolAdmin` type, `UsuarioAdmin` type (from `@/lib/types`), `obtenerRolActual(): Promise<{userId: string; rol: RolAdmin} | null>` (from `@/lib/admin/auth`) — consumidos por Task 2.

- [ ] **Step 1: Tipos**

En `src/lib/types.ts`, agregar estos dos tipos al final del archivo. El resto del archivo (`ActionResult`, `Producto`, `PuntoVenta`, `ItemCarrito`, `PedidoConItems`, `PedidoAdmin`, `ExcepcionCorte`) queda exactamente igual:

```ts
export type RolAdmin = 'admin' | 'empleado'

export type UsuarioAdmin = {
  id: string
  email: string
  rol: RolAdmin
}
```

- [ ] **Step 2: Helper de lectura del rol actual**

```ts
// src/lib/admin/auth.ts
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
```

- [ ] **Step 3: Redirect de empleado en proxy.ts**

```ts
// src/proxy.ts — full file
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { COMERCIO_COOKIE_NAME } from '@/lib/comercio/constants'

const RUTAS_PERMITIDAS_EMPLEADO = ['/admin/pedidos', '/admin/remito', '/admin/remitos']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/pedido')) {
    const puntoVentaId = request.cookies.get(COMERCIO_COOKIE_NAME)?.value
    if (!puntoVentaId) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = pathname === '/admin/login'
  const isAdminRoute = pathname.startsWith('/admin')

  if (isAdminRoute && !isLoginPage && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  if (isLoginPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/pedidos'
    return NextResponse.redirect(url)
  }

  const esEmpleado = user?.app_metadata?.rol === 'empleado'
  const rutaPermitidaParaEmpleado = RUTAS_PERMITIDAS_EMPLEADO.some((ruta) =>
    pathname.startsWith(ruta)
  )

  if (isAdminRoute && !isLoginPage && esEmpleado && !rutaPermitidaParaEmpleado) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/pedidos'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/pedido/:path*'],
}
```

- [ ] **Step 4: Nav condicional por rol**

```tsx
// src/app/admin/(dashboard)/layout.tsx — full file
import Link from 'next/link'
import { BrandMark } from '@/components/BrandMark'
import { obtenerRolActual } from '@/lib/admin/auth'
import { signOut } from '../login/actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerRolActual()
  const esAdmin = sesion?.rol !== 'empleado'

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-6">
          <BrandMark />
          <nav className="flex gap-4 text-sm font-medium text-neutral-700">
            <Link href="/admin/pedidos">Pedidos</Link>
            {esAdmin && (
              <>
                <Link href="/admin/productos">Productos</Link>
                <Link href="/admin/puntos-venta">Puntos de venta</Link>
                <Link href="/admin/excepciones">Excepciones de corte</Link>
                <Link href="/admin/usuarios">Usuarios</Link>
              </>
            )}
          </nav>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-900">
            Salir
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: builds exitosamente.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/admin/auth.ts src/proxy.ts "src/app/admin/(dashboard)/layout.tsx"
git commit -m "Add rol de usuario storage, read helper, and empleado route enforcement"
```

---

### Task 2: Pantalla /admin/usuarios

**Files:**
- Create: `src/app/admin/(dashboard)/usuarios/page.tsx`
- Create: `src/app/admin/(dashboard)/usuarios/actions.ts`
- Create: `src/app/admin/(dashboard)/usuarios/NuevoUsuarioForm.tsx`
- Create: `src/app/admin/(dashboard)/usuarios/UsuariosClient.tsx`

**Interfaces:**
- Consumes: `UsuarioAdmin`/`ActionResult`/`RolAdmin` from `@/lib/types` (Task 1), `obtenerRolActual` from `@/lib/admin/auth` (Task 1), `createServiceClient` from `@/lib/supabase/service` (ya existe).

- [ ] **Step 1: Server Actions**

```ts
// src/app/admin/(dashboard)/usuarios/actions.ts
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
```

- [ ] **Step 2: Página — listado vía Admin API**

```tsx
// src/app/admin/(dashboard)/usuarios/page.tsx
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
```

- [ ] **Step 3: Formulario de alta**

```tsx
// src/app/admin/(dashboard)/usuarios/NuevoUsuarioForm.tsx
'use client'

import { useState, type FormEvent } from 'react'
import type { RolAdmin } from '@/lib/types'
import { crearUsuario } from './actions'

export function NuevoUsuarioForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<RolAdmin>('empleado')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const result = await crearUsuario({ email, password, rol })
    if ('error' in result) {
      setError(result.error)
      setGuardando(false)
      return
    }
    onDone()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
    >
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Contraseña inicial
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Rol</label>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as RolAdmin)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        >
          <option value="empleado">Empleado (solo pedidos)</option>
          <option value="admin">Admin (acceso total)</option>
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? 'Creando...' : 'Crear usuario'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-neutral-300 px-4 py-2.5 text-base font-medium text-neutral-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Listado con acciones por fila**

```tsx
// src/app/admin/(dashboard)/usuarios/UsuariosClient.tsx
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
```

- [ ] **Step 5: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. `/admin/usuarios` como admin — confirmá que ves el usuario admin actual en la lista.
2. "+ Nuevo usuario" — creá uno con rol `empleado`, email y contraseña de prueba. Confirmá que aparece en la lista.
3. Intentá cambiarte tu propio rol a `empleado` en el select de tu propia fila — confirmá el mensaje de error "No podés cambiar tu propio rol." y que el rol no cambió.
4. Intentá eliminarte a vos mismo — mismo resultado esperado con "No podés eliminarte a vos mismo."
5. En la fila del usuario de prueba, cambiale el rol de empleado a admin y de vuelta a empleado — confirmá que el cambio persiste (recargar la página).
6. "Resetear contraseña" en el usuario de prueba — poné una contraseña nueva, confirmá que guarda sin error.
7. "Eliminar" el usuario de prueba (no el tuyo) — confirmá el diálogo de confirmación y que desaparece de la lista.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(dashboard)/usuarios"
git commit -m "Add usuarios management screen (create, change rol, reset password, delete)"
```

---

### Task 3: Smoke test end-to-end + deploy

**Files:** ninguno (verificación únicamente)

- [ ] **Step 1: Build y lint completos**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 2: Push**

```bash
git push origin main
```

(Si falla por el problema de credencial cacheada de Windows: `git push "https://<TOKEN>@github.com/maestriaarg-web/doncarmelo.git" main:main` — nunca con `-u`.)

- [ ] **Step 3: Prueba end-to-end contra producción**

En `https://doncarmelo.vercel.app`:
1. Como admin, `/admin/usuarios` — crear un usuario de prueba con rol `empleado` y una contraseña temporal.
2. Abrir una sesión distinta (ventana de incógnito, o desloguearse y loguearse con las credenciales nuevas) — confirmar que el nav del admin solo muestra "Pedidos", y que intentar navegar directamente a `/admin/productos`, `/admin/puntos-venta`, `/admin/excepciones`, o `/admin/usuarios` redirige a `/admin/pedidos` en los cuatro casos.
3. Confirmar que ese usuario empleado SÍ puede operar `/admin/pedidos` normalmente: marcar preparado/entregado/cancelado, imprimir remitos.
4. Volver a loguearse como admin original, confirmar que sigue teniendo acceso completo a todo (incluyendo `/admin/usuarios`) sin haber tocado su `app_metadata` manualmente.
5. Eliminar el usuario de prueba desde `/admin/usuarios`.
6. Confirmar que nada del resto del admin (productos, puntos de venta, pedidos, excepciones) se rompió.

- [ ] **Step 4: Reportar estado**

Sin commit para esta tarea — es el gate final de verificación. Con esto cierra el sub-proyecto 2 de 4 de Fase 2 (roles de usuario); el siguiente es integración WhatsApp.
