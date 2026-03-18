-- Migration 0008: connections and invites tables

CREATE TABLE IF NOT EXISTS "invites" (
  "id" serial PRIMARY KEY NOT NULL,
  "sender_id" integer NOT NULL,
  "invitee_email" text,
  "invitee_phone" text,
  "token" text NOT NULL UNIQUE,
  "message" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "accepted_by_user_id" integer,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "connections" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "partner_id" integer NOT NULL,
  "invite_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
