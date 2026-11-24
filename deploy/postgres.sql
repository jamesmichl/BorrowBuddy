-- Run once in a dedicated Supabase demo project, using its SQL Editor.
BEGIN;
CREATE SCHEMA IF NOT EXISTS borrowbuddy;
REVOKE ALL ON SCHEMA borrowbuddy FROM PUBLIC;
SET LOCAL search_path TO borrowbuddy, pg_catalog;
CREATE TABLE IF NOT EXISTS app_state(id integer PRIMARY KEY CHECK(id=1), payload text NOT NULL);
CREATE TABLE IF NOT EXISTS identities(id text PRIMARY KEY, email text UNIQUE NOT NULL, secret text NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(hash text PRIMARY KEY, account text NOT NULL REFERENCES identities(id), expires bigint NOT NULL);
CREATE TABLE IF NOT EXISTS confirmations(hash text PRIMARY KEY, account text UNIQUE NOT NULL REFERENCES identities(id), expires bigint NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(email text PRIMARY KEY, count integer NOT NULL, expires bigint NOT NULL);
REVOKE ALL ON ALL TABLES IN SCHEMA borrowbuddy FROM PUBLIC;
COMMIT;
