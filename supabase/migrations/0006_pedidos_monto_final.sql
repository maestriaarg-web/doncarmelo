-- supabase/migrations/0006_pedidos_monto_final.sql
-- Monto final que paga el comercio por el pedido, cargado por el empleado al
-- marcarlo "Preparado" (la mayoría de los productos son pesables, así que el
-- precio real recién se sabe ahí, no al armar el pedido). Nullable: los
-- pedidos existentes y los que todavía no llegaron a "preparado" no tienen
-- monto. Corré esto en Supabase SQL Editor.

alter table pedidos add column monto_final numeric;
