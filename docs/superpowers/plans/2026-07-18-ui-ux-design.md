# Pase de diseño UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el diseño neutro/por defecto de Almacén Don Carmelo (app cliente + panel admin) por un sistema de diseño basado en la identidad de marca real del negocio (isotipo rojo terracota, tipografía sans-serif, fondo cálido), sin tocar ninguna lógica, flujo, o estructura de datos.

**Architecture:** Los tokens de color y tipografía se definen una sola vez en `src/app/globals.css` vía el bloque `@theme` de Tailwind v4. A partir de ahí, cada pantalla existente se retoca reemplazando clases `neutral-*` hardcodeadas por las nuevas clases semánticas (`bg-primary`, `text-foreground`, `bg-background`) siguiendo una regla de mapeo fija (ver Global Constraints). Es un reemplazo de clases sobre la estructura JSX existente — ningún componente cambia de comportamiento, ninguna Server Action ni query se toca.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind v4 — versiones sin cambios.

## Global Constraints

- Next.js 16.2.10 / React 19.2.4 / TypeScript / Tailwind v4 — ya instaladas, no se cambian.
- No hay suite de tests automatizada (decisión ya confirmada para todo el proyecto) — verificación es `npm run build` + `npm run lint` + revisión visual manual contra el dev server.
- **Regla de mapeo de clases (aplica a TODAS las tareas de este plan):**
  - `bg-neutral-50` (fondo de página) → `bg-background`
  - `text-neutral-900` (títulos, texto principal) → `text-foreground`
  - `bg-neutral-900` cuando es el botón de acción PRINCIPAL de la pantalla (confirmar, guardar, ingresar, crear) → `bg-primary`, con su `hover:bg-neutral-800` correspondiente → `hover:bg-primary-hover`
  - Todo lo demás (`border-neutral-200`, `bg-neutral-100`, `text-neutral-500`, `text-neutral-400`, `text-neutral-700`, `bg-neutral-200`, `text-neutral-600`, `bg-white`) **queda sin cambios** — son grises funcionales o fondos de tarjeta, no colores de marca.
  - `red-*` (errores de formulario, botones destructivos "Baja"/"Borrar"), `amber-*` (badges de aviso), `green-*` y el degradé de `CorteBarra.tsx` (colores semánticos de estado), `blue-*` (indicador "congelado") **quedan sin cambios** — son colores semánticos de estado, no deben competir visualmente con el rojo de marca ni perder su significado.
  - Cuando un botón secundario/utilitario ya usaba `bg-neutral-800` (no `-900`) o `border-neutral-300` como estilo "outline", **queda sin cambios** — solo se re-marca el botón que es la acción principal de esa pantalla específica.
- El isotipo real de la marca (archivo SVG/PNG del logo) **todavía no está disponible en el repo** — el componente `BrandMark` usa un círculo sólido en `--color-primary` como placeholder del isotipo. Reemplazar ese círculo por el archivo real es trabajo futuro, fuera de este plan.
- Este plan no toca Server Actions, queries a Supabase, ni tipos — son cambios puros de `className` y de la estructura de un componente de marca compartido. Si algún paso pareciera requerir tocar lógica, es una señal de que algo no encaja con el plan — parar y reportar.

---

## File Structure

```
src/app/globals.css                                    # (modify) tokens de color/tipografía
src/app/icon.svg                                        # (create) favicon — círculo en color primario
src/components/BrandMark.tsx                            # (create) isotipo placeholder + wordmark, reutilizado en 3 pantallas

src/app/page.tsx                                         # (modify) acceso por celular
src/app/pedido/CatalogoClient.tsx                        # (modify) catálogo — suma BrandMark

src/app/pedido/confirmar/ConfirmarClient.tsx             # (modify)
src/app/pedido/confirmar/CorteBarra.tsx                  # (modify)
src/app/pedido/listo/page.tsx                            # (modify)
src/app/pedido/historial/page.tsx                        # (modify)

src/app/admin/(dashboard)/layout.tsx                     # (modify) suma BrandMark al header
src/app/admin/login/page.tsx                              # (modify) suma BrandMark

src/app/admin/(dashboard)/pedidos/page.tsx                # (modify)
src/app/admin/(dashboard)/pedidos/TurnoSection.tsx         # (modify)
src/app/admin/remito/RemitoContent.tsx                     # (modify)
src/app/admin/remitos/page.tsx                             # (modify)

src/app/admin/(dashboard)/productos/ProductosClient.tsx    # (modify)
src/app/admin/(dashboard)/productos/ProductoForm.tsx        # (modify)

src/app/admin/(dashboard)/puntos-venta/PuntosVentaClient.tsx # (modify)
src/app/admin/(dashboard)/puntos-venta/PuntoVentaForm.tsx     # (modify)

src/app/admin/(dashboard)/excepciones/ExcepcionesClient.tsx  # (modify)
src/app/admin/(dashboard)/excepciones/ExcepcionForm.tsx       # (modify)
```

