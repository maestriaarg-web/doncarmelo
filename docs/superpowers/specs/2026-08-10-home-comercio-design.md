# Home del comercio — Design

## Contexto

Segunda de dos optimizaciones que pidió Catalina (comercio real, ya usando el sistema en producción) tras probarlo — ver [[project-catalina-optimizaciones]] en memoria. Combina tres pedidos suyos en una sola pantalla: un video de embalaje que grabó, un botón para descargar la lista de precios actualizada, y un cartel con los horarios de corte/reparto. La primera (precio final al preparar) ya está en producción.

## Alcance

- Extender la tabla `configuracion` (singleton, ya existe, ya tiene `backup_email`) con `lista_precios_url` y `video_embalaje_url`, ambas nullable.
- `/admin/configuracion`: agregar un selector de archivo (sube a un bucket nuevo de Storage) para la lista de precios, y un input de texto para el link de YouTube del video.
- `/pedido` (catálogo del comercio): un cartel fijo con el horario (texto fijo en el código, no editable), y dos links colapsados por defecto — "Ver video de embalaje" (expande un iframe de YouTube inline) y "Descargar lista de precios" (solo aparece si hay una URL cargada).
- Subida de la lista de precios con nombre de archivo **fijo** (`lista-precios.pdf`, `upsert: true`) para que cada actualización pise el archivo anterior en el mismo lugar del Storage, sin acumular archivos viejos — el plan gratis de Supabase tiene el storage como restricción conocida del proyecto.

Fuera de alcance: guardar el video en el Storage del proyecto (se embebe desde YouTube), hacer el cartel de horarios editable, validar el tipo de archivo de la lista de precios (mismo criterio laxo que ya usa la foto de producto), cualquier cambio a la migración de WhatsApp a producción (decisión de negocio de Juan, no una feature).

## Modelo de datos

Migración nueva `supabase/migrations/0007_configuracion_home_comercio.sql`:

```sql
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

`src/lib/types.ts` — `Configuracion` pasa a:

```ts
export type Configuracion = {
  id: number
  backup_email: string | null
  lista_precios_url: string | null
  video_embalaje_url: string | null
}
```

## Admin — `/admin/configuracion`

Dos campos nuevos en el mismo formulario/acción que ya actualiza `backup_email` (un solo `update` a la fila `id=1`, mismo `exigirAdmin()`):

- **Lista de precios**: selector de archivo. Al elegir uno, sube a `listas-precios/lista-precios.pdf` con `upsert: true` (mismo cliente de Storage que `ProductoForm.tsx`, pero con nombre fijo en vez de `${Date.now()}-${file.name}`), y guarda la URL pública resultante en `lista_precios_url`. Como el nombre es fijo, la URL pública es siempre la misma entre actualizaciones — el campo en la base sirve como el flag de "hay algo cargado" (`null` vs. no `null`), no cambia de valor una vez cargado por primera vez.
- **Video de embalaje**: input de texto simple para pegar el link de YouTube tal cual lo copia el admin (de "Compartir" en YouTube, formato `youtube.com/watch?v=...` o `youtu.be/...`). Se guarda tal cual en `video_embalaje_url` — la conversión a URL de embed la hace el lado del comercio (ver abajo), no acá.

## Comercio — arriba de `/pedido`

`src/app/pedido/page.tsx` (server component) agrega una consulta a `configuracion` (`select lista_precios_url, video_embalaje_url from configuracion where id=1`) y se la pasa a un nuevo componente `HomeComercioBanner`, montado arriba de `CatalogoClient` (no dentro — separación de responsabilidades, `CatalogoClient` ya maneja bastante estado del carrito).

`HomeComercioBanner` (client component, `src/app/pedido/HomeComercioBanner.tsx`):

- Cartel de horario: siempre visible, texto fijo:
  > PEDIDOS HASTA LAS 9AM — REPARTO DE MAÑANA. DESPUÉS DE LAS 17HS — REPARTO DE TARDE. SÁBADOS POR LA TARDE NO HAY REPARTO.
- "Ver video de embalaje": solo se renderiza si `video_embalaje_url` no es null. Es un botón/link que al tocarlo expande un `<iframe>` con la URL de embed derivada del link guardado (extrae el video ID de los formatos `watch?v=ID`, `youtu.be/ID`, o `embed/ID` con una función chica `extraerYoutubeEmbedUrl`, sin dependencias nuevas). Colapsado por defecto.
- "Descargar lista de precios": solo se renderiza si `lista_precios_url` no es null. Es un `<a href={lista_precios_url} target="_blank" rel="noopener noreferrer">` directo — no hace falta expandir nada, simplemente abre/descarga el archivo.

## Manejo de errores

- Si `configuracion` no tiene fila (no debería pasar, es un singleton ya sembrado) o la consulta falla, `/pedido/page.tsx` no debe romper el catálogo — se degrada a no mostrar el banner (mismo criterio que `tienePedidosPrevios`/`obtenerProductosFrecuentes` en `lib/comercio/pedidos.ts`, que ya devuelven un estado vacío ante un error en vez de tirar).
- Si la URL de YouTube guardada no matchea ningún formato conocido, `extraerYoutubeEmbedUrl` devuelve `null` y el link "Ver video" simplemente no se muestra (mismo criterio que "no hay nada cargado").

## Testing

- `extraerYoutubeEmbedUrl`: función pura, casos a cubrir — `watch?v=`, `youtu.be/`, `embed/` ya en formato embed, y un string que no matchea ninguno (devuelve `null`).
- Smoke test end-to-end (post-implementación): cargar un video y una lista de precios desde `/admin/configuracion`, confirmar que ambos links aparecen en `/pedido` y funcionan (el video se reproduce embebido, la descarga abre el archivo); confirmar que sin nada cargado ninguno de los dos links aparece pero el cartel de horario sigue visible; subir una segunda lista de precios y confirmar que pisa la anterior (mismo nombre de archivo, sin acumular archivos viejos en el bucket).
