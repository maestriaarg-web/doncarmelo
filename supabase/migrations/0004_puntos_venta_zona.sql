-- supabase/migrations/0004_puntos_venta_zona.sql
-- Suma una zona de reparto libre a cada punto de venta, para agrupar pedidos
-- dentro de un turno más allá del orden de creación. Nullable: los comercios
-- existentes quedan sin zona hasta que el admin los edite manualmente.
-- Corré esto en Supabase SQL Editor.

alter table puntos_venta add column zona text;
