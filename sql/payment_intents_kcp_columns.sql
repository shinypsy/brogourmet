-- BroGourmet: payment_intents 에 KCP(및 기타 PG) 연동용 컬럼 추가
-- 전제: PostgreSQL. gourmet 부팅 시 app.db_migrate.ensure_payment_intent_kcp_columns() 로도 동일 적용됨.
-- 수동 실행: psql "$DATABASE_URL" -f sql/payment_intents_kcp_columns.sql

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS merchant_order_id VARCHAR(70);
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS pg_extra JSON;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_merchant_order_id
  ON payment_intents (merchant_order_id)
  WHERE merchant_order_id IS NOT NULL;