---

### Task 1: Tokens de diseño + favicon + componente de marca

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/app/icon.svg`
- Create: `src/components/BrandMark.tsx`

**Interfaces:**
- Produces: clases Tailwind `bg-primary`/`hover:bg-primary-hover`/`bg-background`/`text-foreground` (disponibles automáticamente vía `@theme`), componente `BrandMark` (from `@/components/BrandMark`) — consumido por Tasks 2, 4.

- [ ] **Step 1: Tokens de color y tipografía**

```css
/* src/app/globals.css — archivo completo */
@import "tailwindcss";

@theme inline {
  --color-primary: #c0392b;
  --color-primary-hover: #a33025;
  --color-background: #f2efea;
  --color-foreground: #161616;
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
}
```

Nota: se elimina el bloque `@media (prefers-color-scheme: dark)` que tenía el archivo original — nunca tuvo efecto real porque ningún componente del proyecto consume esas variables (todos usan clases `neutral-*`/`bg-white` literales), así que mantenerlo sería un bloque muerto y confuso. También se elimina el `font-family: Arial, Helvetica, sans-serif;` que pisaba la fuente `Geist` ya instalada — ahora el `body` usa `var(--font-sans)` de verdad.

- [ ] **Step 2: Favicon**

```svg
<!-- src/app/icon.svg -->
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="16" fill="#c0392b" />
</svg>
```

Next.js detecta automáticamente `src/app/icon.svg` y genera el `<link rel="icon">` correspondiente — no hace falta tocar `layout.tsx` ni `metadata`. El `src/app/favicon.ico` existente (el de scaffold) queda como fallback para navegadores viejos que no soportan favicons SVG; no se toca porque reemplazarlo requeriría convertir a `.ico`, fuera de alcance sin el archivo real del logo.

- [ ] **Step 3: Componente de marca compartido**

```tsx
// src/components/BrandMark.tsx
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="h-5 w-5 flex-shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <span className="font-semibold text-foreground">Don Carmelo</span>
    </span>
  )
}
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: builds successfully. Nada consume `BrandMark` todavía, así que esto solo confirma que no hay errores de TypeScript/CSS.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/icon.svg src/components/BrandMark.tsx
git commit -m "Add design tokens (brand color/typography), favicon, and BrandMark component"
```

---

### Task 2: App cliente — acceso y catálogo

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/pedido/CatalogoClient.tsx`

**Interfaces:**
- Consumes: `BrandMark` from `@/components/BrandMark` (Task 1).

- [ ] **Step 1: Pantalla de acceso**

```tsx
// src/app/page.tsx — full file
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
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background px-4">
      <form
        action={ingresarConCelular}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-2 text-xl font-semibold text-foreground">Almacén Don Carmelo</h1>
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
          className="w-full rounded-md bg-primary px-4 py-3 text-base font-medium text-white hover:bg-primary-hover"
        >
          Ingresar
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: Catálogo — sumar BrandMark, retintar botón principal**

```tsx
// src/app/pedido/CatalogoClient.tsx — full file
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Producto, ItemCarrito } from '@/lib/types'
import { BrandMark } from '@/components/BrandMark'
import { repetirUltimoPedido } from './actions'

const CARRITO_KEY = 'don_carmelo_carrito'
const AVISO_KEY = 'don_carmelo_aviso'

