CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_active_role
  ON users(is_active, role);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
  ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
  ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_clients_name
  ON clients(name);
CREATE INDEX IF NOT EXISTS idx_device_quotas_category_name
  ON device_quotas(category, name);
CREATE INDEX IF NOT EXISTS idx_device_quotas_active_category
  ON device_quotas(is_active, category);

CREATE INDEX IF NOT EXISTS idx_engineering_quotes_created_at
  ON engineering_quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engineering_quotes_owner_created_at
  ON engineering_quotes(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engineering_quotes_status_created_at
  ON engineering_quotes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engineering_quotes_client_id
  ON engineering_quotes(client_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_quotes_created_at
  ON maintenance_quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_quotes_owner_created_at
  ON maintenance_quotes(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_quotes_status_created_at
  ON maintenance_quotes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_quotes_client_id
  ON maintenance_quotes(client_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_versions_quote
  ON quote_versions(quote_type, quote_id, version);
CREATE INDEX IF NOT EXISTS idx_quote_versions_created_at
  ON quote_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_audit_logs_quote
  ON quote_audit_logs(quote_type, quote_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_shares_token
  ON quote_shares(token);
CREATE INDEX IF NOT EXISTS idx_quote_shares_lookup
  ON quote_shares(is_active, expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_shares_quote
  ON quote_shares(quote_type, quote_id);

CREATE INDEX IF NOT EXISTS idx_self_construction_quotas_category_sort
  ON self_construction_quotas(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_intelligent_project_quotas_category_sort
  ON intelligent_project_quotas(category, sort_order, serial_number);
CREATE INDEX IF NOT EXISTS idx_labor_price_config_active_sort
  ON labor_price_config(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_maintenance_device_quotas_category_name
  ON maintenance_device_quotas(category, name);
CREATE INDEX IF NOT EXISTS idx_maintenance_rate_config_active_sort
  ON maintenance_rate_config(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_sla_config_active_sort
  ON sla_config(is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_quotation_records_user_created_at
  ON quotation_records(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotation_records_status_created_at
  ON quotation_records(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotation_records_client_name
  ON quotation_records(client_name);
CREATE INDEX IF NOT EXISTS idx_quotation_devices_quotation_id
  ON quotation_devices(quotation_id);

CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_priority
  ON agent_skills(agent_id, enabled, priority DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_updated_at
  ON agent_sessions(user_id, is_deleted, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_updated_at
  ON agent_sessions(agent_id, is_deleted, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_session_created_at
  ON agent_logs(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent_created_at
  ON agent_logs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_base_agent_id
  ON agent_knowledge_base(agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_model_configs_active_sort
  ON ai_model_configs(is_active, is_default DESC, sort_order, id DESC);
CREATE INDEX IF NOT EXISTS idx_ai_model_logs_config_created_at
  ON ai_model_logs(config_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_learning_memory_lookup
  ON ai_learning_memory(client_id, device_signature);
CREATE INDEX IF NOT EXISTS idx_ai_learning_memory_last_used_at
  ON ai_learning_memory(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at
  ON ai_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_device_history_signature_created_at
  ON quote_device_history(device_signature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_device_history_client_created_at
  ON quote_device_history(client_id, created_at DESC);

DO $security$
DECLARE
  schema_name text := current_schema();
BEGIN
  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM PUBLIC', schema_name);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC', schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM PUBLIC', schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM PUBLIC', schema_name);

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon', schema_name);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM anon', schema_name);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM authenticated', schema_name);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM authenticated', schema_name);
  END IF;
END;
$security$;
