# Gestión de Pedidos (Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Don Carmelo the admin screens to actually operate the orders the client app has been collecting: pedidos del día grouped by turno, a consolidated prep list, printable remitos, out-of-hours/atypical-quantity flags, and a small ABM for cutoff exceptions. This closes the entire Fase 1 scope from the original project brief.

**Architecture:** Same Next.js App Router app as the previous three sub-projects. Almost everything here is read/aggregation over `pedidos`/`pedido_items` (which already exist and are populated) via the admin's RLS-scoped Supabase client (`@/lib/supabase/server`'s `createClient()` — NOT the service-role client used by the comercio-facing app, since admin routes carry a real Supabase Auth session). The only new data is `excepciones_corte`, an existing empty table getting its first ABM screen. Printable remitos are plain Server Components rendered outside the admin dashboard's nav/header layout (so nothing extra needs hiding for print) with one small Client Component that triggers `window.print()` on load.

**Tech Stack:** Same as before — Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind v4, `@supabase/ssr`'s RLS-scoped client (admin side only).

## Global Constraints

- Next.js 16.2.10 / React 19.2.4 / TypeScript / Tailwind v4 — already installed, do not change versions.
- No persisted automated test suite (standing decision, reconfirmed for this sub-project) — verification is `npm run build` + `npm run lint` + manual testing against real Supabase data using pedidos already confirmed during previous sub-projects' testing.
- **Admin routes use the RLS-scoped client, not the service-role client.** `createClient()` from `@/lib/supabase/server` (async, cookie-based Supabase Auth session) — the same one `/admin/productos` and `/admin/puntos-venta` already use. Do not import `@/lib/supabase/service` (that's the comercio-facing, RLS-bypassing client) into anything under this plan's scope.
- `ActionResult` pattern (`{error: string} | {success: true}`, never `throw`) applies to the new `excepciones_corte` Server Actions, same as every other admin/comercio mutation in this codebase.
- Mobile sizing constraints (`py-2.5` minimum) are relaxed for this plan's admin screens where the existing admin ABM pattern already uses smaller/denser controls (e.g. list action links) — match the established admin visual density (see `puntos-venta`/`productos` ABM), not the comercio app's mobile-first sizing.
- The remito print routes (`/admin/remito/[id]`, `/admin/remitos`) live OUTSIDE the `(dashboard)` route group so they don't inherit the admin header/nav — they should render as a bare printable page using only the root layout.
- `obtenerFechaHoyYManana` from `@/lib/comercio/corte` is a pure date utility with no comercio-specific coupling — reusing it here for "what is today in Argentina time" is correct and avoids reimplementing timezone logic. Do not duplicate the timezone math.
- The "atípico" comparison excludes the pedido being evaluated from its own historical average (never compares a pedido against itself) and requires at least one prior order of that exact product for that exact punto de venta — no history means no alert, never a false positive from zero data.

---

## File Structure

```
src/lib/types.ts                              # (modify) add PedidoAdmin, ExcepcionCorte types
src/lib/admin/pedidos.ts                      # obtenerPedidosDelDia, obtenerPedidoPorId, consolidarPreparacion, calcularCantidadesAtipicas

src/app/admin/(dashboard)/layout.tsx          # (modify) add "Pedidos" and "Excepciones de corte" nav links
src/app/admin/page.tsx                        # (modify) redirect to /admin/pedidos instead of /admin/productos

src/app/admin/(dashboard)/pedidos/page.tsx           # pedidos del día — Server Component, date nav
src/app/admin/(dashboard)/pedidos/TurnoSection.tsx   # per-turno rendering (prep list + pedidos + badges)

src/app/admin/remito/RemitoContent.tsx        # shared printable remito markup
src/app/admin/remito/AutoPrint.tsx            # tiny Client Component: window.print() on mount
src/app/admin/remito/[id]/page.tsx            # single remito, auto-prints
src/app/admin/remitos/page.tsx                # all remitos for a fecha+turno, auto-prints

src/app/admin/(dashboard)/excepciones/page.tsx           # ABM listado — Server Component
src/app/admin/(dashboard)/excepciones/actions.ts         # crearExcepcion/actualizarExcepcion/borrarExcepcion
src/app/admin/(dashboard)/excepciones/ExcepcionForm.tsx  # create/edit form (Client)
src/app/admin/(dashboard)/excepciones/ExcepcionesClient.tsx # list UI (Client)
```

---

### Task 1: Data layer — types and admin pedidos helpers

**Files:**
- Modify: `src/lib/types.ts`
- Create: `src/lib/admin/pedidos.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`.
- Produces: `PedidoAdmin`/`ExcepcionCorte` types (from `@/lib/types`); `obtenerPedidosDelDia(fecha: string): Promise<PedidoAdmin[]>`, `obtenerPedidoPorId(id: string): Promise<PedidoAdmin | null>`, `consolidarPreparacion(pedidos: PedidoAdmin[]): ItemPreparacion[]`, `calcularCantidadesAtipicas(pedidos: PedidoAdmin[]): Promise<Set<string>>` (all from `@/lib/admin/pedidos`) — consumed by Tasks 2-6.

- [ ] **Step 1: Add `PedidoAdmin` and `ExcepcionCorte` types**

```ts
// src/lib/types.ts — add these two exports at the end of the file, everything else unchanged
export type PedidoAdmin = {
  id: string
  fecha_entrega: string
  turno_reparto: 'manana' | 'tarde'
  tipo_etiqueta: 'grande' | 'chica' | 'ambas'
  fuera_de_horario: boolean
  creado_en: string
  puntos_venta: {
    id: string
    nombre: string
    direccion: string | null
  } | null
  pedido_items: {
    id: string
    cantidad: number
    producto_id: string
    productos: {
      nombre: string
      categoria: string
      unidad: string
    } | null
  }[]
}

export type ExcepcionCorte = {
  id: string
  fecha: string
  hora_corte: string
  motivo: string | null
  creado_en: string
}
```

- [ ] **Step 2: Admin pedidos helper module**

```ts
// src/lib/admin/pedidos.ts
import { createClient } from '@/lib/supabase/server'
import type { PedidoAdmin } from '@/lib/types'

const SELECT_PEDIDO_ADMIN =
  'id, fecha_entrega, turno_reparto, tipo_etiqueta, fuera_de_horario, creado_en, puntos_venta(id, nombre, direccion), pedido_items(id, cantidad, producto_id, productos(nombre, categoria, unidad))'

export async function obtenerPedidosDelDia(fecha: string): Promise<PedidoAdmin[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_ADMIN)
    .eq('fecha_entrega', fecha)
    .order('creado_en', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PedidoAdmin[]
}

export async function obtenerPedidoPorId(id: string): Promise<PedidoAdmin | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_ADMIN)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as unknown as PedidoAdmin) ?? null
}

export type ItemPreparacion = {
  productoId: string
  nombre: string
  categoria: string
  unidad: string
  cantidadTotal: number
  cantidadPedidos: number
}

/**
 * Suma las cantidades de cada producto entre todos los pedidos dados
 * (pensado para un turno completo), para armar la lista de preparación.
 */
export function consolidarPreparacion(pedidos: PedidoAdmin[]): ItemPreparacion[] {
  const mapa = new Map<string, ItemPreparacion>()

  for (const pedido of pedidos) {
    for (const item of pedido.pedido_items) {
      const producto = item.productos
      if (!producto) continue

      const existente = mapa.get(item.producto_id)
      if (existente) {
        existente.cantidadTotal += item.cantidad
        existente.cantidadPedidos += 1
      } else {
        mapa.set(item.producto_id, {
          productoId: item.producto_id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          unidad: producto.unidad,
          cantidadTotal: item.cantidad,
          cantidadPedidos: 1,
        })
      }
    }
  }

  return Array.from(mapa.values()).sort(
    (a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre)
  )
}

async function obtenerPromedioHistorico(
  puntoVentaId: string,
  productoId: string,
  excluirPedidoId: string
): Promise<number | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedido_items')
    .select('cantidad, pedido_id, pedidos!inner(punto_venta_id)')
    .eq('producto_id', productoId)
    .eq('pedidos.punto_venta_id', puntoVentaId)
    .neq('pedido_id', excluirPedidoId)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return null

  const filas = data as unknown as { cantidad: number }[]
  const total = filas.reduce((acc, fila) => acc + fila.cantidad, 0)
  return total / filas.length
}

/**
 * Devuelve el set de claves "pedidoId:productoId" cuya cantidad es más del
 * doble del promedio histórico de ese producto para ese punto de venta.
 * Sin pedidos previos de ese producto para ese comercio, no hay base de
 * comparación y no se marca (evita falsos positivos en un producto nuevo).
 */
export async function calcularCantidadesAtipicas(pedidos: PedidoAdmin[]): Promise<Set<string>> {
  const atipicos = new Set<string>()
  const promediosCache = new Map<string, number | null>()

  for (const pedido of pedidos) {
    const puntoVentaId = pedido.puntos_venta?.id
    if (!puntoVentaId) continue

    for (const item of pedido.pedido_items) {
      const cacheKey = `${puntoVentaId}:${item.producto_id}`
      let promedio = promediosCache.get(cacheKey)
      if (promedio === undefined) {
        promedio = await obtenerPromedioHistorico(puntoVentaId, item.producto_id, pedido.id)
        promediosCache.set(cacheKey, promedio)
      }
      if (promedio != null && item.cantidad > promedio * 2) {
        atipicos.add(`${pedido.id}:${item.producto_id}`)
      }
    }
  }

  return atipicos
}
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: builds successfully (nothing imports these yet, so this only confirms no TypeScript errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/admin/pedidos.ts
git commit -m "Add admin pedidos data layer (fetch, consolidación, cantidades atípicas)"
```

---

### Task 2: Pedidos page — date navigation, turno split, nav wiring

**Files:**
- Create: `src/app/admin/(dashboard)/pedidos/page.tsx`
- Create: `src/app/admin/(dashboard)/pedidos/TurnoSection.tsx`
- Modify: `src/app/admin/(dashboard)/layout.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `obtenerFechaHoyYManana` from `@/lib/comercio/corte`, `obtenerPedidosDelDia` from `@/lib/admin/pedidos` (Task 1), `PedidoAdmin` from `@/lib/types`.

- [ ] **Step 1: Minimal `TurnoSection` (Task 3 adds the prep list, Task 4 adds badges)**

```tsx
// src/app/admin/(dashboard)/pedidos/TurnoSection.tsx
import type { PedidoAdmin } from '@/lib/types'

export function TurnoSection({
  titulo,
  pedidos,
}: {
  titulo: string
  pedidos: PedidoAdmin[]
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">{titulo}</h2>
      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin pedidos para este turno.</p>
      ) : (
        <ul className="space-y-2">
          {pedidos.map((pedido) => (
            <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <p className="font-medium text-neutral-900">
                {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
              </p>
              <p className="text-sm text-neutral-500">
                {pedido.pedido_items.length} producto(s)
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Pedidos page with date navigation**

```tsx
// src/app/admin/(dashboard)/pedidos/page.tsx
import Link from 'next/link'
import { obtenerFechaHoyYManana } from '@/lib/comercio/corte'
import { obtenerPedidosDelDia } from '@/lib/admin/pedidos'
import { TurnoSection } from './TurnoSection'

function sumarDias(fechaYYYYMMDD: string, dias: number): string {
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>
}) {
  const { fecha: fechaParam } = await searchParams
  const fecha = fechaParam ?? obtenerFechaHoyYManana(new Date()).hoy

  const pedidos = await obtenerPedidosDelDia(fecha)
  const pedidosManana = pedidos.filter((p) => p.turno_reparto === 'manana')
  const pedidosTarde = pedidos.filter((p) => p.turno_reparto === 'tarde')

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Pedidos</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pedidos?fecha=${sumarDias(fecha, -1)}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            ← Anterior
          </Link>
          <span className="text-base font-medium text-neutral-900">{fecha}</span>
          <Link
            href={`/admin/pedidos?fecha=${sumarDias(fecha, 1)}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            Siguiente →
          </Link>
        </div>
      </div>

      <TurnoSection titulo="Turno mañana" pedidos={pedidosManana} />
      <TurnoSection titulo="Turno tarde" pedidos={pedidosTarde} />
    </div>
  )
}
```

- [ ] **Step 3: Add "Pedidos" to the admin nav**

```tsx
// src/app/admin/(dashboard)/layout.tsx
import Link from 'next/link'
import { signOut } from '../login/actions'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <nav className="flex gap-4 text-sm font-medium text-neutral-700">
          <Link href="/admin/pedidos">Pedidos</Link>
          <Link href="/admin/productos">Productos</Link>
          <Link href="/admin/puntos-venta">Puntos de venta</Link>
        </nav>
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

- [ ] **Step 4: Make "Pedidos" the admin's landing screen**

```tsx
// src/app/admin/page.tsx
import { redirect } from 'next/navigation'

export default function AdminRootPage() {
  redirect('/admin/pedidos')
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run build && npm run dev`

Logged in as admin:
1. Go to `http://localhost:3000/admin` → expect redirect to `/admin/pedidos` (previously went to `/admin/productos`).
2. Confirm "Pedidos" appears first in the nav, before "Productos".
3. Using a date where pedidos exist from previous sub-projects' testing (check via the admin's Supabase SQL Editor or the comercio's historial page for the exact `fecha_entrega` values), navigate `/admin/pedidos?fecha=<esa fecha>` → confirm pedidos show up under the right turno with a product count.
4. Click "← Anterior" / "Siguiente →" → confirm the date in the URL and header updates and the list refetches for that date.
5. Navigate to a date with no pedidos → confirm both turnos show "Sin pedidos para este turno" (not a blank page, not hidden sections).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/\(dashboard\)/pedidos src/app/admin/\(dashboard\)/layout.tsx src/app/admin/page.tsx
git commit -m "Add pedidos page with date navigation and turno split"
```

---

### Task 3: Lista de preparación consolidada

**Files:**
- Modify: `src/app/admin/(dashboard)/pedidos/TurnoSection.tsx`

**Interfaces:**
- Consumes: `consolidarPreparacion` from `@/lib/admin/pedidos` (Task 1).

- [ ] **Step 1: Add the consolidated prep list above the individual pedidos**

```tsx
// src/app/admin/(dashboard)/pedidos/TurnoSection.tsx — full file
import type { PedidoAdmin } from '@/lib/types'
import { consolidarPreparacion } from '@/lib/admin/pedidos'

export function TurnoSection({
  titulo,
  pedidos,
}: {
  titulo: string
  pedidos: PedidoAdmin[]
}) {
  const preparacion = consolidarPreparacion(pedidos)

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">{titulo}</h2>
      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin pedidos para este turno.</p>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700">
              Lista de preparación consolidada
            </h3>
            <ul className="space-y-1 text-sm">
              {preparacion.map((item) => (
                <li key={item.productoId} className="flex justify-between">
                  <span>{item.nombre}</span>
                  <span className="text-neutral-500">
                    {item.cantidadTotal} {item.unidad} ({item.cantidadPedidos} pedido(s))
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="space-y-2">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                <p className="font-medium text-neutral-900">
                  {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
                </p>
                <p className="text-sm text-neutral-500">
                  {pedido.pedido_items.length} producto(s)
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

On a date with multiple pedidos in the same turno that share at least one product, confirm the "Lista de preparación consolidada" shows that product ONCE with the summed quantity and the correct "(N pedido(s))" count — cross-check by hand against the individual pedidos below it.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(dashboard)/pedidos/TurnoSection.tsx"
git commit -m "Add lista de preparación consolidada per turno"
```

---

### Task 4: Badges — fuera de horario y cantidad atípica

**Files:**
- Modify: `src/app/admin/(dashboard)/pedidos/page.tsx`
- Modify: `src/app/admin/(dashboard)/pedidos/TurnoSection.tsx`

**Interfaces:**
- Consumes: `calcularCantidadesAtipicas` from `@/lib/admin/pedidos` (Task 1).

- [ ] **Step 1: Compute atípicos once for the whole day and pass down**

```tsx
// src/app/admin/(dashboard)/pedidos/page.tsx — full file
import Link from 'next/link'
import { obtenerFechaHoyYManana } from '@/lib/comercio/corte'
import { obtenerPedidosDelDia, calcularCantidadesAtipicas } from '@/lib/admin/pedidos'
import { TurnoSection } from './TurnoSection'

function sumarDias(fechaYYYYMMDD: string, dias: number): string {
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>
}) {
  const { fecha: fechaParam } = await searchParams
  const fecha = fechaParam ?? obtenerFechaHoyYManana(new Date()).hoy

  const pedidos = await obtenerPedidosDelDia(fecha)
  const pedidosManana = pedidos.filter((p) => p.turno_reparto === 'manana')
  const pedidosTarde = pedidos.filter((p) => p.turno_reparto === 'tarde')
  const atipicos = await calcularCantidadesAtipicas(pedidos)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Pedidos</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pedidos?fecha=${sumarDias(fecha, -1)}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            ← Anterior
          </Link>
          <span className="text-base font-medium text-neutral-900">{fecha}</span>
          <Link
            href={`/admin/pedidos?fecha=${sumarDias(fecha, 1)}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            Siguiente →
          </Link>
        </div>
      </div>

      <TurnoSection titulo="Turno mañana" pedidos={pedidosManana} atipicos={atipicos} />
      <TurnoSection titulo="Turno tarde" pedidos={pedidosTarde} atipicos={atipicos} />
    </div>
  )
}
```

- [ ] **Step 2: Render the badges**

```tsx
// src/app/admin/(dashboard)/pedidos/TurnoSection.tsx — full file
import type { PedidoAdmin } from '@/lib/types'
import { consolidarPreparacion } from '@/lib/admin/pedidos'

export function TurnoSection({
  titulo,
  pedidos,
  atipicos,
}: {
  titulo: string
  pedidos: PedidoAdmin[]
  atipicos: Set<string>
}) {
  const preparacion = consolidarPreparacion(pedidos)

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">{titulo}</h2>
      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin pedidos para este turno.</p>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700">
              Lista de preparación consolidada
            </h3>
            <ul className="space-y-1 text-sm">
              {preparacion.map((item) => (
                <li key={item.productoId} className="flex justify-between">
                  <span>{item.nombre}</span>
                  <span className="text-neutral-500">
                    {item.cantidadTotal} {item.unidad} ({item.cantidadPedidos} pedido(s))
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="space-y-2">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                <p className="font-medium text-neutral-900">
                  {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
                </p>
                {pedido.fuera_de_horario && (
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    ⚠ Fuera de horario
                  </span>
                )}
                <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                  {pedido.pedido_items.map((item) => {
                    const esAtipico = atipicos.has(`${pedido.id}:${item.producto_id}`)
                    return (
                      <li key={item.id} className={esAtipico ? 'font-medium text-amber-800' : ''}>
                        {item.cantidad} {item.productos?.unidad ?? ''} —{' '}
                        {item.productos?.nombre ?? 'Producto'}
                        {esAtipico && <span className="ml-2 text-xs">⚠ Cantidad atípica</span>}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. Find (or confirm via SQL) a pedido with `fuera_de_horario = true` from previous sub-projects' testing, navigate to its date → confirm the amber "⚠ Fuera de horario" badge shows on that pedido.
2. Create a NEW test pedido from the comercio app (`/pedido`) for a product that already has confirmed order history for that punto de venta, using a quantity clearly more than double the historical average (e.g. if past orders were 1kg, order 5kg) → in the admin, navigate to that pedido's `fecha_entrega` → confirm the item shows "⚠ Cantidad atípica" and the historical products with normal quantities do NOT.
3. Confirm a product with NO prior history for that comercio never shows the atípico badge, no matter the quantity (first order sets no baseline).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(dashboard)/pedidos"
git commit -m "Add fuera de horario and cantidad atípica badges"
```

---

### Task 5: Remito imprimible

**Files:**
- Create: `src/app/admin/remito/RemitoContent.tsx`
- Create: `src/app/admin/remito/AutoPrint.tsx`
- Create: `src/app/admin/remito/[id]/page.tsx`
- Create: `src/app/admin/remitos/page.tsx`
- Modify: `src/lib/admin/pedidos.ts` (already has `obtenerPedidoPorId` from Task 1 — no change needed here, just confirming the dependency)
- Modify: `src/app/admin/(dashboard)/pedidos/TurnoSection.tsx`

**Interfaces:**
- Consumes: `obtenerPedidoPorId`/`obtenerPedidosDelDia` from `@/lib/admin/pedidos` (Task 1), `PedidoAdmin` from `@/lib/types`.
- Produces: `RemitoContent` component, `AutoPrint` component (both from `@/app/admin/remito/...`).

- [ ] **Step 1: Shared printable remito markup (Server Component, no interactivity)**

```tsx
// src/app/admin/remito/RemitoContent.tsx
import type { PedidoAdmin } from '@/lib/types'

const ETIQUETA_LABEL: Record<PedidoAdmin['tipo_etiqueta'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export function RemitoContent({ pedido }: { pedido: PedidoAdmin }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-neutral-900">
        {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
      </h2>
      {pedido.puntos_venta?.direccion && (
        <p className="text-sm text-neutral-600">{pedido.puntos_venta.direccion}</p>
      )}
      <p className="mt-2 text-sm text-neutral-900">
        Fecha de entrega: <strong>{pedido.fecha_entrega}</strong> · Turno:{' '}
        <strong>{pedido.turno_reparto === 'manana' ? 'Mañana' : 'Tarde'}</strong>
      </p>
      <p className="text-sm text-neutral-900">
        Etiqueta: <strong>{ETIQUETA_LABEL[pedido.tipo_etiqueta]}</strong>
      </p>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="py-1">Producto</th>
            <th className="py-1 text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {pedido.pedido_items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-100">
              <td className="py-1">{item.productos?.nombre ?? 'Producto'}</td>
              <td className="py-1 text-right">
                {item.cantidad} {item.productos?.unidad ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Auto-print trigger (the only Client Component in this task)**

```tsx
// src/app/admin/remito/AutoPrint.tsx
'use client'

import { useEffect } from 'react'

export function AutoPrint() {
  useEffect(() => {
    window.print()
  }, [])

  return null
}
```

- [ ] **Step 3: Single remito route**

```tsx
// src/app/admin/remito/[id]/page.tsx
import { notFound } from 'next/navigation'
import { obtenerPedidoPorId } from '@/lib/admin/pedidos'
import { RemitoContent } from '../RemitoContent'
import { AutoPrint } from '../AutoPrint'

export default async function RemitoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pedido = await obtenerPedidoPorId(id)
  if (!pedido) notFound()

  return (
    <div className="bg-white">
      <RemitoContent pedido={pedido} />
      <AutoPrint />
    </div>
  )
}
```

- [ ] **Step 4: Batch remitos for a fecha + turno**

```tsx
// src/app/admin/remitos/page.tsx
import { obtenerPedidosDelDia } from '@/lib/admin/pedidos'
import { RemitoContent } from '../remito/RemitoContent'
import { AutoPrint } from '../remito/AutoPrint'

export default async function RemitosDelTurnoPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; turno?: string }>
}) {
  const { fecha, turno } = await searchParams

  if (!fecha || (turno !== 'manana' && turno !== 'tarde')) {
    return <p className="p-6 text-neutral-500">Falta la fecha o el turno.</p>
  }

  const pedidos = await obtenerPedidosDelDia(fecha)
  const delTurno = pedidos.filter((p) => p.turno_reparto === turno)

  return (
    <div className="bg-white">
      {delTurno.map((pedido) => (
        <div key={pedido.id} className="break-after-page">
          <RemitoContent pedido={pedido} />
        </div>
      ))}
      {delTurno.length === 0 && (
        <p className="p-6 text-neutral-500">Sin pedidos para imprimir.</p>
      )}
      <AutoPrint />
    </div>
  )
}
```

- [ ] **Step 5: Wire the print links into `TurnoSection`**

```tsx
// src/app/admin/(dashboard)/pedidos/TurnoSection.tsx — full file
import type { PedidoAdmin } from '@/lib/types'
import { consolidarPreparacion } from '@/lib/admin/pedidos'

export function TurnoSection({
  titulo,
  fecha,
  turno,
  pedidos,
  atipicos,
}: {
  titulo: string
  fecha: string
  turno: 'manana' | 'tarde'
  pedidos: PedidoAdmin[]
  atipicos: Set<string>
}) {
  const preparacion = consolidarPreparacion(pedidos)

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">{titulo}</h2>
        {pedidos.length > 0 && (
          <a
            href={`/admin/remitos?fecha=${fecha}&turno=${turno}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            Imprimir todos los remitos
          </a>
        )}
      </div>

      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin pedidos para este turno.</p>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700">
              Lista de preparación consolidada
            </h3>
            <ul className="space-y-1 text-sm">
              {preparacion.map((item) => (
                <li key={item.productoId} className="flex justify-between">
                  <span>{item.nombre}</span>
                  <span className="text-neutral-500">
                    {item.cantidadTotal} {item.unidad} ({item.cantidadPedidos} pedido(s))
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="space-y-2">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-neutral-900">
                    {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
                  </p>
                  <a
                    href={`/admin/remito/${pedido.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Imprimir remito
                  </a>
                </div>
                {pedido.fuera_de_horario && (
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    ⚠ Fuera de horario
                  </span>
                )}
                <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                  {pedido.pedido_items.map((item) => {
                    const esAtipico = atipicos.has(`${pedido.id}:${item.producto_id}`)
                    return (
                      <li key={item.id} className={esAtipico ? 'font-medium text-amber-800' : ''}>
                        {item.cantidad} {item.productos?.unidad ?? ''} —{' '}
                        {item.productos?.nombre ?? 'Producto'}
                        {esAtipico && <span className="ml-2 text-xs">⚠ Cantidad atípica</span>}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Pass the new `fecha`/`turno` props from the page**

```tsx
// src/app/admin/(dashboard)/pedidos/page.tsx — only the two <TurnoSection> call sites change
      <TurnoSection titulo="Turno mañana" fecha={fecha} turno="manana" pedidos={pedidosManana} atipicos={atipicos} />
      <TurnoSection titulo="Turno tarde" fecha={fecha} turno="tarde" pedidos={pedidosTarde} atipicos={atipicos} />
```

Everything else in `page.tsx` stays exactly as Task 4 left it.

- [ ] **Step 7: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. On `/admin/pedidos` for a date with pedidos, click "Imprimir remito" on one → confirm it opens a new tab showing only the remito content (no admin nav/header), with the browser's print dialog opening automatically.
2. Close the print dialog, confirm the remito content itself (comercio, dirección, fecha, turno, etiqueta, items) matches that pedido's real data.
3. Back on `/admin/pedidos`, click "Imprimir todos los remitos" for a turno with 2+ pedidos → confirm the new tab shows all of them, each on what would be a separate printed page (check via the browser's print preview — look for the page break between pedidos).
4. Visit `/admin/remitos` with no query params → confirm the "Falta la fecha o el turno" message, not a crash.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/remito src/app/admin/remitos "src/app/admin/(dashboard)/pedidos"
git commit -m "Add printable remitos (individual and per-turno batch)"
```

---

### Task 6: Excepciones de corte ABM

**Files:**
- Create: `src/app/admin/(dashboard)/excepciones/actions.ts`
- Create: `src/app/admin/(dashboard)/excepciones/page.tsx`
- Create: `src/app/admin/(dashboard)/excepciones/ExcepcionForm.tsx`
- Create: `src/app/admin/(dashboard)/excepciones/ExcepcionesClient.tsx`
- Modify: `src/app/admin/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `ActionResult`/`ExcepcionCorte` from `@/lib/types` (Task 1).
- Produces: `ExcepcionCorteInput` type, `crearExcepcion`/`actualizarExcepcion`/`borrarExcepcion` from `./actions`.

- [ ] **Step 1: Server Actions**

```ts
// src/app/admin/(dashboard)/excepciones/actions.ts
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
```

- [ ] **Step 2: Form component**

```tsx
// src/app/admin/(dashboard)/excepciones/ExcepcionForm.tsx
'use client'

import { useState, type FormEvent } from 'react'
import type { ActionResult, ExcepcionCorte } from '@/lib/types'
import type { ExcepcionCorteInput } from './actions'

export function ExcepcionForm({
  excepcion,
  onSubmit,
  onCancel,
}: {
  excepcion?: ExcepcionCorte
  onSubmit: (input: ExcepcionCorteInput) => Promise<ActionResult>
  onCancel: () => void
}) {
  const [fecha, setFecha] = useState(excepcion?.fecha ?? '')
  const [horaCorte, setHoraCorte] = useState(excepcion?.hora_corte ?? '09:00')
  const [motivo, setMotivo] = useState(excepcion?.motivo ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const result = await onSubmit({
      fecha,
      hora_corte: horaCorte,
      motivo: motivo || null,
    })
    if ('error' in result) {
      setError(
        result.error.includes('duplicate key')
          ? 'Ya hay una excepción cargada para esa fecha.'
          : result.error
      )
      setGuardando(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
    >
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Hora de corte</label>
        <input
          type="time"
          value={horaCorte}
          onChange={(e) => setHoraCorte(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Motivo (opcional)
        </label>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: Feriado 9 de julio"
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-4 py-2.5 text-base font-medium text-neutral-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: List UI client component**

```tsx
// src/app/admin/(dashboard)/excepciones/ExcepcionesClient.tsx
'use client'

import { useState } from 'react'
import type { ExcepcionCorte } from '@/lib/types'
import { ExcepcionForm } from './ExcepcionForm'
import {
  crearExcepcion,
  actualizarExcepcion,
  borrarExcepcion,
  type ExcepcionCorteInput,
} from './actions'

export function ExcepcionesClient({ excepciones }: { excepciones: ExcepcionCorte[] }) {
  const [modo, setModo] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editando, setEditando] = useState<ExcepcionCorte | null>(null)

  async function handleCrear(input: ExcepcionCorteInput) {
    const result = await crearExcepcion(input)
    if ('success' in result) setModo('lista')
    return result
  }

  async function handleActualizar(input: ExcepcionCorteInput) {
    if (!editando) return { error: 'No hay excepción seleccionada' }
    const result = await actualizarExcepcion(editando.id, input)
    if ('success' in result) {
      setModo('lista')
      setEditando(null)
    }
    return result
  }

  async function handleBorrar(id: string) {
    const result = await borrarExcepcion(id)
    if ('error' in result) alert(result.error)
  }

  if (modo === 'nuevo') {
    return <ExcepcionForm onSubmit={handleCrear} onCancel={() => setModo('lista')} />
  }

  if (modo === 'editar' && editando) {
    return (
      <ExcepcionForm
        excepcion={editando}
        onSubmit={handleActualizar}
        onCancel={() => {
          setModo('lista')
          setEditando(null)
        }}
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Excepciones de corte</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white hover:bg-neutral-800"
        >
          + Nueva excepción
        </button>
      </div>

      <ul className="space-y-2">
        {excepciones.map((excepcion) => (
          <li
            key={excepcion.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-[10rem] flex-1">
              <p className="font-medium text-neutral-900">{excepcion.fecha}</p>
              <p className="text-sm text-neutral-500">
                Corte: {excepcion.hora_corte}
                {excepcion.motivo && ` · ${excepcion.motivo}`}
              </p>
            </div>
            <button
              onClick={() => {
                setEditando(excepcion)
                setModo('editar')
              }}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Editar
            </button>
            <button
              onClick={() => handleBorrar(excepcion.id)}
              className="text-sm font-medium text-red-600 hover:text-red-800"
            >
              Borrar
            </button>
          </li>
        ))}
        {excepciones.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No hay excepciones cargadas.</p>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Page**

```tsx
// src/app/admin/(dashboard)/excepciones/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { ExcepcionCorte } from '@/lib/types'
import { ExcepcionesClient } from './ExcepcionesClient'

export default async function ExcepcionesPage() {
  const supabase = await createClient()
  const { data: excepciones, error } = await supabase
    .from('excepciones_corte')
    .select('*')
    .order('fecha', { ascending: false })

  if (error) throw new Error(error.message)

  return <ExcepcionesClient excepciones={(excepciones ?? []) as ExcepcionCorte[]} />
}
```

- [ ] **Step 5: Add the nav link**

```tsx
// src/app/admin/(dashboard)/layout.tsx — full file
import Link from 'next/link'
import { signOut } from '../login/actions'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <nav className="flex gap-4 text-sm font-medium text-neutral-700">
          <Link href="/admin/pedidos">Pedidos</Link>
          <Link href="/admin/productos">Productos</Link>
          <Link href="/admin/puntos-venta">Puntos de venta</Link>
          <Link href="/admin/excepciones">Excepciones de corte</Link>
        </nav>
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

- [ ] **Step 6: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. Go to `/admin/excepciones`, create a new one for a near-future date with a custom hora de corte (e.g. `07:00`) and a motivo — confirm it appears in the list.
2. Try creating a second excepción for the SAME fecha → expect the friendly "Ya hay una excepción cargada para esa fecha" error (confirms the DB unique constraint on `fecha` is enforced).
3. Edit the one you created, change the hora — confirm it saves.
4. Borrar it — confirm it disappears from the list (hard delete, no "activo" field on this table).
5. **End-to-end check of the exception actually taking effect:** with a fresh excepción loaded for tomorrow's date, go to the comercio app, add items to cart, go to confirmar, select "Mañana" — the corte bar doesn't apply to "mañana" (per the prior sub-project's design), so this only visibly changes behavior for "Hoy" on the exception's exact date. If you want to see it live, load an excepción for TODAY with a cutoff time close to the current time, then check `/pedido/confirmar` shows the adjusted cutoff in the bar's "Corte de pedidos: HH:mm" label.

- [ ] **Step 7: Commit**

```bash
git add "src/app/admin/(dashboard)/excepciones" "src/app/admin/(dashboard)/layout.tsx"
git commit -m "Add excepciones de corte ABM"
```

---

### Task 7: End-to-end smoke test and deploy

**Files:** none (verification only)

- [ ] **Step 1: Full build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed with no errors.

- [ ] **Step 2: Push to trigger the production deploy**

```bash
git push origin main
```

(If this fails with a 403 due to the cached-credential issue from previous sub-projects, push with an explicit token: `git push "https://<TOKEN>@github.com/maestriaarg-web/doncarmelo.git" main:main` — never with `-u`, it leaks the token into `.git/config`.)

- [ ] **Step 3: End-to-end manual test against production**

At `https://doncarmelo.vercel.app`:
1. Log in as admin, confirm `/admin` now lands on `/admin/pedidos` with the full nav (Pedidos, Productos, Puntos de venta, Excepciones de corte).
2. Navigate to a date with real confirmed pedidos from previous sub-projects' testing → confirm both turnos render correctly with the consolidated prep list and individual pedidos.
3. Confirm any `fuera_de_horario` pedido shows its badge.
4. Print a single remito and a full turno's remitos — confirm both open correctly in a new tab with no admin chrome and trigger the browser's print dialog.
5. Create one more real pedido from the comercio app with a deliberately large quantity of a product that has history for that comercio → confirm the "⚠ Cantidad atípica" badge appears for that item in `/admin/pedidos`.
6. Create an excepción de corte for today with a cutoff a few minutes from now, then check `/pedido/confirmar` (as that same comercio) reflects the new cutoff time in the bar.
7. Confirm nothing in the existing admin ABM (`/admin/productos`, `/admin/puntos-venta`) or the comercio app broke — quick click-through of both.

- [ ] **Step 4: Report status**

No commit needed for this task — it's the final verification gate. This closes Fase 1 of the original project brief entirely: admin ABM, comercio ordering flow, historial/repetir/frecuentes/countdown, and now full admin order management (pedidos por turno, preparación, remitos, avisos, excepciones).
