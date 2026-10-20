CREATE TYPE "public"."admin_role" AS ENUM('admin', 'master');--> statement-breakpoint
CREATE TYPE "public"."sponsor_tier" AS ENUM('Platinum', 'Gold', 'Silver', 'Bronze');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "advisors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"department" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"email" text,
	"linkedin" text,
	"photo_url" text,
	"photo_original_url" text,
	"photo_crop" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"location" text NOT NULL,
	"type" text NOT NULL,
	"date" date NOT NULL,
	"time" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_pillars" (
	"id" serial PRIMARY KEY NOT NULL,
	"icon" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "national_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "officers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"major" text NOT NULL,
	"year" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"email" text,
	"linkedin" text,
	"photo_url" text,
	"photo_original_url" text,
	"photo_crop" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_email" text NOT NULL,
	"meeting_day" text NOT NULL,
	"meeting_time" text NOT NULL,
	"meeting_location" text NOT NULL,
	"instagram_url" text,
	"linkedin_url" text,
	"x_url" text,
	"youtube_url" text,
	"tiktok_url" text,
	"presence_url" text
);
--> statement-breakpoint
CREATE TABLE "sponsor_benefits" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"platinum" text DEFAULT '' NOT NULL,
	"gold" text DEFAULT '' NOT NULL,
	"silver" text DEFAULT '' NOT NULL,
	"bronze" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" "sponsor_tier" NOT NULL,
	"website" text,
	"logo_url" text,
	"logo_original_url" text,
	"logo_crop" text,
	"bg_color" text DEFAULT '#ffffff' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip","created_at");