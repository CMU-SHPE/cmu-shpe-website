CREATE TYPE "public"."newsletter_recipient_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."newsletter_status" AS ENUM('draft', 'sending', 'sent');--> statement-breakpoint
CREATE TYPE "public"."unsubscribe_source" AS ENUM('one_click', 'page');--> statement-breakpoint
CREATE TABLE "newsletter_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"newsletter_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"chunk" integer NOT NULL,
	"status" "newsletter_recipient_status" DEFAULT 'pending' NOT NULL,
	"unsubscribe_token_hash" text,
	"resend_id" text,
	"error_code" text,
	"claimed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_recipients_unsubscribe_token_hash_unique" UNIQUE("unsubscribe_token_hash")
);
--> statement-breakpoint
CREATE TABLE "newsletter_topic_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"newsletter_id" integer NOT NULL,
	"topic_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_unsubscribes" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"topic_id" integer,
	"topic_name" text NOT NULL,
	"newsletter_id" integer,
	"source" "unsubscribe_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletters" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" "newsletter_status" DEFAULT 'draft' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"send_started_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"sent_by" integer,
	"sent_by_name" text,
	"topic_names" text,
	"recipient_count" integer,
	"mailing_address" text,
	"reply_to" text,
	"site_url" text,
	"from_address" text
);
--> statement-breakpoint
ALTER TABLE "newsletter_recipients" ADD CONSTRAINT "newsletter_recipients_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_recipients" ADD CONSTRAINT "newsletter_recipients_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_topic_selections" ADD CONSTRAINT "newsletter_topic_selections_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_topic_selections" ADD CONSTRAINT "newsletter_topic_selections_topic_id_newsletter_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."newsletter_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_unsubscribes" ADD CONSTRAINT "newsletter_unsubscribes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_unsubscribes" ADD CONSTRAINT "newsletter_unsubscribes_topic_id_newsletter_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."newsletter_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_unsubscribes" ADD CONSTRAINT "newsletter_unsubscribes_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_sent_by_admins_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_recipients_newsletter_member_idx" ON "newsletter_recipients" USING btree ("newsletter_id","member_id");--> statement-breakpoint
CREATE INDEX "newsletter_recipients_newsletter_status_idx" ON "newsletter_recipients" USING btree ("newsletter_id","status");--> statement-breakpoint
CREATE INDEX "newsletter_recipients_newsletter_chunk_idx" ON "newsletter_recipients" USING btree ("newsletter_id","chunk");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_topic_selections_newsletter_topic_idx" ON "newsletter_topic_selections" USING btree ("newsletter_id","topic_id");--> statement-breakpoint
CREATE INDEX "newsletter_unsubscribes_member_idx" ON "newsletter_unsubscribes" USING btree ("member_id");