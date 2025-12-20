CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS autoreply_rules (
  id                  text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
  organization_id     text NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  channel             text NOT NULL, -- e.g., telegram / thread / etc.
  integration_id      text NULL REFERENCES "Integration"(id) ON DELETE CASCADE,
  channel_target_id   text NULL, -- e.g., telegram_chat_id / thread_room_id
  name                text NULL,
  keyword_pattern     text NOT NULL,
  match_type          text NOT NULL CHECK (match_type IN ('EXACT', 'CONTAINS', 'REGEX')),
  reply_text          text NOT NULL,
  priority            int  NOT NULL DEFAULT 100,
  delay_sec           int  NOT NULL DEFAULT 0,
  cooldown_sec        int  NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup per channel/target with ordering by priority (higher first)
CREATE INDEX IF NOT EXISTS idx_autoreply_rules_channel_active
  ON autoreply_rules (channel, channel_target_id, priority DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_autoreply_rules_org
  ON autoreply_rules (organization_id);

CREATE INDEX IF NOT EXISTS idx_autoreply_rules_channel_org
  ON autoreply_rules (channel, organization_id);

CREATE INDEX IF NOT EXISTS idx_autoreply_rules_match_type
  ON autoreply_rules (match_type);

--------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS autoreply_logs (
  id                bigserial PRIMARY KEY,
  rule_id           text NULL REFERENCES autoreply_rules(id) ON DELETE SET NULL,
  organization_id   text NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  channel           text NOT NULL,
  integration_id    text NULL REFERENCES "Integration"(id) ON DELETE CASCADE,
  channel_target_id text NULL,
  message_id        text NULL, -- provider message/interaction id if available
  author_id         text NULL,
  matched_text      text NULL,
  match_type        text NOT NULL CHECK (match_type IN ('EXACT', 'CONTAINS', 'REGEX')),
  reply_text        text NULL,
  cooldown_applied  boolean NOT NULL DEFAULT false,
  error             text NULL,
  meta              jsonb NULL, -- raw payload for debugging/audit
  triggered_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autoreply_logs_integration_time
  ON autoreply_logs (integration_id, channel_target_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_autoreply_logs_rule_time
  ON autoreply_logs (rule_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_autoreply_logs_message
  ON autoreply_logs (message_id);

CREATE INDEX IF NOT EXISTS idx_autoreply_logs_org
  ON autoreply_logs (organization_id);

CREATE INDEX IF NOT EXISTS idx_autoreply_logs_cooldown
  ON autoreply_logs (rule_id, author_id, triggered_at DESC);

--------------------------------------------------------------------
-- Example seed data (replace integration ids / target ids with real values)
--------------------------------------------------------------------
-- Thread channel: global rule
INSERT INTO autoreply_rules (
  organization_id, channel, integration_id, channel_target_id, name,
  keyword_pattern, match_type, reply_text, priority, delay_sec, cooldown_sec, is_active
) VALUES (
  'ORG_THREAD_SAMPLE', 'thread', 'INTEGRATION_THREAD_SAMPLE', NULL, 'Thread OK ikut responder',
  'ok ikut', 'CONTAINS', 'siap', 100, 0, 60, true
) ON CONFLICT DO NOTHING;

-- Telegram channel: rule scoped to a specific chat
INSERT INTO autoreply_rules (
  organization_id, channel, integration_id, channel_target_id, name,
  keyword_pattern, match_type, reply_text, priority, delay_sec, cooldown_sec, is_active
) VALUES (
  'ORG_TELEGRAM_SAMPLE', 'telegram', 'INTEGRATION_TELEGRAM_SAMPLE', 'telegram_chat_123', 'Telegram OK ikut responder',
  '^OK ikut$', 'REGEX', 'gas kang', 120, 2, 90, true
) ON CONFLICT DO NOTHING;
