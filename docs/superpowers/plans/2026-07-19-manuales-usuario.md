# Manuales de usuario (comercio y admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Producir dos PDFs con capturas de pantalla reales y texto en español — `Manual del comercio.pdf` y `Manual del administrador.pdf` — para entregar junto con el producto final.

**Architecture:** Se crea un punto de venta y pedidos de demostración en producción para tener datos limpios y no sensibles. Se recorre cada pantalla relevante con el navegador (mobile para `/pedido/*`, desktop para `/admin/*`), se guarda una captura por pantalla, y se arma un Markdown por manual con las capturas embebidas y texto explicativo. Cada Markdown se convierte a PDF. Al final se borran los datos de demostración.

**Tech Stack:** Datos vía Supabase REST (service-role key, igual que las pruebas manuales de sub-proyectos anteriores). Capturas vía la herramienta de navegador. Documentos en Markdown, convertidos a PDF.

## Global Constraints

- Este sub-proyecto no toca código de la aplicación — no hay `npm run build`/`npm run lint` en ningún task. La verificación de cada task es visual: la captura existe, corresponde a la pantalla correcta, y el texto la describe con precisión.
- Todo el texto va en español, mismo tono llano que el resto de la copy de la app (ver cualquier pantalla existente como referencia de estilo).
- Ningún dato de un comercio real puede aparecer en ninguna captura — todas las pantallas que muestren datos de pedidos/comercios se capturan usando el punto de venta de demostración "Comercio de Ejemplo" (Task 1), nunca `Almacén Sur` ni `Dietética Norte` ni ningún comercio real.
- El catálogo de productos SÍ es real (no es información sensible, es el menú del negocio) — hoy son exactamente estos dos productos activos: "Bife de chorizo" (Vacuno, kg, $8500 sugerido) y "Hamburguesas x4" (Hamburguesas, paquete, sin precio sugerido). Las capturas del catálogo/carrito deben reflejar estos productos reales, no inventados.
- Capturas: viewport mobile (390x844 o similar) para todo el flujo `/pedido/*`; viewport desktop (1280x800) para todo `/admin/*`.
- Guardar las capturas en `docs/superpowers/assets/manuales/` con nombres descriptivos (`comercio-01-ingreso.png`, `admin-03-pedidos-dia.png`, etc. — numerados en el orden en que aparecen en el manual correspondiente).
- Los dos Markdown fuente van en `docs/superpowers/assets/manuales/manual-comercio.md` y `manual-admin.md`; los PDFs finales van en `docs/manuales/Manual del comercio.pdf` y `docs/manuales/Manual del administrador.pdf`.
- Fuera de alcance (no crear ningún task para esto): video, página de ayuda dentro de la app, documentación técnica para desarrolladores, traducción a otros idiomas.

---

### Task 1: Datos de demostración

**Files:** Ninguno (esto es un setup de datos en producción vía Supabase REST, no código).

**Interfaces:**
- Produces: un punto de venta "Comercio de Ejemplo" y 3 pedidos de ejemplo en distintos estados — consumidos por Task 2 (para el login del comercio) y Task 3 (para las pantallas de pedidos/remitos del admin).

- [ ] **Step 1: Crear el punto de venta de demostración**

Vía `curl` con la `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`, insertar en `puntos_venta`:

```json
{
  "nombre": "Comercio de Ejemplo",
  "direccion": "Av. Ejemplo 123",
  "contacto": "Encargado de compras",
  "celular": "3492000000",
  "zona": "Centro",
  "etiqueta_default": "ambas",
  "pedido_minimo": 3000,
  "activo": true
}
```

Guardar el `id` devuelto — se usa en todos los pasos siguientes.

- [ ] **Step 2: Crear 3 pedidos de ejemplo con distintos estados**

Usando el `id` de "Comercio de Ejemplo" y los dos productos reales del catálogo (buscar sus `id` con `select id, nombre from productos where activo = true`), crear en `pedidos` (fecha_entrega = hoy, turno_reparto = "manana", tipo_etiqueta = "ambas", fuera_de_horario = false):

