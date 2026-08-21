-- Marca los pedidos cargados manualmente por el admin (ej: pedidos que llegan
-- por audio de WhatsApp) para distinguirlos visualmente de los que el propio
-- comercio cargó desde /pedido. No afecta ninguna lógica de reportes/estado:
-- es puramente informativo.
alter table pedidos
  add column cargado_por_admin boolean not null default false;
