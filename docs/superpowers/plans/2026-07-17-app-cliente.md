# App Cliente (catálogo + carrito + corte automático) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the comercio-facing ordering flow — access by phone number, category-grouped catalog with search, a cart, and a confirmation step that computes the delivery date/shift (turno) automatically per the 9am cutoff rule, never trusting the client for that calculation.

**Architecture:** Same Next.js App Router app as the admin panel, but comercios never get a Supabase Auth session — access is a signed-free httpOnly cookie holding `punto_venta_id`, validated by extending the existing `proxy.ts`. All comercio-facing reads/writes go through a service-role Supabase client (bypasses RLS deliberately, since there's no per-request Supabase session to carry). The cart lives entirely in the browser (`sessionStorage`) until the order is confirmed; only then does anything get written to `pedidos`/`pedido_items`, computed fresh server-side.

**Tech Stack:** Same as the admin panel — Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind v4, `@supabase/supabase-js` (service-role client, new usage — the admin panel only used `@supabase/ssr` so far).

## Global Constraints

- Next.js 16.2.10 / React 19.2.4 / TypeScript / Tailwind v4 — already installed, do not change versions. Route handlers/pages use `export function proxy` in `src/proxy.ts`, not `middleware.ts` (deprecated on this Next version).
- No persisted automated test suite (standing project decision, reconfirmed in the spec for this sub-project) — but Task 1's `calcularTurno` logic gets a rigorous one-off manual verification script (not committed) given how easy time/timezone logic is to get subtly wrong.
- **Timezone:** every "is it before/after the cutoff" comparison must use Argentina time (`America/Argentina/Buenos_Aires`, UTC-3, no DST) via the `Intl` API — never rely on the server's local/UTC time directly. Vercel serverless functions run in UTC by default.
- **Cutoff rule:** default `hora_corte` is `09:00`; the afternoon delivery window closes at `20:00` (from the original brief: "reparto de la tarde 17 a 20hs"). Both are Argentina local times.
- **Never trust the client for turno/fecha/price.** The `/pedido/confirmar` page shows a client-computed *preview* of the turno for UX, but `confirmarPedido` (the Server Action that actually writes to the DB) recomputes everything from scratch server-side — the client only sends product IDs, quantities, the `'hoy'|'manana'` choice, and the etiqueta type.
- **Server Actions that can fail must return `{error: string} | {success: true}` (the `ActionResult` pattern), never `throw`.** Next.js redacts thrown Server Action error messages in production builds (discovered and fixed in the previous sub-project) — this is not optional stylistic guidance, it's a correctness requirement.
- Comercio session is a separate mechanism from admin's Supabase Auth — a plain (unsigned) httpOnly cookie holding the `punto_venta_id` UUID. This is acceptable because UUIDs from `gen_random_uuid()` have 122 bits of randomness (unguessable) and the cookie is httpOnly + secure + sameSite=lax, transmitted only over HTTPS (Vercel enforces this). Do not add session signing/JWTs — that would be over-engineering for this system's actual risk profile.
- Mobile-first sizing: inputs/buttons at least `py-2.5`, `text-base` minimum for inputs. (Two previous tasks in the last sub-project shipped with `py-2` by mistake and needed a follow-up fix — write it correctly the first time here.)
- `puntos_venta.celular` (renamed from `codigo_acceso`) stores digits-only, normalized by stripping everything non-numeric. Any code that reads a phone number from user input (admin form, comercio access form) must normalize the same way before comparing/storing.
- `productos` and `puntos_venta` already exist with data from the admin panel; `pedidos`/`pedido_items`/`excepciones_corte` already exist as empty tables from the initial migration — no new migrations needed for this sub-project.

---

## File Structure

```
src/lib/comercio/constants.ts        # shared cookie name constant (no next/headers import — safe for proxy.ts)
src/lib/comercio/session.ts          # get/set the comercio's punto_venta_id cookie
src/lib/comercio/corte.ts            # pure functions: calcularTurno, obtenerFechaHoyYManana
src/lib/supabase/service.ts          # service-role Supabase client (server-only, bypasses RLS)
src/lib/types.ts                     # (modify) add ItemCarrito type

src/proxy.ts                         # (modify) add /pedido/* guard alongside existing /admin/* guard
src/app/layout.tsx                   # (modify) fix metadata title/lang, still "Create Next App" placeholder
src/app/page.tsx                     # (modify) replace default Next.js starter with the acceso (phone entry) screen
src/app/actions.ts                   # ingresarConCelular Server Action

src/app/pedido/page.tsx              # catálogo — Server Component fetch
src/app/pedido/CatalogoClient.tsx    # catálogo — search, category sections, cart (sessionStorage)

src/app/pedido/confirmar/page.tsx           # confirmar — Server Component fetch
src/app/pedido/confirmar/actions.ts         # confirmarPedido Server Action
src/app/pedido/confirmar/ConfirmarClient.tsx # confirmar — cart review, fecha/turno preview, etiqueta, submit

src/app/pedido/listo/page.tsx        # confirmación final (Client Component, reads sessionStorage)
```

---

### Task 1: Core utilities — comercio session, service-role client, corte calculation

**Files:**
- Create: `src/lib/comercio/constants.ts`
- Create: `src/lib/comercio/session.ts`
- Create: `src/lib/comercio/corte.ts`
- Create: `src/lib/supabase/service.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `COMERCIO_COOKIE_NAME` (string constant), `getPuntoVentaId()`, `setPuntoVentaCookie(id: string)` (both async, from `@/lib/comercio/session`), `calcularTurno(eleccion: 'hoy'|'manana', ahora: Date, excepciones: Record<string,string>): ResultadoCorte` and `obtenerFechaHoyYManana(ahora: Date): {hoy: string, manana: string}` (from `@/lib/comercio/corte`), `createServiceClient()` (from `@/lib/supabase/service`), `ItemCarrito` type (from `@/lib/types`).

- [ ] **Step 1: Cookie name constant (importable from proxy.ts's edge runtime — no `next/headers`)**

```ts
// src/lib/comercio/constants.ts
export const COMERCIO_COOKIE_NAME = 'don_carmelo_pv'
```

- [ ] **Step 2: Comercio session cookie helpers**

```ts
// src/lib/comercio/session.ts
import { cookies } from 'next/headers'
import { COMERCIO_COOKIE_NAME } from './constants'

const CINCO_ANIOS_EN_SEGUNDOS = 60 * 60 * 24 * 365 * 5

export async function getPuntoVentaId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COMERCIO_COOKIE_NAME)?.value ?? null
}