1. Un pedido con `estado = "confirmado"`, con 2 `pedido_items`: 2 kg de Bife de chorizo, 1 paquete de Hamburguesas x4.
2. Un pedido con `estado = "preparado"`, con 1 `pedido_item`: 1 kg de Bife de chorizo.
3. Un pedido con `estado = "entregado"`, con 1 `pedido_item`: 2 paquetes de Hamburguesas x4.

- [ ] **Step 3: Verificación**

Confirmar por REST (`select * from pedidos where punto_venta_id = eq.<id>`) que los 3 pedidos y sus items quedaron creados con los estados correctos.

---

### Task 2: Manual del comercio — capturas y redacción

**Files:**
- Create: `docs/superpowers/assets/manuales/comercio-*.png` (una captura por pantalla)
- Create: `docs/superpowers/assets/manuales/manual-comercio.md`

**Interfaces:**
- Consumes: el punto de venta "Comercio de Ejemplo" y su celular `3492000000` (Task 1).

- [ ] **Step 1: Configurar viewport mobile**

Redimensionar el navegador a un tamaño mobile (390x844) antes de sacar cualquier captura de esta sección.

- [ ] **Step 2: Recorrer y capturar cada pantalla**

Navegar `https://doncarmelo.vercel.app` y sacar una captura de cada una de estas pantallas, en este orden, guardando cada imagen en `docs/superpowers/assets/manuales/`:

1. `comercio-01-ingreso.png` — pantalla de ingreso por celular (antes de loguearse).
2. `comercio-02-catalogo.png` — catálogo después de ingresar con `3492000000`, mostrando los productos.
3. `comercio-03-buscador.png` — el buscador de productos en uso (escribir "bife" o similar y mostrar el filtro funcionando).
4. `comercio-04-carrito.png` — el carrito con al menos un producto agregado y su cantidad.
5. `comercio-05-confirmar.png` — la pantalla de confirmar pedido, mostrando la elección de fecha/turno y tipo de etiqueta.
6. `comercio-06-listo.png` — la pantalla de confirmación final después de confirmar un pedido de prueba (fecha_entrega, turno).
7. `comercio-07-historial.png` — el historial de pedidos, mostrando los pedidos de "Comercio de Ejemplo" con sus estados (usar los 3 pedidos de Task 1, más el que se acaba de confirmar en el paso 6).
8. `comercio-08-repetir.png` — el botón/flujo de "repetir último pedido" en el historial.
9. `comercio-09-frecuentes.png` — la sección de productos frecuentes (si tiene suficientes pedidos previos para aparecer; si no aparece con solo 4 pedidos, anotarlo como observación y omitir esta captura en el manual).

- [ ] **Step 3: Redactar `manual-comercio.md`**

Un Markdown con un título, una breve introducción (una frase: "Esta guía te muestra paso a paso cómo hacer tu pedido a Almacén Don Carmelo"), y una sección por pantalla capturada: la imagen embebida (`![](comercio-0N-nombre.png)`) seguida de 2-4 líneas explicando qué hacer en esa pantalla, en español llano, dirigido a alguien sin conocimientos técnicos.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/assets/manuales/comercio-*.png docs/superpowers/assets/manuales/manual-comercio.md
git commit -m "Add manual del comercio: screenshots and Spanish walkthrough copy"
```

---

### Task 3: Manual del administrador — capturas y redacción

**Files:**
- Create: `docs/superpowers/assets/manuales/admin-*.png` (una captura por pantalla)
- Create: `docs/superpowers/assets/manuales/manual-admin.md`

**Interfaces:**
- Consumes: sesión de admin (`jgallino1@gmail.com`), y los pedidos/punto de venta de demostración (Task 1) para que las pantallas de pedidos/remitos tengan contenido real que mostrar.

- [ ] **Step 1: Configurar viewport desktop**

Redimensionar el navegador a un tamaño desktop (1280x800) antes de sacar cualquier captura de esta sección.

- [ ] **Step 2: Recorrer y capturar cada pantalla**

Logueado como admin en `https://doncarmelo.vercel.app/admin/login`, sacar una captura de cada una de estas pantallas:

