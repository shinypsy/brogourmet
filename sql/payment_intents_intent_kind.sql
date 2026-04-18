-- payment_intents.intent_kind: merchant(가맹점 결제) | point_charge(일반회원 포인트 충전)
-- gourmet 부팅 시 ensure_payment_intent_intent_kind_column() 로도 적용됨.

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS intent_kind VARCHAR(32) NOT NULL DEFAULT 'merchant';