export async function setPuntoVentaCookie(puntoVentaId: string) {
  const cookieStore = await cookies()
  cookieStore.set(COMERCIO_COOKIE_NAME, puntoVentaId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: CINCO_ANIOS_EN_SEGUNDOS,
    path: '/',
  })
}
```

- [ ] **Step 3: Corte calculation (pure functions, Argentina timezone)**

```ts
// src/lib/comercio/corte.ts
const TIMEZONE = 'America/Argentina/Buenos_Aires'
const HORA_CORTE_DEFAULT = '09:00'
const HORA_CIERRE_TARDE = '20:00'

export type ResultadoCorte = {
  fechaEntrega: string // YYYY-MM-DD
  turno: 'manana' | 'tarde'
  fueraDeHorario: boolean
}

function formatearFechaArgentina(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(fecha)
}

function formatearHoraArgentina(fecha: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha)
}

function sumarUnDia(fechaYYYYMMDD: string): string {
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

export function obtenerFechaHoyYManana(ahora: Date): { hoy: string; manana: string } {
  const hoy = formatearFechaArgentina(ahora)
  return { hoy, manana: sumarUnDia(hoy) }
}

/**
 * Calcula el turno de reparto. `excepciones` es un mapa fecha (YYYY-MM-DD) -> hora_corte (HH:mm)
 * para las fechas relevantes (hoy y mañana) según lo que haya en `excepciones_corte`.
 */
export function calcularTurno(
  eleccion: 'hoy' | 'manana',
  ahora: Date,
  excepciones: Record<string, string>
): ResultadoCorte {
  const { hoy, manana } = obtenerFechaHoyYManana(ahora)

  if (eleccion === 'manana') {
    return { fechaEntrega: manana, turno: 'manana', fueraDeHorario: false }
  }

  const horaActual = formatearHoraArgentina(ahora)
  const horaCorteHoy = excepciones[hoy] ?? HORA_CORTE_DEFAULT

  if (horaActual < horaCorteHoy) {
    return { fechaEntrega: hoy, turno: 'manana', fueraDeHorario: false }
  }
  if (horaActual < HORA_CIERRE_TARDE) {
    return { fechaEntrega: hoy, turno: 'tarde', fueraDeHorario: true }
  }
  // Ya cerró todo reparto de hoy: se empuja a mañana.
  return { fechaEntrega: manana, turno: 'manana', fueraDeHorario: false }
}
```

- [ ] **Step 4: Service-role Supabase client (server-only)**

```ts
// src/lib/supabase/service.ts
import { createClient } from '@supabase/supabase-js'

// Server-only: never import this file from a 'use client' component.
// Bypasses RLS — used for comercio-facing queries, which have no Supabase Auth
// session to carry (comercios authenticate via a plain cookie, not Supabase Auth).
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 5: Add `ItemCarrito` type**

```ts
// src/lib/types.ts — add this export, keep everything else in the file unchanged
export type ItemCarrito = {
  productoId: string
  nombre: string
  unidad: string
  precioSugerido: number | null
  cantidad: number
}
```

- [ ] **Step 6: Verify `calcularTurno` rigorously (one-off script, not committed)**

This logic is the riskiest part of the whole sub-project — verify it explicitly against fixed timestamps before moving on, since UTC-vs-Argentina-time bugs are easy to introduce and easy to miss with casual manual testing.

Create a temporary file at `scripts/tmp-verificar-corte.ts`:

```ts
import { calcularTurno } from '../src/lib/comercio/corte'

function verificar(nombre: string, resultado: unknown, esperado: unknown) {
  const ok = JSON.stringify(resultado) === JSON.stringify(esperado)
  console.log(`${ok ? '✅' : '❌'} ${nombre}`)
  if (!ok) {
    console.log('  esperado:', JSON.stringify(esperado))
    console.log('  obtenido:', JSON.stringify(resultado))
  }
}

// 11:30 UTC = 08:30 Argentina (UTC-3) — antes del corte de las 9am
verificar(
  'hoy, 08:30 ART (antes del corte) -> turno mañana',
  calcularTurno('hoy', new Date('2026-07-17T11:30:00Z'), {}),
  { fechaEntrega: '2026-07-17', turno: 'manana', fueraDeHorario: false }
)

// 12:01 UTC = 09:01 Argentina — justo después del corte
verificar(
  'hoy, 09:01 ART (justo después del corte) -> turno tarde',
  calcularTurno('hoy', new Date('2026-07-17T12:01:00Z'), {}),
  { fechaEntrega: '2026-07-17', turno: 'tarde', fueraDeHorario: true }
)

// 23:05 UTC = 20:05 Argentina — después del cierre de la tarde
verificar(
  'hoy, 20:05 ART (después del cierre) -> se empuja a mañana',
  calcularTurno('hoy', new Date('2026-07-17T23:05:00Z'), {}),
  { fechaEntrega: '2026-07-18', turno: 'manana', fueraDeHorario: false }
)

// Elegir "mañana" siempre da turno mañana, sin importar la hora actual
verificar(
  'mañana, 15:00 ART -> siempre turno mañana',
  calcularTurno('manana', new Date('2026-07-17T18:00:00Z'), {}),
  { fechaEntrega: '2026-07-18', turno: 'manana', fueraDeHorario: false }
)

// Excepción de corte cargada para hoy a las 07:00 -> a las 07:30 ya es tarde
verificar(
  'hoy, 07:30 ART con excepción de corte a las 07:00 -> turno tarde',
  calcularTurno('hoy', new Date('2026-07-17T10:30:00Z'), { '2026-07-17': '07:00' }),
  { fechaEntrega: '2026-07-17', turno: 'tarde', fueraDeHorario: true }
)
```

Run: `npx --yes tsx scripts/tmp-verificar-corte.ts`
Expected: all 5 lines print `✅`. If any prints `❌`, fix `src/lib/comercio/corte.ts` before continuing — do not proceed with a failing case.

Then delete the temporary file: `rm scripts/tmp-verificar-corte.ts` (Windows/PowerShell: `Remove-Item scripts/tmp-verificar-corte.ts`). Confirm with `git status` that nothing under `scripts/` is staged from this step.

- [ ] **Step 7: Build check**

Run: `npm run build`
Expected: builds successfully (these files aren't wired into any route yet, so this only confirms no TypeScript errors).

- [ ] **Step 8: Commit**

```bash
git add src/lib/comercio src/lib/supabase/service.ts src/lib/types.ts
git commit -m "Add comercio session, service-role client, and corte calculation utilities"
```

---

### Task 2: Route guard for /pedido/* and the phone-number access screen

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/actions.ts`

**Interfaces:**
- Consumes: `COMERCIO_COOKIE_NAME` from `@/lib/comercio/constants`, `getPuntoVentaId`/`setPuntoVentaCookie` from `@/lib/comercio/session`, `createServiceClient` from `@/lib/supabase/service` (Task 1).
- Produces: `ingresarConCelular(formData: FormData)` Server Action from `@/app/actions`, consumed by this task's own `page.tsx`.

- [ ] **Step 1: Extend the proxy to guard `/pedido/*` with the comercio cookie**

```ts
// src/proxy.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { COMERCIO_COOKIE_NAME } from '@/lib/comercio/constants'

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
    url.pathname = '/admin/productos'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/pedido/:path*'],
}
```

Note: this only checks that the cookie *exists* — it does not verify the punto_venta is still active on every request (that would mean a DB call in the proxy on every navigation). `page.tsx` (Step 3 below) re-checks validity when there's no deeper page to redirect to, and `confirmarPedido` (Task 5) always re-validates `activo = true` before writing anything. This is an intentional, documented trade-off, not an oversight.

- [ ] **Step 2: Fix root layout metadata (still the create-next-app placeholder)**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Almacén Don Carmelo — Pedidos",
  description: "Sistema de pedidos B2B de Almacén Don Carmelo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Access (phone number) Server Action**

```ts
// src/app/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { setPuntoVentaCookie } from '@/lib/comercio/session'

function normalizarCelular(celular: string): string {
  return celular.replace(/\D/g, '')
}

export async function ingresarConCelular(formData: FormData) {
  const celular = normalizarCelular(String(formData.get('celular') ?? ''))

  if (!celular) {
    redirect('/?error=' + encodeURIComponent('Ingresá un número de celular.'))
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('puntos_venta')
    .select('id')
    .eq('celular', celular)
    .eq('activo', true)
    .maybeSingle()

  if (!data) {
    redirect(
      '/?error=' +
        encodeURIComponent('No encontramos ese número. Verificalo o contactá a Don Carmelo.')
    )
  }

  await setPuntoVentaCookie(data.id)
  redirect('/pedido')
}
```

- [ ] **Step 4: Replace the default root page with the access screen**

```tsx
// src/app/page.tsx
import { redirect } from 'next/navigation'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { createServiceClient } from '@/lib/supabase/service'
import { ingresarConCelular } from './actions'

export default async function AccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const puntoVentaId = await getPuntoVentaId()

  if (puntoVentaId) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('puntos_venta')
      .select('id')
      .eq('id', puntoVentaId)
      .eq('activo', true)
      .maybeSingle()

    if (data) redirect('/pedido')
  }

  const { error } = await searchParams

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-neutral-50 px-4">
      <form
        action={ingresarConCelular}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-2 text-xl font-semibold text-neutral-900">Almacén Don Carmelo</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Ingresá tu número de celular para hacer tu pedido.
        </p>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <label className="mb-1 block text-sm font-medium text-neutral-700">Celular</label>
        <input
          type="tel"
          name="celular"
          required
          placeholder="3492 40-1234"
          className="mb-6 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />

        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white hover:bg-neutral-800"
        >
          Ingresar
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run build && npm run dev`

In the browser:
1. Go to `http://localhost:3000/pedido` without any cookie → expect redirect to `/`.
2. On `/`, submit a celular that doesn't exist in `puntos_venta` → expect redirect back to `/` with the "No encontramos ese número" message.
3. Submit the real celular of the test `puntos_venta` row created in the previous sub-project (the one now under `celular`, e.g. whatever `Almacén Sur`'s value is) → expect redirect to `/pedido`, which will show Next's default 404 for now (Task 3 builds that route — expected at this point).
4. Go back to `/` directly while the cookie is set → expect immediate redirect to `/pedido` (not the form).

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/app/layout.tsx src/app/page.tsx src/app/actions.ts
git commit -m "Add /pedido route guard and phone-number access screen"
```

---

### Task 3: Catálogo — Server Component fetch

**Files:**
- Create: `src/app/pedido/page.tsx`

**Interfaces:**
- Consumes: `createServiceClient` from `@/lib/supabase/service`, `Producto` type from `@/lib/types`.

- [ ] **Step 1: Minimal list page (Task 4 replaces the body with the full client UI)**

```tsx
// src/app/pedido/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import type { Producto } from '@/lib/types'

export default async function CatalogoPage() {
  const supabase = createServiceClient()
  const { data: productos, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  const lista = (productos ?? []) as Producto[]

  return (
    <div className="p-4">
      <h1 className="mb-2 text-xl font-semibold text-neutral-900">Catálogo</h1>
      <p className="text-sm text-neutral-500">{lista.length} producto(s) disponibles.</p>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run build && npm run dev`

With the access cookie set (from Task 2's verification), go to `http://localhost:3000/pedido` → expect "Catálogo" heading and a count matching however many `productos` rows exist with `activo = true`.

- [ ] **Step 3: Commit**

```bash
git add src/app/pedido/page.tsx
git commit -m "Add catálogo page (server fetch)"
```

---

### Task 4: Catálogo — search, category sections, cart

**Files:**
- Create: `src/app/pedido/CatalogoClient.tsx`
- Modify: `src/app/pedido/page.tsx`

**Interfaces:**
- Consumes: `Producto` from `@/lib/types`, `ItemCarrito` from `@/lib/types` (Task 1).

- [ ] **Step 1: Client component — search, category grouping, cart in sessionStorage**

```tsx
// src/app/pedido/CatalogoClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Producto, ItemCarrito } from '@/lib/types'

const CARRITO_KEY = 'don_carmelo_carrito'

export function CatalogoClient({ productos }: { productos: Producto[] }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    const guardado = sessionStorage.getItem(CARRITO_KEY)
    if (guardado) {
      try {
        setCarrito(JSON.parse(guardado))
      } catch {
        // carrito corrupto en sessionStorage, se ignora y arranca vacío
      }
    }
    setCargado(true)
  }, [])

  useEffect(() => {
    if (cargado) sessionStorage.setItem(CARRITO_KEY, JSON.stringify(carrito))
  }, [carrito, cargado])

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return productos
    return productos.filter((p) => p.nombre.toLowerCase().includes(termino))
  }, [productos, busqueda])

  const categorias = useMemo(() => {
    const mapa = new Map<string, Producto[]>()
    for (const p of productosFiltrados) {
      const lista = mapa.get(p.categoria) ?? []
      lista.push(p)
      mapa.set(p.categoria, lista)
    }
    return Array.from(mapa.entries())
  }, [productosFiltrados])

  function cantidadEnCarrito(productoId: string): number {
    return carrito.find((i) => i.productoId === productoId)?.cantidad ?? 0
  }

  function actualizarCantidad(producto: Producto, cantidad: number) {
    setCarrito((actual) => {
      const sinEste = actual.filter((i) => i.productoId !== producto.id)
      if (cantidad <= 0) return sinEste
      return [
        ...sinEste,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          unidad: producto.unidad,
          precioSugerido: producto.precio_sugerido,
          cantidad,
        },
      ]
    })
  }

  const totalItems = carrito.reduce((acc, i) => acc + i.cantidad, 0)
  const totalPrecio = carrito.reduce(
    (acc, i) => acc + (i.precioSugerido != null ? i.precioSugerido * i.cantidad : 0),
    0
  )

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 bg-neutral-50 px-4 pb-3 pt-4">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div className="px-4">
        {categorias.map(([categoria, items]) => (
          <section key={categoria} className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-neutral-900">{categoria}</h2>
            <ul className="space-y-2">
              {items.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
                    !p.disponible ? 'opacity-50' : ''
                  }`}
                >
                  {p.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.foto_url} alt="" className="h-14 w-14 rounded-md object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-md bg-neutral-100" />
                  )}
                  <div className="min-w-[8rem] flex-1">
                    <p
                      className={`font-medium text-neutral-900 ${
                        !p.disponible ? 'line-through' : ''
                      }`}
                    >
                      {p.nombre}{' '}
                      {p.congelado && <span className="text-xs text-blue-600">❄ congelado</span>}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {p.unidad}
                      {p.precio_sugerido != null && ` · $${p.precio_sugerido}`}
                    </p>
                  </div>
                  {p.disponible ? (
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={cantidadEnCarrito(p.id) || ''}
                      onChange={(e) => actualizarCantidad(p, Number(e.target.value))}
                      placeholder="0"
                      className="w-20 rounded-md border border-neutral-300 px-2 py-2.5 text-center text-base"
                    />
                  ) : (
                    <span className="text-sm text-neutral-400">Agotado</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {categorias.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No encontramos productos.</p>
        )}
      </div>

      {totalItems > 0 && (
        <button
          onClick={() => router.push('/pedido/confirmar')}
          className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between bg-neutral-900 px-4 py-4 text-base font-medium text-white"
        >
          <span>
            🛒 {totalItems} producto(s) · ${totalPrecio.toFixed(2)}
          </span>
          <span>Ver pedido →</span>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire the page to fetch all `activo` products (including out-of-stock, shown struck-through) and render the client component**

```tsx
// src/app/pedido/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import type { Producto } from '@/lib/types'
import { CatalogoClient } from './CatalogoClient'

export default async function CatalogoPage() {
  const supabase = createServiceClient()
  const { data: productos, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  return <CatalogoClient productos={(productos ?? []) as Producto[]} />
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

With the access cookie set, at `http://localhost:3000/pedido`:
1. Confirm products render grouped under category headings, matching what's in the admin panel.
2. Type into the search box → confirm the list narrows to matching names only, still grouped by category (categories with zero matches disappear).
3. In the admin panel (`/admin/productos`), mark one product as not disponible → refresh `/pedido` → confirm it shows struck-through, greyed, with "Agotado" instead of a quantity input.
4. Enter a quantity for a product → confirm the sticky bottom bar appears showing the right count and total (only counting priced items).
5. Refresh the page → confirm the cart quantity you entered is still there (persisted via `sessionStorage`).
6. Set a product's quantity back to 0 → confirm it's removed from the cart (bar updates or disappears if cart is now empty).

- [ ] **Step 4: Commit**

```bash
git add src/app/pedido
git commit -m "Add catálogo search, category grouping, and cart"
```

---

### Task 5: Confirmar — Server Component fetch + confirmarPedido Server Action

**Files:**
- Create: `src/app/pedido/confirmar/page.tsx`
- Create: `src/app/pedido/confirmar/actions.ts`

**Interfaces:**
- Consumes: `createServiceClient` from `@/lib/supabase/service`, `getPuntoVentaId` from `@/lib/comercio/session`, `calcularTurno`/`obtenerFechaHoyYManana` from `@/lib/comercio/corte` (Task 1), `PuntoVenta`/`Producto`/`ActionResult` from `@/lib/types`.
- Produces: `ConfirmarPedidoInput` type, `ConfirmarPedidoResultado` type, `confirmarPedido(input)` from `./actions`, consumed by Task 6's Client Component.

- [ ] **Step 1: Server Action — recomputes everything server-side, never trusts the client**

```ts
// src/app/pedido/confirmar/actions.ts
'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { calcularTurno, obtenerFechaHoyYManana } from '@/lib/comercio/corte'

export type ConfirmarPedidoInput = {
  items: { productoId: string; cantidad: number }[]
  eleccionFecha: 'hoy' | 'manana'
  tipoEtiqueta: 'grande' | 'chica' | 'ambas'
}

export type ConfirmarPedidoResultado =
  | { error: string }
  | { success: true; fechaEntrega: string; turno: 'manana' | 'tarde' }

export async function confirmarPedido(
  input: ConfirmarPedidoInput
): Promise<ConfirmarPedidoResultado> {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) return { error: 'Sesión inválida, volvé a ingresar tu celular.' }

  if (input.items.length === 0) return { error: 'El carrito está vacío.' }

  const supabase = createServiceClient()

  const { data: puntoVenta, error: errorPuntoVenta } = await supabase
    .from('puntos_venta')
    .select('pedido_minimo, activo')
    .eq('id', puntoVentaId)
    .maybeSingle()

  if (errorPuntoVenta || !puntoVenta || !puntoVenta.activo) {
    return { error: 'Tu punto de venta no está disponible. Contactá a Don Carmelo.' }
  }

  const idsProductos = input.items.map((i) => i.productoId)
  const { data: productos, error: errorProductos } = await supabase
    .from('productos')
    .select('id, precio_sugerido, disponible, activo')
    .in('id', idsProductos)

  if (errorProductos || !productos) return { error: 'No pudimos verificar los productos.' }

  const productosPorId = new Map(productos.map((p) => [p.id, p]))
  let total = 0
  for (const item of input.items) {
    const producto = productosPorId.get(item.productoId)
    if (!producto || !producto.activo || !producto.disponible) {
      return {
        error: 'Alguno de los productos del carrito ya no está disponible. Volvé al catálogo.',
      }
    }
    if (producto.precio_sugerido != null) total += producto.precio_sugerido * item.cantidad
  }

  if (puntoVenta.pedido_minimo != null && total < puntoVenta.pedido_minimo) {
    return {
      error: `El pedido mínimo es $${puntoVenta.pedido_minimo}. Te faltan $${(
        puntoVenta.pedido_minimo - total
      ).toFixed(2)}.`,
    }
  }

  const ahora = new Date()
  const { hoy, manana } = obtenerFechaHoyYManana(ahora)

  const { data: filasExcepcion } = await supabase
    .from('excepciones_corte')
    .select('fecha, hora_corte')
    .in('fecha', [hoy, manana])

  const excepciones: Record<string, string> = {}
  for (const fila of filasExcepcion ?? []) {
    excepciones[fila.fecha] = fila.hora_corte
  }

  const resultado = calcularTurno(input.eleccionFecha, ahora, excepciones)

  const { data: pedido, error: errorPedido } = await supabase
    .from('pedidos')
    .insert({
      punto_venta_id: puntoVentaId,
      fecha_entrega: resultado.fechaEntrega,
      turno_reparto: resultado.turno,
      tipo_etiqueta: input.tipoEtiqueta,
      fuera_de_horario: resultado.fueraDeHorario,
    })
    .select('id')
    .single()

  if (errorPedido || !pedido) return { error: 'No pudimos guardar el pedido. Intentá de nuevo.' }

  const { error: errorItems } = await supabase.from('pedido_items').insert(
    input.items.map((item) => ({
      pedido_id: pedido.id,
      producto_id: item.productoId,
      cantidad: item.cantidad,
    }))
  )

  if (errorItems) {
    return {
      error: 'El pedido se guardó pero hubo un error con los productos. Contactá a Don Carmelo.',
    }
  }

  return { success: true, fechaEntrega: resultado.fechaEntrega, turno: resultado.turno }
}
```

- [ ] **Step 2: Minimal page (Task 6 replaces the body with the full client UI)**

```tsx
// src/app/pedido/confirmar/page.tsx
import { redirect } from 'next/navigation'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { createServiceClient } from '@/lib/supabase/service'

export default async function ConfirmarPage() {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) redirect('/')

  const supabase = createServiceClient()
  const { data: puntoVenta } = await supabase
    .from('puntos_venta')
    .select('nombre')
    .eq('id', puntoVentaId)
    .maybeSingle()

  if (!puntoVenta) redirect('/')

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold text-neutral-900">Confirmar pedido</h1>
      <p className="text-sm text-neutral-500">Punto de venta: {puntoVenta.nombre}</p>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. With a product or two added to the cart from `/pedido`, go to `/pedido/confirmar` → expect the punto de venta's name to show.
2. Confirm `npm run build` type-checks `confirmarPedido` cleanly — it isn't called from anywhere yet, so no behavioral test is possible until Task 6, but the build must be clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/pedido/confirmar
git commit -m "Add confirmar page and confirmarPedido Server Action"
```

---

### Task 6: Confirmar — cart review, fecha/turno preview, etiqueta, submit

**Files:**
- Create: `src/app/pedido/confirmar/ConfirmarClient.tsx`
- Modify: `src/app/pedido/confirmar/page.tsx`

**Interfaces:**
- Consumes: `PuntoVenta`/`Producto`/`ItemCarrito` from `@/lib/types`, `calcularTurno`/`obtenerFechaHoyYManana` from `@/lib/comercio/corte`, `confirmarPedido`/`ConfirmarPedidoResultado` from `./actions` (Task 5).

- [ ] **Step 1: Client component**

```tsx
// src/app/pedido/confirmar/ConfirmarClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PuntoVenta, ItemCarrito } from '@/lib/types'
import { calcularTurno, obtenerFechaHoyYManana } from '@/lib/comercio/corte'
import { confirmarPedido } from './actions'

const CARRITO_KEY = 'don_carmelo_carrito'
const ULTIMO_PEDIDO_KEY = 'don_carmelo_ultimo_pedido'

export function ConfirmarClient({
  puntoVenta,
  excepciones,
}: {
  puntoVenta: PuntoVenta
  excepciones: Record<string, string>
}) {
  const router = useRouter()
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cargado, setCargado] = useState(false)
  const [eleccionFecha, setEleccionFecha] = useState<'hoy' | 'manana'>('hoy')
  const [tipoEtiqueta, setTipoEtiqueta] = useState(puntoVenta.etiqueta_default)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const guardado = sessionStorage.getItem(CARRITO_KEY)
    if (guardado) {
      try {
        setCarrito(JSON.parse(guardado))
      } catch {
        // carrito corrupto, se ignora
      }
    }
    setCargado(true)
  }, [])

  useEffect(() => {
    if (cargado) sessionStorage.setItem(CARRITO_KEY, JSON.stringify(carrito))
  }, [carrito, cargado])

  function quitarItem(productoId: string) {
    setCarrito((actual) => actual.filter((i) => i.productoId !== productoId))
  }

  function cambiarCantidad(productoId: string, cantidad: number) {
    setCarrito((actual) =>
      cantidad <= 0
        ? actual.filter((i) => i.productoId !== productoId)
        : actual.map((i) => (i.productoId === productoId ? { ...i, cantidad } : i))
    )
  }

  const totalConPrecio = carrito.reduce(
    (acc, i) => acc + (i.precioSugerido != null ? i.precioSugerido * i.cantidad : 0),
    0
  )
  const hayItemsSinPrecio = carrito.some((i) => i.precioSugerido == null)

  const { hoy } = useMemo(() => obtenerFechaHoyYManana(new Date()), [])
  const resultadoSiHoy = useMemo(
    () => calcularTurno('hoy', new Date(), excepciones),
    [excepciones]
  )
  const yaCerroHoy = resultadoSiHoy.fechaEntrega !== hoy

  useEffect(() => {
    if (yaCerroHoy && eleccionFecha === 'hoy') setEleccionFecha('manana')
  }, [yaCerroHoy, eleccionFecha])

  const previewTurno = useMemo(
    () => calcularTurno(eleccionFecha, new Date(), excepciones),
    [eleccionFecha, excepciones]
  )

  const faltaParaMinimo =
    puntoVenta.pedido_minimo != null ? puntoVenta.pedido_minimo - totalConPrecio : 0
  const llegaAlMinimo =
    puntoVenta.pedido_minimo == null || totalConPrecio >= puntoVenta.pedido_minimo

  async function handleConfirmar() {
    setEnviando(true)
    setError(null)

    const resultado = await confirmarPedido({
      items: carrito.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
      eleccionFecha,
      tipoEtiqueta,
    })

    if ('error' in resultado) {
      setError(resultado.error)
      setEnviando(false)
      return
    }

    sessionStorage.setItem(
      ULTIMO_PEDIDO_KEY,
      JSON.stringify({
        items: carrito,
        fechaEntrega: resultado.fechaEntrega,
        turno: resultado.turno,
        tipoEtiqueta,
      })
    )
    sessionStorage.removeItem(CARRITO_KEY)
    router.push('/pedido/listo')
  }

  if (cargado && carrito.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="mb-4 text-neutral-500">Tu carrito está vacío.</p>
        <button
          onClick={() => router.push('/pedido')}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white"
        >
          Volver al catálogo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 pb-32">
      <h1 className="text-xl font-semibold text-neutral-900">Confirmar pedido</h1>

      <ul className="space-y-2">
        {carrito.map((item) => (
          <li
            key={item.productoId}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-[8rem] flex-1">
              <p className="font-medium text-neutral-900">{item.nombre}</p>
              <p className="text-sm text-neutral-500">
                {item.unidad}
                {item.precioSugerido != null && ` · $${item.precioSugerido}`}
              </p>
            </div>
            <input
              type="number"
              min="0"
              step="0.5"
              value={item.cantidad}
              onChange={(e) => cambiarCantidad(item.productoId, Number(e.target.value))}
              className="w-20 rounded-md border border-neutral-300 px-2 py-2.5 text-center text-base"
            />
            <button onClick={() => quitarItem(item.productoId)} className="text-sm font-medium text-red-600">
              Quitar
            </button>
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Fecha de entrega</p>
        <div className="flex gap-3">
          <button
            onClick={() => setEleccionFecha('hoy')}
            disabled={yaCerroHoy}
            className={`flex-1 rounded-md px-4 py-3 text-base font-medium disabled:opacity-40 ${
              eleccionFecha === 'hoy' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setEleccionFecha('manana')}
            className={`flex-1 rounded-md px-4 py-3 text-base font-medium ${
              eleccionFecha === 'manana' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Mañana
          </button>
        </div>
        {yaCerroHoy && <p className="mt-2 text-sm text-neutral-500">Ya cerramos los pedidos de hoy.</p>}
        <p className="mt-2 text-sm text-neutral-600">
          Este pedido entra en el reparto de la{' '}
          <strong>{previewTurno.turno === 'manana' ? 'MAÑANA' : 'TARDE'}</strong>.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Tipo de etiqueta</label>
        <select
          value={tipoEtiqueta}
          onChange={(e) => setTipoEtiqueta(e.target.value as typeof tipoEtiqueta)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        >
          <option value="grande">Grande sin precio</option>
          <option value="chica">Chica con precio sugerido</option>
          <option value="ambas">Ambas</option>
        </select>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <p className="text-lg font-semibold text-neutral-900">Total: ${totalConPrecio.toFixed(2)}</p>
        {hayItemsSinPrecio && (
          <p className="mt-1 text-sm text-neutral-500">
            Algunos productos no tienen precio cargado, no se cuentan en este total.
          </p>
        )}
        {!llegaAlMinimo && (
          <p className="mt-1 text-sm text-red-600">
            El pedido mínimo es ${puntoVenta.pedido_minimo}. Te faltan ${faltaParaMinimo.toFixed(2)}.
          </p>
        )}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        onClick={handleConfirmar}
        disabled={enviando || !llegaAlMinimo}
        className="fixed inset-x-0 bottom-0 z-20 bg-neutral-900 px-4 py-4 text-center text-base font-medium text-white disabled:opacity-50"
      >
        {enviando ? 'Confirmando...' : 'Confirmar pedido'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire the page — fetch puntoVenta fully + the corte exceptions for hoy/mañana**

```tsx
// src/app/pedido/confirmar/page.tsx
import { redirect } from 'next/navigation'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { createServiceClient } from '@/lib/supabase/service'
import { obtenerFechaHoyYManana } from '@/lib/comercio/corte'
import type { PuntoVenta } from '@/lib/types'
import { ConfirmarClient } from './ConfirmarClient'

export default async function ConfirmarPage() {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) redirect('/')

  const supabase = createServiceClient()

  const { data: puntoVenta } = await supabase
    .from('puntos_venta')
    .select('*')
    .eq('id', puntoVentaId)
    .maybeSingle()

  if (!puntoVenta) redirect('/')

  const { hoy, manana } = obtenerFechaHoyYManana(new Date())
  const { data: filasExcepcion } = await supabase
    .from('excepciones_corte')
    .select('fecha, hora_corte')
    .in('fecha', [hoy, manana])

  const excepciones: Record<string, string> = {}
  for (const fila of filasExcepcion ?? []) {
    excepciones[fila.fecha] = fila.hora_corte
  }

  return <ConfirmarClient puntoVenta={puntoVenta as PuntoVenta} excepciones={excepciones} />
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. Add 2-3 products to the cart from `/pedido`, go to `/pedido/confirmar` → expect the cart items listed with editable quantities, "Hoy" selected by default (unless it's currently past 20:00 Argentina time, in which case "Hoy" should be disabled and "Mañana" auto-selected — check the actual time when testing and confirm the behavior matches).
2. Toggle between "Hoy" and "Mañana" → confirm the turno preview text updates immediately.
3. Change the tipo de etiqueta select → confirm it changes.
4. If the punto de venta being tested has a `pedido_minimo` set and the cart total is under it: confirm the warning shows and "Confirmar pedido" is disabled. Add more items to clear the minimum → confirm the button enables.
5. Click "Confirmar pedido" → expect redirect to `/pedido/listo` (Task 7 builds that page — until then it'll be a 404, expected).
6. Go back to `/pedido/confirmar` directly afterward (or check via REST/SQL) → confirm a new row exists in `pedidos` with the correct `turno_reparto`/`fecha_entrega`/`fuera_de_horario`, and matching rows in `pedido_items`.
7. Try confirming with an empty cart by clearing `sessionStorage`'s `don_carmelo_carrito` key and reloading `/pedido/confirmar` → expect the "Tu carrito está vacío" empty state, not a broken page.

- [ ] **Step 4: Commit**

```bash
git add src/app/pedido/confirmar
git commit -m "Add confirmar UI: cart review, fecha/turno preview, etiqueta, submit"
```

---

### Task 7: Confirmación final (/pedido/listo)

**Files:**
- Create: `src/app/pedido/listo/page.tsx`

**Interfaces:**
- Consumes: `ItemCarrito` from `@/lib/types`.

- [ ] **Step 1: Client page reading the summary left in sessionStorage by Task 6**

```tsx
// src/app/pedido/listo/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ItemCarrito } from '@/lib/types'

const ULTIMO_PEDIDO_KEY = 'don_carmelo_ultimo_pedido'

type ResumenPedido = {
  items: ItemCarrito[]
  fechaEntrega: string
  turno: 'manana' | 'tarde'
  tipoEtiqueta: 'grande' | 'chica' | 'ambas'
}

const ETIQUETA_LABEL: Record<ResumenPedido['tipoEtiqueta'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export default function ListoPage() {
  const router = useRouter()
  const [resumen, setResumen] = useState<ResumenPedido | null | 'cargando'>('cargando')

  useEffect(() => {
    const guardado = sessionStorage.getItem(ULTIMO_PEDIDO_KEY)
    if (!guardado) {
      setResumen(null)
      return
    }
    try {
      setResumen(JSON.parse(guardado))
    } catch {
      setResumen(null)
    }
  }, [])

  if (resumen === 'cargando') return null

  if (!resumen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-neutral-500">No encontramos un pedido reciente.</p>
        <button
          onClick={() => router.push('/pedido')}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white"
        >
          Ir al catálogo
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 p-4 text-center">
      <div className="text-5xl">✅</div>
      <h1 className="text-2xl font-bold text-neutral-900">¡Pedido confirmado!</h1>
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-4 text-left">
        <p className="mb-1 text-base text-neutral-900">
          <strong>Fecha de entrega:</strong> {resumen.fechaEntrega}
        </p>
        <p className="mb-1 text-base text-neutral-900">
          <strong>Reparto:</strong> {resumen.turno === 'manana' ? 'Mañana' : 'Tarde'}
        </p>
        <p className="mb-3 text-base text-neutral-900">
          <strong>Etiqueta:</strong> {ETIQUETA_LABEL[resumen.tipoEtiqueta]}
        </p>
        <ul className="space-y-1 text-sm text-neutral-600">
          {resumen.items.map((item) => (
            <li key={item.productoId}>
              {item.cantidad} {item.unidad} — {item.nombre}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={() => router.push('/pedido')}
        className="rounded-md bg-neutral-900 px-6 py-3 text-base font-medium text-white hover:bg-neutral-800"
      >
        Hacer otro pedido
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. Go through the full flow: `/` (enter celular) → `/pedido` (add items) → `/pedido/confirmar` (pick fecha, confirm) → expect landing on `/pedido/listo` with the correct summary (fecha, turno, etiqueta, item list).
2. Click "Hacer otro pedido" → expect redirect to `/pedido` with an empty cart (confirm the sticky bar is gone, since `don_carmelo_carrito` was cleared in Task 6's submit handler).
3. Navigate directly to `/pedido/listo` in a fresh tab with no `don_carmelo_ultimo_pedido` in sessionStorage → expect the "No encontramos un pedido reciente" empty state, not a crash.

- [ ] **Step 3: Commit**

```bash
git add src/app/pedido/listo
git commit -m "Add pedido confirmation screen"
```

---

### Task 8: End-to-end smoke test and deploy

**Files:** none (verification only)

- [ ] **Step 1: Full build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed with no errors.

- [ ] **Step 2: Push to trigger the production deploy**

```bash
git push origin main
```

(If this fails with a 403 due to the cached-credential issue from the previous sub-project, push with an explicit token: `git push "https://<TOKEN>@github.com/maestriaarg-web/doncarmelo.git" main:main` — do not use `-u`, it leaks the token into `.git/config`.)

- [ ] **Step 3: End-to-end manual test against production**

At `https://doncarmelo.vercel.app`:
1. In the admin panel, confirm (or create) at least one `punto_venta` with a real `celular`, `activo = true`, and 3+ `productos` with `disponible = true` and at least one with `precio_sugerido` set and one without, across at least two categories.
2. Go to `https://doncarmelo.vercel.app/` and enter that celular → confirm redirect to `/pedido` and the catalog renders grouped by category with the right data.
3. Search for a product → confirm filtering works.
4. Add a mix of priced and unpriced items to the cart, go to `/pedido/confirmar`.
5. Confirm the "Hoy"/"Mañana" toggle and turno preview behave correctly for the actual current time (compare against the Task 1 verification cases mentally: is it currently before/after 9am and 8pm Argentina time? Does the preview match?).
6. If a `pedido_minimo` is set and not met, confirm the block; add enough items to clear it.
7. Confirm the order → confirm landing on `/pedido/listo` with the right summary, and check in the admin's Supabase project (SQL Editor or a quick REST query) that the `pedidos` and `pedido_items` rows were created with the expected `turno_reparto`/`fecha_entrega`/`fuera_de_horario`.
8. Click "Hacer otro pedido", confirm you land back on an empty catalog cart.
9. Open a private/incognito window (no cookie) and confirm `/pedido` redirects to `/`.

- [ ] **Step 4: Report status**

No commit needed for this task — it's the final verification gate confirming Sub-project 2 (app cliente: catálogo, carrito, corte automático) is complete and live in production.
