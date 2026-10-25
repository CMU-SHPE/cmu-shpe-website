CREATE TYPE "public"."member_role" AS ENUM('supporter', 'sponsor');--> statement-breakpoint
CREATE TYPE "public"."member_token_purpose" AS ENUM('confirm_email', 'reset_password');--> statement-breakpoint
CREATE TABLE "member_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"purpose" "member_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "member_topic_subscriptions" (
	"member_id" integer NOT NULL,
	"topic_id" integer NOT NULL,
	"opted_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_topic_subscriptions_member_id_topic_id_pk" PRIMARY KEY("member_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "member_role" DEFAULT 'supporter' NOT NULL,
	"email_confirmed_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"age_confirmed_at" timestamp with time zone NOT NULL,
	"privacy_policy_version" text NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "newsletter_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_throttle" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "mailing_address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "member_tokens" ADD CONSTRAINT "member_tokens_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_topic_subscriptions" ADD CONSTRAINT "member_topic_subscriptions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_topic_subscriptions" ADD CONSTRAINT "member_topic_subscriptions_topic_id_newsletter_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."newsletter_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_tokens_member_purpose_idx" ON "member_tokens" USING btree ("member_id","purpose");--> statement-breakpoint
CREATE INDEX "request_throttle_email_idx" ON "request_throttle" USING btree ("action","email","created_at");--> statement-breakpoint
CREATE INDEX "request_throttle_ip_idx" ON "request_throttle" USING btree ("action","ip","created_at");