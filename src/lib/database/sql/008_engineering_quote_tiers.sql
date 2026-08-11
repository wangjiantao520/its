-- 工程报价三套取费（铁建/移动费率）
ALTER TABLE engineering_quotes
  ADD COLUMN IF NOT EXISTS crcc_rate double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crcc_fee numeric(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cmcc_rate double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cmcc_fee numeric(18,2) DEFAULT 0;
