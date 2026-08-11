# Home del comercio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al catálogo del comercio (`/pedido`) un cartel fijo de horarios, un video de embalaje embebido desde YouTube, y un link de descarga de la lista de precios actualizada — todo cargado por el admin desde `/admin/configuracion`.

**Architecture:** Dos columnas nuevas nullable en la tabla singleton `configuracion` (mismo patrón que `backup_email`) más un bucket de Storage nuevo (`listas-precios`, mismo patrón de políticas que el bucket `productos`). El admin sube el archivo con nombre fijo (`upsert: true`, sin acumular versiones viejas) y pega el link de YouTube tal cual. El comercio ve un componente nuevo, `HomeComercioBanner`, montado como hermano de `CatalogoClient` (no dentro), con el video y la descarga colapsados detrás de links y condicionados a que la URL exista.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres + Storage + `@supabase/ssr`). Sin dependencias nuevas.

## Global Constraints

- Sin suite de tests automatizada (decisión ya confirmada para todo el proyecto). Verificación: `npm run build && npm run lint` + prueba manual.
- Migraciones SQL se aplican manualmente por el usuario en el Supabase Dashboard SQL Editor — nunca ejecutar `execute_sql`/`apply_migration` contra el proyecto real desde acá.
- Copy en español, mismo tono que el resto de la app.
- Reusar tokens de diseño existentes: `bg-primary`/`hover:bg-primary-hover` (solo CTA primario), `bg-background`, `text-foreground`, `text-neutral-*` para texto secundario.
- Server Actions devuelven `ActionResult` (`{error: string} | {success: true}`), nunca `throw`.
- El cartel de horario es texto fijo en el código, no editable desde el admin.
- El video NO se guarda en el Storage del proyecto — solo se guarda el link de YouTube, el embed se arma en el lado del comercio.
- La lista de precios se sube siempre con el mismo nombre de archivo (`lista-precios.pdf`) y `upsert: true`, para que cada actualización pise la anterior sin acumular archivos.
- El video y el botón de descarga solo se muestran si su URL correspondiente no es `null`. El cartel de horario se muestra siempre.
- Fuera de alcance (no crear ninguna tarea para esto): validar el tipo de archivo subido, hacer el cartel de horario editable, cualquier cambio a la migración de WhatsApp a producción.

---

### Task 1: Migración + tipos

**Files:**
- Create: `supabase/migrations/0007_configuracion_home_comercio.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `Configuracion.lista_precios_url: string | null`, `Configuracion.video_embalaje_url: string | null` — consumidos por Task 2 y Task 3.

- [ ] **Step 1: Migración — archivo completo**

```sql
-- supabase/migrations/0007_configuracion_home_comercio.sql
-- Home del comercio: link a la lista de precios actualizada (PDF/Excel en
-- Storage) y al video de embalaje (YouTube). Ambas nullable — el comercio no
-- ve nada de esto hasta que el admin cargue algo. Corré esto en Supabase SQL
-- Editor.

alter table configuracion add column lista_precios_url text;
alter table configuracion add column video_embalaje_url text;

-- Storage: bucket público para la lista de precios, mismo patrón de
-- políticas que el bucket "productos" (0001_init.sql).
insert into storage.buckets (id, name, public)
values ('listas-precios', 'listas-precios', true)
on conflict (id) do nothing;

create policy "listas_precios_public_read" on storage.objects for select
  using (bucket_id = 'listas-precios');
create policy "listas_precios_admin_write" on storage.objects for insert
  with check (bucket_id = 'listas-precios' and auth.role() = 'authenticated');
create policy "listas_precios_admin_update" on storage.objects for update
  using (bucket_id = 'listas-precios' and auth.role() = 'authenticated');
```

- [ ] **Step 2: Tipos — `src/lib/types.ts`, archivo completo**

```ts
// src/lib/types.ts
// Server Actions must return errors (not throw) so the message survives
// Next.js's production redaction of thrown Server Action errors.
export type ActionResult = { error: string } | { success: true }

export type Producto = {
  id: string
  nombre: string
  categoria: string
  unidad: string
  precio_sugerido: number | null
  congelado: boolean
  disponible: boolean
  foto_url: string | null
  activo: boolean
  creado_en: string
}

export type PuntoVenta = {
  id: string
  nombre: string
  direccion: string | null
  contacto: string | null
  celular: string
  zona: string | null
  etiqueta_default: 'grande' | 'chica' | 'ambas'
  pedido_minimo: number | null
  activo: boolean
  creado_en: string
}

export type ItemCarrito = {
  productoId: string
  nombre: string
  unidad: string
  precioSugerido: number | null
  cantidad: number
}

