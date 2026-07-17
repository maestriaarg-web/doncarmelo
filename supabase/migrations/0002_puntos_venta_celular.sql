-- Reemplaza el código de acceso arbitrario por el número de celular del comercio
-- (mismo mecanismo de acceso sin contraseña, identificador más fácil de recordar).
-- Corré esto en Supabase SQL Editor.

alter table puntos_venta rename column codigo_acceso to celular;