1. `admin-01-login.png` — pantalla de login.
2. `admin-02-pedidos-dia.png` — `/admin/pedidos` del día de hoy, mostrando la lista de preparación consolidada y los pedidos de "Comercio de Ejemplo" agrupados por zona ("Centro").
3. `admin-03-badges.png` — un pedido con badge de "fuera de horario" o "cantidad atípica" visible (si ninguno de los pedidos de Task 1 dispara estos badges naturalmente, crear un cuarto pedido de ejemplo temporal que sí los dispare — cantidad más del doble del promedio histórico para atípico, o fuera del horario de corte para el otro — y borrarlo junto con el resto de los datos de demostración en Task 4).
4. `admin-04-estados.png` — los botones de "Marcar preparado" / "Marcar entregado" / "Cancelar" en un pedido, mostrando el flujo de estados.
5. `admin-05-remito.png` — un remito individual impreso/previsualizado, mostrando la zona y los productos.
6. `admin-06-productos.png` — el ABM de productos, listado completo.
7. `admin-07-productos-form.png` — el formulario de alta/edición de un producto.
8. `admin-08-puntos-venta.png` — el ABM de puntos de venta, con el filtro por zona visible y "Comercio de Ejemplo" en la lista.
9. `admin-09-puntos-venta-form.png` — el formulario de alta/edición de un punto de venta, mostrando el campo de zona con el autocompletado.
10. `admin-10-excepciones.png` — el ABM de excepciones de corte.
11. `admin-11-usuarios.png` — la pantalla de gestión de usuarios, mostrando roles admin/empleado.
12. `admin-12-configuracion.png` — la pantalla de configuración del backup semanal.

- [ ] **Step 3: Redactar `manual-admin.md`**

Un Markdown con título, una breve introducción, y una sección por pantalla capturada: imagen embebida + 2-4 líneas explicando qué hacer, en español llano. Sumar al final una sección corta sin captura ("Avisos automáticos por WhatsApp") explicando en 3-4 líneas que el sistema le avisa solo al comercio por WhatsApp cuando su pedido cambia de estado (confirmado, preparado, entregado, cancelado), sin que el admin tenga que hacer nada manual.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/assets/manuales/admin-*.png docs/superpowers/assets/manuales/manual-admin.md
git commit -m "Add manual del administrador: screenshots and Spanish walkthrough copy"
```

---

### Task 4: Conversión a PDF + limpieza de datos de demostración

**Files:**
- Create: `docs/manuales/Manual del comercio.pdf`
- Create: `docs/manuales/Manual del administrador.pdf`

**Interfaces:**
- Consumes: `manual-comercio.md` y `manual-admin.md` con sus imágenes (Task 2, Task 3).

- [ ] **Step 1: Convertir ambos Markdown a PDF**

Convertir `docs/superpowers/assets/manuales/manual-comercio.md` → `docs/manuales/Manual del comercio.pdf`, y `docs/superpowers/assets/manuales/manual-admin.md` → `docs/manuales/Manual del administrador.pdf`, con las imágenes embebidas correctamente.

- [ ] **Step 2: Revisión visual de ambos PDFs**

Abrir cada PDF y confirmar: todas las capturas se ven completas y legibles, el texto no tiene errores de tipeo, el orden de las secciones tiene sentido como guía paso a paso.

- [ ] **Step 3: Commit de los PDFs**

```bash
git add "docs/manuales/Manual del comercio.pdf" "docs/manuales/Manual del administrador.pdf"
git commit -m "Add Manual del comercio and Manual del administrador PDFs"
```

- [ ] **Step 4: Borrar los datos de demostración**

Vía `curl` con la `SUPABASE_SERVICE_ROLE_KEY`, borrar (en este orden, por las foreign keys): los `pedido_items` de los pedidos de demostración, los `pedidos` de demostración, y el punto de venta "Comercio de Ejemplo". Confirmar por REST que no queda ningún rastro (`select * from puntos_venta where nombre = eq.Comercio de Ejemplo` debe devolver vacío).

---
