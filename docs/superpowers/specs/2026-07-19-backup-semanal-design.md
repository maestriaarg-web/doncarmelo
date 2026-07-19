# Backup semanal por email

**Fecha:** 2026-07-19
**Contexto de origen:** al cerrar Fase 2 se detectó que el hosting actual (Vercel Hobby, Supabase free) tiene dos riesgos de continuidad: Vercel Hobby prohíbe uso comercial en sus términos de servicio, y el proyecto de Supabase gratuito se pausa automáticamente tras una semana de inactividad. El usuario decidió no migrar de plan/proveedor por ahora, y en cambio quiere una red de contingencia: un backup periódico que le permita a Don Carmelo seguir operando a mano si el sistema queda caído hasta que se resuelva el problema.

## Contexto

Hoy toda la información del negocio (comercios, catálogo, pedidos) vive únicamente en Supabase, accesible solo a través de la app. Si Vercel o Supabase fallan (por ejemplo, el proyecto de Supabase se pausa por inactividad), Don Carmelo pierde acceso completo a esa información hasta que alguien lo resuelva. El objetivo es que, sin importar qué esté pasando con el sistema, Don Carmelo tenga siempre a mano (en su casilla de mail) una copia razonablemente reciente de los datos operativos clave.

## Alcance

**Incluye:**
- Pantalla nueva `/admin/configuracion` (solo accesible para el rol `admin`, no `empleado`) con un único campo: el email al que se manda el backup semanal. Guarda en una tabla nueva de una sola fila.
- Endpoint `/api/backup-semanal` que arma un Excel de 3 hojas (puntos de venta, productos, pedidos de los últimos 7 días) y lo manda por mail al `backup_email` configurado, usando Resend.
- Disparo automático semanal (domingo a la noche, hora Argentina) vía Vercel Cron.
- Protección del endpoint con un secreto compartido (`CRON_SECRET`), para que no sea invocable públicamente sin autorización.

**Fuera de alcance:**
- Cualquier mecanismo de restauración automática de datos a partir del Excel — es un respaldo de lectura/continuidad manual, no un sistema de import/restore.
- Alertas o monitoreo si el envío falla (sin sistema de monitoreo en el proyecto; el error queda en los logs de Vercel).
- Múltiples destinatarios — un solo email configurado a la vez.
- Backups de nada que no sea `puntos_venta`, `productos` y `pedidos`/`pedido_items` (no incluye `excepciones_corte` ni usuarios del admin).
- Migrar de proveedor de hosting/base de datos — decisión explícita del usuario de mantener Vercel Hobby + Supabase free por ahora.

## Cómo se implementa

- **Migración**: tabla `configuracion` con columnas `id` (siempre `1`, fila única), `backup_email text`. Se crea con una fila inicial (`backup_email` en `null`) para que el `UPDATE` desde el formulario siempre tenga una fila para actualizar.
- **`src/lib/admin/configuracion.ts`**: `obtenerConfiguracion()` (lee la fila única) y una Server Action `actualizarBackupEmail(email: string): Promise<ActionResult>` que hace `UPDATE configuracion SET backup_email = $1 WHERE id = 1`. Mismo patrón `ActionResult` que el resto del proyecto.
- **`/admin/configuracion/page.tsx` + `ConfiguracionForm.tsx`**: Server Component que lee la config actual y la pasa a un formulario cliente con un solo campo de email y botón "Guardar" — mismo patrón visual que las demás pantallas ABM del admin. Se agrega el link "Configuración" a la nav del layout del dashboard, visible solo para `admin` (mismo patrón condicional que ya usa `esAdmin` en `layout.tsx` para ocultar otros links a `empleado`).
- **`src/lib/backup/generarExcel.ts`**: función pura `generarBackupExcel({ puntosVenta, productos, pedidos }): Promise<Buffer>` que arma el workbook con `exceljs` (nueva dependencia): hoja "Puntos de venta" (nombre, celular, dirección, zona, contacto, etiqueta_default, pedido_minimo, activo), hoja "Productos" (nombre, categoría, unidad, precio_sugerido, congelado, disponible, activo), hoja "Pedidos (últimos 7 días)" — una fila por línea de producto pedido: fecha_entrega, turno, punto de venta, estado, producto, cantidad, unidad. Los pedidos se traen por `creado_en >= hace 7 días` (no por `fecha_entrega`), para reflejar lo que efectivamente se cargó en la semana.
- **`src/app/api/backup-semanal/route.ts`**: `GET` handler. Primero valida el header `Authorization: Bearer ${process.env.CRON_SECRET}` (401 si no coincide). Usa `createServiceClient()` (no hay sesión de usuario en un cron job) para traer los 3 datasets, llama a `generarBackupExcel`, y si `configuracion.backup_email` no es null, manda el mail con Resend (`resend.emails.send`) adjuntando el buffer como `backup-doncarmelo-YYYY-MM-DD.xlsx`. Si `backup_email` es null (nunca configurado), no manda nada y responde 200 igual (no es un error, es config pendiente). Nunca lanza sin capturar — igual que `notificarEstadoPedido`, cualquier fallo se loguea con `console.error` y responde 500, pero no rompe nada más (nadie más llama a este endpoint salvo el cron).
- **`vercel.json`**: agrega `{ "crons": [{ "path": "/api/backup-semanal", "schedule": "0 2 * * 1" }] }` (02:00 UTC lunes = 23:00 hora Argentina domingo, sin horario de verano).
- **Nuevas variables de entorno**: `CRON_SECRET` (generada, va en Vercel y en `.env.local` para pruebas manuales) y `RESEND_API_KEY` (ya reservada en `.env.local`, hay que generarla en Resend y completarla — sigue vacía hoy).
- **Nueva dependencia**: `exceljs` (generación de `.xlsx`; no hay ninguna librería de este tipo en el proyecto hoy).

## Testing

Sin suite automatizada (decisión ya confirmada para todo el proyecto). Verificación por `npm run build` + `npm run lint`, más prueba manual: configurar un `backup_email` de prueba en `/admin/configuracion`, invocar el endpoint a mano (`curl` con el header `Authorization` correcto) y confirmar que el mail llega con el Excel adjunto y las 3 hojas con datos correctos. Probar también el caso sin `backup_email` configurado (no debe mandar mail ni fallar) y el caso de `Authorization` inválido (debe responder 401).
