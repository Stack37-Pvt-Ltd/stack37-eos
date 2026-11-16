-- TASK-UK-SUPER-005A: index the customer creator foreign key for delete checks.
CREATE INDEX customers_created_by_idx ON public.customers (created_by);
