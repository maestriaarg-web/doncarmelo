-- supabase/migrations/0003_pedidos_estado_conciliacion.sql
-- El check constraint original de pedidos.estado (0001_init.sql) es anónimo,
-- así que Postgres le puso un nombre autogenerado que puede no ser
-- "pedidos_estado_check" si en algún momento se recreó la tabla distinto.
-- Este bloque lo busca por definición en vez de asumir el nombre, para que
-- la migración sea segura de aplicar sin depender de eso.
DO $$
DECLARE
  nombre_constraint text;
BEGIN
  SELECT conname INTO nombre_constraint
  FROM pg_constraint
  WHERE conrelid = 'pedidos'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%estado%';

  IF nombre_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pedidos DROP CONSTRAINT %I', nombre_constraint);
  END IF;
END $$;

ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('confirmado', 'preparado', 'entregado', 'cancelado'));
