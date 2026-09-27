-- 003_campaign_template_columns.sql
-- Persist the template name/language chosen at campaign creation, so the
-- dashboard can display it and a send doesn't need it re-supplied.

ALTER TABLE campaigns ADD COLUMN template_name TEXT;
ALTER TABLE campaigns ADD COLUMN language_code TEXT NOT NULL DEFAULT 'en_US';