export type PedidoConItems = {
  id: string
  fecha_entrega: string
  turno_reparto: 'manana' | 'tarde'
  tipo_etiqueta: 'grande' | 'chica' | 'ambas'
  estado: string
  creado_en: string
  monto_final: number | null
  pedido_items: {
    cantidad: number
    producto_id: string
    productos: {
      nombre: string
      unidad: string
      precio_sugerido: number | null
      activo: boolean
      disponible: boolean
    } | null
  }[]
}

export type PedidoAdmin = {
  id: string
  fecha_entrega: string
  turno_reparto: 'manana' | 'tarde'
  tipo_etiqueta: 'grande' | 'chica' | 'ambas'
  estado: 'confirmado' | 'preparado' | 'entregado' | 'cancelado'
  fuera_de_horario: boolean
  creado_en: string
  monto_final: number | null
  puntos_venta: {
    id: string
    nombre: string
    direccion: string | null
    zona: string | null
  } | null
  pedido_items: {
    id: string
    cantidad: number
    producto_id: string
    productos: {
      nombre: string
      categoria: string
      unidad: string
      precio_sugerido: number | null
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

export type RolAdmin = 'admin' | 'empleado'

export type UsuarioAdmin = {
  id: string
  email: string
  rol: RolAdmin
}

export type Configuracion = {
  id: number
  backup_email: string | null
  lista_precios_url: string | null
  video_embalaje_url: string | null
}
```

- [ ] **Step 3: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores. (Los campos nuevos todavía no se usan en ningún lado, pero el tipo y la migración ya están listos.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_configuracion_home_comercio.sql src/lib/types.ts
git commit -m "Add lista_precios_url/video_embalaje_url to configuracion and a Storage bucket for the price list"
```

**Nota para quien ejecute este plan:** después de este task, recordarle al usuario que corra la migración `0007_configuracion_home_comercio.sql` en el Supabase Dashboard SQL Editor antes de dar por buena la prueba manual final (Task 4).

---

### Task 2: Admin — `/admin/configuracion` con lista de precios y video

**Files:**
- Modify: `src/app/admin/(dashboard)/configuracion/actions.ts`
- Modify: `src/app/admin/(dashboard)/configuracion/ConfiguracionForm.tsx`

**Interfaces:**
- Consumes: `Configuracion.lista_precios_url`, `Configuracion.video_embalaje_url` (Task 1).
- Produces: `actualizarConfiguracion(input: ConfiguracionInput): Promise<ActionResult>` — reemplaza a `actualizarBackupEmail`, no usado por ningún otro archivo de este plan.

- [ ] **Step 1: `actions.ts` — archivo completo**

`actualizarBackupEmail` se reemplaza por `actualizarConfiguracion`, que actualiza los 3 campos en un solo `update` (mismo patrón de un solo submit que ya usan `PuntoVentaForm`/`ProductoForm` en vez de un botón por campo).

```ts
// src/app/admin/(dashboard)/configuracion/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { obtenerRolActual } from '@/lib/admin/auth'
import type { ActionResult } from '@/lib/types'

export type ConfiguracionInput = {
  backup_email: string | null
  lista_precios_url: string | null
  video_embalaje_url: string | null
}

// Server Actions se invocan por id de acción, no por ruta — proxy.ts protege
// el RENDER de /admin/configuracion, pero no la ejecución de esta función si
// alguien arma el request a mano. Por eso valida el rol del que llama por su
// cuenta (mismo patrón que src/app/admin/(dashboard)/usuarios/actions.ts).
async function exigirAdmin(): Promise<{ userId: string } | { error: string }> {
  const actual = await obtenerRolActual()
  if (!actual || actual.rol !== 'admin') return { error: 'No autorizado.' }
  return { userId: actual.userId }
}

export async function actualizarConfiguracion(input: ConfiguracionInput): Promise<ActionResult> {
  const auth = await exigirAdmin()
  if ('error' in auth) return auth

  const supabase = await createClient()
  const { error } = await supabase.from('configuracion').update(input).eq('id', 1)

  if (error) return { error: error.message }
  revalidatePath('/admin/configuracion')
  revalidatePath('/pedido')
  return { success: true }
}
```

- [ ] **Step 2: `ConfiguracionForm.tsx` — archivo completo**

Suma el selector de archivo para la lista de precios (sube a `listas-precios/lista-precios.pdf` con `upsert: true` al elegir un archivo, igual que la foto de producto en `ProductoForm.tsx` pero con nombre fijo en vez de `${Date.now()}-${file.name}`) y el input de texto para el link de YouTube. Los 3 campos se guardan juntos al tocar "Guardar".

```tsx
// src/app/admin/(dashboard)/configuracion/ConfiguracionForm.tsx
'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Configuracion } from '@/lib/types'
import { actualizarConfiguracion } from './actions'

export function ConfiguracionForm({ configuracion }: { configuracion: Configuracion }) {
  const [backupEmail, setBackupEmail] = useState(configuracion.backup_email ?? '')
  const [listaPreciosUrl, setListaPreciosUrl] = useState(configuracion.lista_precios_url ?? '')
  const [videoEmbalajeUrl, setVideoEmbalajeUrl] = useState(configuracion.video_embalaje_url ?? '')
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  async function handleListaPreciosChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSubiendo(true)
    setError(null)
    try {
      const supabase = createClient()
      const path = 'lista-precios.pdf'
      const { error: uploadError } = await supabase.storage
        .from('listas-precios')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('listas-precios').getPublicUrl(path)
      setListaPreciosUrl(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la lista de precios')
    } finally {
      setSubiendo(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setGuardado(false)
    const result = await actualizarConfiguracion({
      backup_email: backupEmail || null,
      lista_precios_url: listaPreciosUrl || null,
      video_embalaje_url: videoEmbalajeUrl || null,
    })
    if ('error' in result) {
      setError(result.error)
    } else {
      setGuardado(true)
    }
    setGuardando(false)
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-foreground">Configuración</h1>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
      >
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {guardado && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Guardado.</p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Email para el backup semanal
          </label>
          <input
            type="email"
            value={backupEmail}
            onChange={(e) => setBackupEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          />
          <p className="mt-1 text-sm text-neutral-500">
            Todos los domingos a la noche se manda a esta casilla un Excel con los puntos de
            venta, el catálogo y los pedidos de la semana. Dejalo vacío para no mandar nada.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Lista de precios actualizada
          </label>
          <input
            type="file"
            onChange={handleListaPreciosChange}
            disabled={subiendo}
            className="w-full text-sm"
          />
          {subiendo && <p className="mt-1 text-sm text-neutral-500">Subiendo...</p>}
          {listaPreciosUrl && !subiendo && (
            <p className="mt-1 text-sm text-neutral-500">
              Archivo cargado.{' '}
              <a
                href={listaPreciosUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Ver actual
              </a>
            </p>
          )}
          <p className="mt-1 text-sm text-neutral-500">
            Los comercios ven un botón para descargar este archivo. Subir uno nuevo reemplaza al
            anterior.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Video de embalaje (link de YouTube)
          </label>
          <input
            type="text"
            value={videoEmbalajeUrl}
            onChange={(e) => setVideoEmbalajeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          />
          <p className="mt-1 text-sm text-neutral-500">
            Pegá el link tal cual lo copiás de "Compartir" en YouTube. Dejalo vacío para no
            mostrar ningún video.
          </p>
        </div>
        <button
          type="submit"
          disabled={guardando || subiendo}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(dashboard)/configuracion/actions.ts" "src/app/admin/(dashboard)/configuracion/ConfiguracionForm.tsx"
git commit -m "Add lista de precios upload and video de embalaje link to /admin/configuracion"
```

---

### Task 3: Comercio — `HomeComercioBanner` en `/pedido`

**Files:**
- Create: `src/app/pedido/HomeComercioBanner.tsx`
- Modify: `src/app/pedido/page.tsx`

**Interfaces:**
- Consumes: `Configuracion.lista_precios_url`, `Configuracion.video_embalaje_url` (Task 1).
- Produces: `extraerYoutubeEmbedUrl(url: string): string | null` — función pura exportada, verificada manualmente en Task 4 (sin test runner en este proyecto).

- [ ] **Step 1: `HomeComercioBanner.tsx` — archivo completo**

Cartel de horario siempre visible (texto fijo). Debajo, un link "Ver video de embalaje" (solo si `videoEmbalajeUrl` da una URL de embed válida) que expande un iframe al tocarlo, y un link de descarga directa (solo si `listaPreciosUrl` no es null).

```tsx
// src/app/pedido/HomeComercioBanner.tsx
'use client'

import { useState } from 'react'

const HORARIO_TEXTO =
  'PEDIDOS HASTA LAS 9AM — REPARTO DE MAÑANA. DESPUÉS DE LAS 17HS — REPARTO DE TARDE. SÁBADOS POR LA TARDE NO HAY REPARTO.'

/**
 * Acepta los formatos comunes de link de YouTube (watch?v=, youtu.be/,
 * embed/ ya armado) y devuelve la URL de embed, o null si no matchea
 * ninguno — en ese caso el link de "Ver video" simplemente no se muestra.
 */
export function extraerYoutubeEmbedUrl(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`

  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`

  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`

  return null
}

export function HomeComercioBanner({
  listaPreciosUrl,
  videoEmbalajeUrl,
}: {
  listaPreciosUrl: string | null
  videoEmbalajeUrl: string | null
}) {
  const [mostrandoVideo, setMostrandoVideo] = useState(false)
  const embedUrl = videoEmbalajeUrl ? extraerYoutubeEmbedUrl(videoEmbalajeUrl) : null

  return (
    <div className="space-y-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2">
      <p className="text-center text-xs font-semibold text-neutral-700">{HORARIO_TEXTO}</p>

      {(embedUrl || listaPreciosUrl) && (
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          {embedUrl && (
            <button
              onClick={() => setMostrandoVideo((v) => !v)}
              className="font-medium text-neutral-600 underline"
            >
              {mostrandoVideo ? 'Ocultar video de embalaje' : 'Ver video de embalaje'}
            </button>
          )}
          {listaPreciosUrl && (
            <a
              href={listaPreciosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-600 underline"
            >
              Descargar lista de precios
            </a>
          )}
        </div>
      )}

      {mostrandoVideo && embedUrl && (
        <div className="aspect-video w-full overflow-hidden rounded-md">
          <iframe
            src={embedUrl}
            title="Video de embalaje"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `page.tsx` — archivo completo**

Agrega la consulta a `configuracion` y monta `HomeComercioBanner` como hermano de `CatalogoClient`, envueltos en un Fragment. Si la consulta a `configuracion` falla, el catálogo no debe romperse — se degrada a no mostrar el banner (mismo criterio que `tienePedidosPrevios`/`obtenerProductosFrecuentes`, que ya se degradan así).

```tsx
// src/app/pedido/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { tienePedidosPrevios, obtenerProductosFrecuentes } from '@/lib/comercio/pedidos'
import type { Configuracion, Producto } from '@/lib/types'
import { CatalogoClient } from './CatalogoClient'
import { HomeComercioBanner } from './HomeComercioBanner'

export const dynamic = 'force-dynamic'

export default async function CatalogoPage() {
  const puntoVentaId = await getPuntoVentaId()

  const supabase = createServiceClient()
  const { data: productos, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true })
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)

  const { data: configuracion } = await supabase
    .from('configuracion')
    .select('*')
    .eq('id', 1)
    .maybeSingle()
  const config = configuracion as Configuracion | null

  const hayHistorial = puntoVentaId ? await tienePedidosPrevios(puntoVentaId) : false
  const productosFrecuentes =
    puntoVentaId && hayHistorial ? await obtenerProductosFrecuentes(puntoVentaId) : []

  return (
    <>
      <HomeComercioBanner
        listaPreciosUrl={config?.lista_precios_url ?? null}
        videoEmbalajeUrl={config?.video_embalaje_url ?? null}
      />
      <CatalogoClient
        productos={(productos ?? []) as Producto[]}
        hayHistorial={hayHistorial}
        productosFrecuentes={productosFrecuentes}
      />
    </>
  )
}
```

- [ ] **Step 3: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/pedido/HomeComercioBanner.tsx src/app/pedido/page.tsx
git commit -m "Show a horario banner, video de embalaje, and lista de precios download on /pedido"
```

---

### Task 4: Smoke test end-to-end + deploy

No es un task de código — es la verificación manual final, ejecutada directamente (sin subagente), igual que el cierre de cada sub-proyecto anterior.

- [ ] Confirmar con el usuario que ya corrió la migración `0007_configuracion_home_comercio.sql` en el Supabase Dashboard.
- [ ] `git push` de todos los commits de este plan.
- [ ] Deploy a producción (Vercel) y esperar a que termine.
- [ ] En `/admin/configuracion`, con nada cargado todavía: confirmar en `/pedido` que el cartel de horario se ve pero no aparece ningún link de video ni de descarga.
- [ ] Verificar `extraerYoutubeEmbedUrl` manualmente con los 3 formatos de link (`watch?v=`, `youtu.be/`, `embed/`) y un string que no matchea ninguno — confirmar que da la URL de embed esperada o `null` según corresponda.
- [ ] Cargar un link de YouTube real en `/admin/configuracion`, confirmar que en `/pedido` aparece "Ver video de embalaje" y que al tocarlo se reproduce embebido.
- [ ] Subir un archivo de prueba como lista de precios, confirmar que en `/pedido` aparece "Descargar lista de precios" y que el link abre/descarga el archivo correcto.
- [ ] Subir un segundo archivo de prueba como lista de precios, confirmar que la URL pública sigue siendo la misma (mismo nombre de archivo) y que el bucket `listas-precios` tiene un solo objeto, no dos.
- [ ] Limpiar los datos de prueba que no correspondan a contenido real (borrar el link de YouTube y el archivo de prueba de `/admin/configuracion` si no son los reales que el usuario quiere dejar cargados).

---