export function CatalogoClient({
  productos,
  hayHistorial,
  productosFrecuentes,
}: {
  productos: Producto[]
  hayHistorial: boolean
  productosFrecuentes: Producto[]
}) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cargado, setCargado] = useState(false)
  const [repitiendo, setRepitiendo] = useState(false)

  useEffect(() => {
    const guardado = sessionStorage.getItem(CARRITO_KEY)
    if (guardado) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function handleRepetirPedido() {
    setRepitiendo(true)
    const resultado = await repetirUltimoPedido()
    if ('error' in resultado) {
      alert(resultado.error)
      setRepitiendo(false)
      return
    }
    sessionStorage.setItem(CARRITO_KEY, JSON.stringify(resultado.items))
    if (resultado.omitidos > 0) {
      sessionStorage.setItem(
        AVISO_KEY,
        `${resultado.omitidos} producto(s) de tu último pedido ya no están disponibles y no se agregaron.`
      )
    }
    router.push('/pedido/confirmar')
  }

  const totalItems = carrito.reduce((acc, i) => acc + i.cantidad, 0)
  const totalPrecio = carrito.reduce(
    (acc, i) => acc + (i.precioSugerido != null ? i.precioSugerido * i.cantidad : 0),
    0
  )

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 pt-3">
        <BrandMark />
        <Link href="/pedido/historial" className="text-sm font-medium text-neutral-600">
          Ver historial de pedidos →
        </Link>
      </div>

      {hayHistorial && (
        <div className="px-4 pt-3">
          <button
            onClick={handleRepetirPedido}
            disabled={repitiendo}
            className="w-full rounded-md bg-neutral-800 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {repitiendo ? 'Cargando...' : '↻ Repetir último pedido'}
          </button>
        </div>
      )}

      {productosFrecuentes.length > 0 && (
        <div className="px-4 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Tus productos frecuentes</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {productosFrecuentes.map((p) => (
              <button
                key={p.id}
                onClick={() => actualizarCantidad(p, cantidadEnCarrito(p.id) + 1)}
                className="flex w-28 flex-shrink-0 flex-col items-center gap-1 rounded-lg border border-neutral-200 bg-white p-2 text-center"
              >
                {p.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.foto_url} alt="" className="h-16 w-16 rounded-md object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-neutral-100" />
                )}
                <span className="text-xs font-medium text-foreground">{p.nombre}</span>
                <span className="text-xs text-neutral-500">+ agregar</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sticky top-0 z-10 bg-background px-4 pb-3 pt-2">
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
            <h2 className="mb-2 text-lg font-semibold text-foreground">{categoria}</h2>
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
                      className={`font-medium text-foreground ${
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
          className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between bg-primary px-4 py-4 text-base font-medium text-white"
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

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. `http://localhost:3000/` — confirmá fondo cálido (`#f2efea`), botón "Ingresar" en rojo, título "Almacén Don Carmelo" en negro casi puro.
2. Con una sesión de comercio activa, `http://localhost:3000/pedido` — confirmá que aparece el `BrandMark` (círculo rojo + "Don Carmelo") arriba a la izquierda, junto al link de historial. Confirmá que el botón flotante "Ver pedido" (cuando hay items en el carrito) es rojo, y que "Repetir último pedido" sigue siendo el botón oscuro de siempre (no compite con el rojo).

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/pedido/CatalogoClient.tsx
git commit -m "Apply brand tokens to acceso and catálogo screens"
```

---

### Task 3: App cliente — confirmar, corte, listo, historial

**Files:**
- Modify: `src/app/pedido/confirmar/ConfirmarClient.tsx`
- Modify: `src/app/pedido/confirmar/CorteBarra.tsx`
- Modify: `src/app/pedido/listo/page.tsx`
- Modify: `src/app/pedido/historial/page.tsx`

**Interfaces:** ninguna nueva — solo reemplazo de clases sobre componentes ya existentes.

- [ ] **Step 1: Confirmar pedido**

```tsx
// src/app/pedido/confirmar/ConfirmarClient.tsx — full file
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PuntoVenta, ItemCarrito } from '@/lib/types'
import {
  calcularTurno,
  obtenerFechaHoyYManana,
  obtenerHoraCorteEfectiva,
  formatearHoraArgentina,
} from '@/lib/comercio/corte'
import { confirmarPedido } from './actions'
import { CorteBarra } from './CorteBarra'

const CARRITO_KEY = 'don_carmelo_carrito'
const ULTIMO_PEDIDO_KEY = 'don_carmelo_ultimo_pedido'
const AVISO_KEY = 'don_carmelo_aviso'

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
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const guardado = sessionStorage.getItem(CARRITO_KEY)
    if (guardado) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCarrito(JSON.parse(guardado))
      } catch {
        // carrito corrupto, se ignora
      }
    }
    const avisoGuardado = sessionStorage.getItem(AVISO_KEY)
    if (avisoGuardado) {
      setAviso(avisoGuardado)
      sessionStorage.removeItem(AVISO_KEY)
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
  const horaCorteHoy = useMemo(() => obtenerHoraCorteEfectiva(hoy, excepciones), [hoy, excepciones])
  const horaActual = useMemo(() => formatearHoraArgentina(new Date()), [])

  const resultadoSiHoy = useMemo(
    () => calcularTurno('hoy', new Date(), excepciones),
    [excepciones]
  )
  const yaCerroHoy = resultadoSiHoy.fechaEntrega !== hoy

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white"
        >
          Volver al catálogo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 pb-32">
      <h1 className="text-xl font-semibold text-foreground">Confirmar pedido</h1>

      {aviso && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{aviso}</p>}

      <ul className="space-y-2">
        {carrito.map((item) => (
          <li
            key={item.productoId}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-[8rem] flex-1">
              <p className="font-medium text-foreground">{item.nombre}</p>
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
            <button
              onClick={() => quitarItem(item.productoId)}
              className="px-2 py-2.5 text-sm font-medium text-red-600"
            >
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
              eleccionFecha === 'hoy' ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setEleccionFecha('manana')}
            className={`flex-1 rounded-md px-4 py-3 text-base font-medium ${
              eleccionFecha === 'manana' ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Mañana
          </button>
        </div>
        {yaCerroHoy && <p className="mt-2 text-sm text-neutral-500">Ya cerramos los pedidos de hoy.</p>}
        {eleccionFecha === 'hoy' ? (
          <div className="mt-3">
            <CorteBarra horaCorteHoy={horaCorteHoy} horaActual={horaActual} />
            <p className="mt-2 text-sm text-neutral-600">
              Este pedido entra en el reparto de la{' '}
              <strong>{previewTurno.turno === 'manana' ? 'MAÑANA' : 'TARDE'}</strong>.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Este pedido entra en el reparto de la <strong>MAÑANA</strong>.
          </div>
        )}
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
        <p className="text-lg font-semibold text-foreground">Total: ${totalConPrecio.toFixed(2)}</p>
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
        className="fixed inset-x-0 bottom-0 z-20 bg-primary px-4 py-4 text-center text-base font-medium text-white disabled:opacity-50"
      >
        {enviando ? 'Confirmando...' : 'Confirmar pedido'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Barra de corte — solo el marcador "ahora"**

```tsx
// src/app/pedido/confirmar/CorteBarra.tsx — full file
'use client'

import { HORA_CIERRE_TARDE } from '@/lib/comercio/corte'

function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function CorteBarra({
  horaCorteHoy,
  horaActual,
}: {
  horaCorteHoy: string
  horaActual: string
}) {
  const minutosEnDia = 24 * 60
  const pctCorte = (horaAMinutos(horaCorteHoy) / minutosEnDia) * 100
  const pctCierre = (horaAMinutos(HORA_CIERRE_TARDE) / minutosEnDia) * 100
  const pctActual = (horaAMinutos(horaActual) / minutosEnDia) * 100

  return (
    <div>
      <div className="mb-2 text-sm font-medium text-neutral-700">
        Corte de pedidos: {horaCorteHoy}
      </div>
      <div
        className="relative h-4 overflow-hidden rounded-lg"
        style={{
          background: `linear-gradient(to right,
            #16a34a 0%, #16a34a ${pctCorte}%,
            #f59e0b ${pctCorte}%, #f59e0b ${pctCierre}%,
            #dc2626 ${pctCierre}%, #dc2626 100%)`,
        }}
      >
        <div
          className="absolute top-[-6px] h-7 w-0.5 bg-foreground"
          style={{ left: `${pctActual}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-400">
        <span>00:00</span>
        <span>{horaCorteHoy}</span>
        <span>{HORA_CIERRE_TARDE}</span>
        <span>24:00</span>
      </div>
    </div>
  )
}
```

Nota: el degradé verde/ámbar/rojo (`#16a34a`/`#f59e0b`/`#dc2626`) queda igual — es un semáforo de estado (disponible/por cerrar/cerrado), no color de marca. Solo cambia el marcador de "ahora" de `bg-neutral-900` a `bg-foreground` por consistencia de tokens.

- [ ] **Step 3: Confirmación final**

```tsx
// src/app/pedido/listo/page.tsx — full file
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
    // Hydrating client-only sessionStorage into state on mount; must run in an
    // effect to avoid SSR mismatch (sessionStorage is unavailable during SSR).
    const guardado = sessionStorage.getItem(ULTIMO_PEDIDO_KEY)
    if (!guardado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white"
        >
          Ir al catálogo
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4 text-center">
      <div className="text-5xl">✅</div>
      <h1 className="text-2xl font-bold text-foreground">¡Pedido confirmado!</h1>
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-4 text-left">
        <p className="mb-1 text-base text-foreground">
          <strong>Fecha de entrega:</strong> {resumen.fechaEntrega}
        </p>
        <p className="mb-1 text-base text-foreground">
          <strong>Reparto:</strong> {resumen.turno === 'manana' ? 'Mañana' : 'Tarde'}
        </p>
        <p className="mb-3 text-base text-foreground">
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
        className="rounded-md bg-primary px-6 py-3 text-base font-medium text-white hover:bg-primary-hover"
      >
        Hacer otro pedido
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Historial**

```tsx
// src/app/pedido/historial/page.tsx — full file
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { obtenerHistorialPedidos } from '@/lib/comercio/pedidos'

const ETIQUETA_LABEL: Record<'grande' | 'chica' | 'ambas', string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export const dynamic = 'force-dynamic'

export default async function HistorialPage() {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) redirect('/')

  const pedidos = await obtenerHistorialPedidos(puntoVentaId)

  return (
    <div className="p-4 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Historial de pedidos</h1>
        <Link href="/pedido" className="text-sm font-medium text-neutral-600">
          ← Volver al catálogo
        </Link>
      </div>

      {pedidos.length === 0 && (
        <p className="py-8 text-center text-neutral-500">Todavía no hiciste ningún pedido.</p>
      )}

      <ul className="space-y-2">
        {pedidos.map((pedido) => {
          const nombres = pedido.pedido_items
            .map((item) => item.productos?.nombre)
            .filter((nombre): nombre is string => Boolean(nombre))
          const resumen =
            nombres.length <= 3
              ? nombres.join(', ')
              : `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`

          return (
            <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">{pedido.fecha_entrega}</p>
                <span className="text-sm text-neutral-500">
                  {pedido.turno_reparto === 'manana' ? 'Mañana' : 'Tarde'} · {pedido.estado}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                {pedido.pedido_items.length} producto(s): {resumen}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Etiqueta: {ETIQUETA_LABEL[pedido.tipo_etiqueta]}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. `/pedido/confirmar` con items en el carrito — confirmá que el toggle "Hoy"/"Mañana" seleccionado se ve en rojo, la barra de corte mantiene su degradé verde/ámbar/rojo sin cambios, y el botón fijo "Confirmar pedido" es rojo.
2. Confirmá un pedido — en `/pedido/listo`, los botones "Ir al catálogo"/"Hacer otro pedido" son rojos, fondo cálido.
3. `/pedido/historial` — confirmá que los títulos están en el negro de marca, sin otros cambios de color.

- [ ] **Step 6: Commit**

```bash
git add src/app/pedido/confirmar src/app/pedido/listo/page.tsx src/app/pedido/historial/page.tsx
git commit -m "Apply brand tokens to confirmar, listo, and historial screens"
```

---

### Task 4: Admin — nav/header y login

**Files:**
- Modify: `src/app/admin/(dashboard)/layout.tsx`
- Modify: `src/app/admin/login/page.tsx`

**Interfaces:**
- Consumes: `BrandMark` from `@/components/BrandMark` (Task 1).

- [ ] **Step 1: Header del panel — sumar BrandMark**

```tsx
// src/app/admin/(dashboard)/layout.tsx — full file
import Link from 'next/link'
import { BrandMark } from '@/components/BrandMark'
import { signOut } from '../login/actions'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-6">
          <BrandMark />
          <nav className="flex gap-4 text-sm font-medium text-neutral-700">
            <Link href="/admin/pedidos">Pedidos</Link>
            <Link href="/admin/productos">Productos</Link>
            <Link href="/admin/puntos-venta">Puntos de venta</Link>
            <Link href="/admin/excepciones">Excepciones de corte</Link>
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

- [ ] **Step 2: Login**

```tsx
// src/app/admin/login/page.tsx — full file
import { BrandMark } from '@/components/BrandMark'
import { signIn } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        action={signIn}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-6">
          <BrandMark />
          <p className="mt-1 text-sm text-neutral-500">Panel de administración</p>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
        <input
          type="email"
          name="email"
          required
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />

        <label className="mb-1 block text-sm font-medium text-neutral-700">Contraseña</label>
        <input
          type="password"
          name="password"
          required
          className="mb-6 w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />

        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover"
        >
          Ingresar
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. `/admin/login` — confirmá el `BrandMark` arriba del formulario con "Panel de administración" debajo, botón "Ingresar" en rojo.
2. Logueado, cualquier pantalla del admin — confirmá que el header tiene el `BrandMark` a la izquierda, seguido de los links de nav, y "Salir" a la derecha; fondo general cálido (`bg-background`) detrás del header blanco.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(dashboard)/layout.tsx" src/app/admin/login/page.tsx
git commit -m "Apply brand tokens and BrandMark to admin nav and login"
```

---

### Task 5: Admin — pedidos y remitos

**Files:**
- Modify: `src/app/admin/(dashboard)/pedidos/page.tsx`
- Modify: `src/app/admin/(dashboard)/pedidos/TurnoSection.tsx`
- Modify: `src/app/admin/remito/RemitoContent.tsx`
- Modify: `src/app/admin/remitos/page.tsx`

**Interfaces:** ninguna nueva.

- [ ] **Step 1: Pantalla de pedidos**

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
        <h1 className="text-xl font-semibold text-foreground">Pedidos</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pedidos?fecha=${sumarDias(fecha, -1)}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            ← Anterior
          </Link>
          <span className="text-base font-medium text-foreground">{fecha}</span>
          <Link
            href={`/admin/pedidos?fecha=${sumarDias(fecha, 1)}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            Siguiente →
          </Link>
        </div>
      </div>

      <TurnoSection titulo="Turno mañana" fecha={fecha} turno="manana" pedidos={pedidosManana} atipicos={atipicos} />
      <TurnoSection titulo="Turno tarde" fecha={fecha} turno="tarde" pedidos={pedidosTarde} atipicos={atipicos} />
    </div>
  )
}
```

- [ ] **Step 2: TurnoSection**

```tsx
// src/app/admin/(dashboard)/pedidos/TurnoSection.tsx — full file
import type { PedidoAdmin } from '@/lib/types'
import { consolidarPreparacion, type ItemPreparacion } from '@/lib/admin/pedidos'

function agruparPorCategoria(items: ItemPreparacion[]): [string, ItemPreparacion[]][] {
  const mapa = new Map<string, ItemPreparacion[]>()
  for (const item of items) {
    const lista = mapa.get(item.categoria) ?? []
    lista.push(item)
    mapa.set(item.categoria, lista)
  }
  return Array.from(mapa.entries())
}

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
  const preparacionPorCategoria = agruparPorCategoria(preparacion)

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
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
            <div className="space-y-3 text-sm">
              {preparacionPorCategoria.map(([categoria, items]) => (
                <div key={categoria}>
                  <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">
                    {categoria}
                  </p>
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.productoId} className="flex justify-between">
                        <span>{item.nombre}</span>
                        <span className="text-neutral-500">
                          {item.cantidadTotal} {item.unidad} ({item.cantidadPedidos} pedido(s))
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <ul className="space-y-2">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">
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

- [ ] **Step 3: Remito imprimible — se mantiene apto para impresión (sin rojo, solo texto)**

```tsx
// src/app/admin/remito/RemitoContent.tsx — full file
import type { PedidoAdmin } from '@/lib/types'

const ETIQUETA_LABEL: Record<PedidoAdmin['tipo_etiqueta'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export function RemitoContent({ pedido }: { pedido: PedidoAdmin }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-foreground">
        {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
      </h2>
      {pedido.puntos_venta?.direccion && (
        <p className="text-sm text-neutral-600">{pedido.puntos_venta.direccion}</p>
      )}
      <p className="mt-2 text-sm text-foreground">
        Fecha de entrega: <strong>{pedido.fecha_entrega}</strong> · Turno:{' '}
        <strong>{pedido.turno_reparto === 'manana' ? 'Mañana' : 'Tarde'}</strong>
      </p>
      <p className="text-sm text-foreground">
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

`src/app/admin/remitos/page.tsx` no tiene clases `neutral-900`/`neutral-50` propias (solo delega a `RemitoContent` y usa `text-neutral-500`/`bg-white`, sin cambios) — no requiere edición en esta tarea.

- [ ] **Step 4: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. `/admin/pedidos` con datos reales — confirmá títulos en negro de marca, badges ámbar sin cambios, botones "Imprimir remito"/"Imprimir todos" siguen siendo outline neutro (no rojo — son acciones utilitarias, no la acción principal de la pantalla).
2. Abrí un remito individual y uno por turno — confirmá que se ven en negro/gris, sin rojo, listos para imprimir en blanco y negro sin perder legibilidad.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/pedidos" src/app/admin/remito/RemitoContent.tsx
git commit -m "Apply brand tokens to pedidos and remito screens"
```

---

### Task 6: Admin — productos

**Files:**
- Modify: `src/app/admin/(dashboard)/productos/ProductosClient.tsx`
- Modify: `src/app/admin/(dashboard)/productos/ProductoForm.tsx`

**Interfaces:** ninguna nueva. `src/app/admin/(dashboard)/productos/page.tsx` es un Server Component sin clases propias — no se toca.

- [ ] **Step 1: Listado**

```tsx
// src/app/admin/(dashboard)/productos/ProductosClient.tsx — full file
'use client'

import { useState } from 'react'
import type { ActionResult, Producto } from '@/lib/types'
import { ProductoForm } from './ProductoForm'
import {
  crearProducto,
  actualizarProducto,
  darDeBajaProducto,
  toggleDisponible,
  type ProductoInput,
} from './actions'

export function ProductosClient({ productos }: { productos: Producto[] }) {
  const [modo, setModo] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState('todas')

  const activos = productos.filter((p) => p.activo)
  const categorias = Array.from(new Set(activos.map((p) => p.categoria)))
  const visibles = activos.filter(
    (p) => filtroCategoria === 'todas' || p.categoria === filtroCategoria
  )

  async function handleCrear(input: ProductoInput): Promise<ActionResult> {
    const result = await crearProducto(input)
    if ('success' in result) setModo('lista')
    return result
  }

  async function handleActualizar(input: ProductoInput): Promise<ActionResult> {
    if (!editando) return { error: 'No hay producto seleccionado' }
    const result = await actualizarProducto(editando.id, input)
    if ('success' in result) {
      setModo('lista')
      setEditando(null)
    }
    return result
  }

  async function handleToggleDisponible(id: string, disponible: boolean) {
    const result = await toggleDisponible(id, disponible)
    if ('error' in result) alert(result.error)
  }

  async function handleDarDeBaja(id: string) {
    const result = await darDeBajaProducto(id)
    if ('error' in result) alert(result.error)
  }

  if (modo === 'nuevo') {
    return (
      <ProductoForm
        categoriasExistentes={categorias}
        onSubmit={handleCrear}
        onCancel={() => setModo('lista')}
      />
    )
  }

  if (modo === 'editar' && editando) {
    return (
      <ProductoForm
        producto={editando}
        categoriasExistentes={categorias}
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
        <h1 className="text-xl font-semibold text-foreground">Productos</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover"
        >
          + Nuevo producto
        </button>
      </div>

      {categorias.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFiltroCategoria('todas')}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              filtroCategoria === 'todas' ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              onClick={() => setFiltroCategoria(c)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                filtroCategoria === c ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {visibles.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            {p.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.foto_url} alt="" className="h-12 w-12 rounded-md object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-md bg-neutral-100" />
            )}
            <div className="min-w-[10rem] flex-1">
              <p className="font-medium text-foreground">
                {p.nombre} {p.congelado && <span className="text-xs text-blue-600">❄ congelado</span>}
              </p>
              <p className="text-sm text-neutral-500">
                {p.categoria} · {p.unidad}
                {p.precio_sugerido != null && ` · $${p.precio_sugerido}`}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={p.disponible}
                onChange={(e) => handleToggleDisponible(p.id, e.target.checked)}
              />
              Disponible
            </label>
            <button
              onClick={() => {
                setEditando(p)
                setModo('editar')
              }}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Editar
            </button>
            <button
              onClick={() => handleDarDeBaja(p.id)}
              className="text-sm font-medium text-red-600 hover:text-red-800"
            >
              Baja
            </button>
          </li>
        ))}
        {visibles.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No hay productos en esta categoría.</p>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Formulario**

```tsx
// src/app/admin/(dashboard)/productos/ProductoForm.tsx — solo cambia el botón "Guardar", resto del archivo sin cambios
```

En `ProductoForm.tsx`, reemplazá únicamente el botón de submit:

```tsx
        <button
          type="submit"
          disabled={guardando || subiendo}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
```

(reemplaza el bloque `<button type="submit" ... bg-neutral-900 ... hover:bg-neutral-800 ...>` existente — el resto del archivo, incluyendo el botón "Cancelar" con `border-neutral-300`, queda igual).

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

`/admin/productos` — confirmá "+ Nuevo producto" en rojo, el filtro de categoría seleccionado en rojo, botón "Guardar" del formulario en rojo, "Baja" sigue en rojo semántico de Tailwind (no debería notarse cambio ahí).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(dashboard)/productos"
git commit -m "Apply brand tokens to productos screen"
```

---

### Task 7: Admin — puntos de venta

**Files:**
- Modify: `src/app/admin/(dashboard)/puntos-venta/PuntosVentaClient.tsx`
- Modify: `src/app/admin/(dashboard)/puntos-venta/PuntoVentaForm.tsx`

**Interfaces:** ninguna nueva. `page.tsx` no se toca (Server Component sin clases propias).

- [ ] **Step 1: Listado**

```tsx
// src/app/admin/(dashboard)/puntos-venta/PuntosVentaClient.tsx — full file
'use client'

import { useState } from 'react'
import type { ActionResult, PuntoVenta } from '@/lib/types'
import { PuntoVentaForm } from './PuntoVentaForm'
import {
  crearPuntoVenta,
  actualizarPuntoVenta,
  cambiarActivoPuntoVenta,
  type PuntoVentaInput,
} from './actions'

const ETIQUETA_LABEL: Record<PuntoVenta['etiqueta_default'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export function PuntosVentaClient({ puntosVenta }: { puntosVenta: PuntoVenta[] }) {
  const [modo, setModo] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editando, setEditando] = useState<PuntoVenta | null>(null)

  async function handleCrear(input: PuntoVentaInput): Promise<ActionResult> {
    const result = await crearPuntoVenta(input)
    if ('success' in result) setModo('lista')
    return result
  }

  async function handleActualizar(input: PuntoVentaInput): Promise<ActionResult> {
    if (!editando) return { error: 'No hay punto de venta seleccionado' }
    const result = await actualizarPuntoVenta(editando.id, input)
    if ('success' in result) {
      setModo('lista')
      setEditando(null)
    }
    return result
  }

  async function handleCambiarActivo(id: string, activo: boolean) {
    const result = await cambiarActivoPuntoVenta(id, activo)
    if ('error' in result) alert(result.error)
  }

  if (modo === 'nuevo') {
    return <PuntoVentaForm onSubmit={handleCrear} onCancel={() => setModo('lista')} />
  }

  if (modo === 'editar' && editando) {
    return (
      <PuntoVentaForm
        puntoVenta={editando}
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
        <h1 className="text-xl font-semibold text-foreground">Puntos de venta</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover"
        >
          + Nuevo punto de venta
        </button>
      </div>

      <ul className="space-y-2">
        {puntosVenta.map((pv) => (
          <li
            key={pv.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-[12rem] flex-1">
              <p className="font-medium text-foreground">{pv.nombre}</p>
              <p className="text-sm text-neutral-500">
                Celular: {pv.celular} · {ETIQUETA_LABEL[pv.etiqueta_default]}
                {pv.pedido_minimo != null && ` · Mínimo $${pv.pedido_minimo}`}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={pv.activo}
                onChange={(e) => handleCambiarActivo(pv.id, e.target.checked)}
              />
              Activo
            </label>
            <button
              onClick={() => {
                setEditando(pv)
                setModo('editar')
              }}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Editar
            </button>
          </li>
        ))}
        {puntosVenta.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No hay puntos de venta cargados.</p>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Formulario**

En `PuntoVentaForm.tsx`, reemplazá únicamente el botón de submit:

```tsx
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
```

(reemplaza el `<button type="submit" ... bg-neutral-900 ...>` existente — el resto del archivo, incluyendo "Cancelar", queda igual).

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

`/admin/puntos-venta` — confirmá "+ Nuevo punto de venta" y "Guardar" en rojo, nombres de comercio en negro de marca.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(dashboard)/puntos-venta"
git commit -m "Apply brand tokens to puntos de venta screen"
```

---

### Task 8: Admin — excepciones de corte

**Files:**
- Modify: `src/app/admin/(dashboard)/excepciones/ExcepcionesClient.tsx`
- Modify: `src/app/admin/(dashboard)/excepciones/ExcepcionForm.tsx`

**Interfaces:** ninguna nueva. `page.tsx` no se toca.

- [ ] **Step 1: Listado**

```tsx
// src/app/admin/(dashboard)/excepciones/ExcepcionesClient.tsx — full file
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
        <h1 className="text-xl font-semibold text-foreground">Excepciones de corte</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover"
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
              <p className="font-medium text-foreground">{excepcion.fecha}</p>
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

- [ ] **Step 2: Formulario**

En `ExcepcionForm.tsx`, reemplazá únicamente el botón de submit:

```tsx
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
```

(reemplaza el `<button type="submit" ... bg-neutral-900 ...>` existente — el resto del archivo, incluyendo "Cancelar", queda igual).

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

`/admin/excepciones` — confirmá "+ Nueva excepción" y "Guardar" en rojo, "Borrar" sigue en rojo semántico de Tailwind (no debería notarse cambio ahí).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(dashboard)/excepciones"
git commit -m "Apply brand tokens to excepciones de corte screen"
```

---

### Task 9: Revisión visual completa + deploy

**Files:** ninguno (verificación únicamente)

- [ ] **Step 1: Build y lint completos**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 2: Push**

```bash
git push origin main
```

(Si falla por el problema de credencial cacheada de Windows: `git push "https://<TOKEN>@github.com/maestriaarg-web/doncarmelo.git" main:main` — nunca con `-u`.)

- [ ] **Step 3: Revisión visual completa contra producción**

En `https://doncarmelo.vercel.app`, recorré **cada pantalla** de las dos superficies y confirmá que:
- El favicon del navegador es el círculo rojo (puede tardar en actualizarse por caché del navegador — probar en pestaña incógnito si no cambia).
- No queda ningún rastro del negro/gris por defecto del scaffold de Next.js en botones principales — todos los CTAs primarios (Ingresar, Confirmar pedido, + Nuevo producto/punto de venta/excepción, Guardar) son rojos.
- Los colores semánticos (ámbar de avisos, rojo de errores/Baja/Borrar, verde/ámbar/rojo de la barra de corte, azul de "congelado") siguen intactos y distinguibles del rojo de marca.
- La tipografía se ve sans-serif consistente en todas las pantallas (no Arial/Times por accidente).
- El `BrandMark` aparece en: catálogo del comercio, header del admin, login del admin — con el mismo círculo rojo en los tres lugares.
- Nada de la funcionalidad cambió: podés hacer un pedido de punta a punta, entrar al admin y gestionar productos/puntos de venta/pedidos/excepciones exactamente igual que antes.

- [ ] **Step 4: Reportar estado**

Sin commit para esta tarea — es el gate final de verificación. Con esto cierra el pase de UI/UX; la única deuda pendiente es reemplazar el círculo placeholder de `BrandMark`/`icon.svg` por el isotipo real cuando el usuario consiga el archivo.
