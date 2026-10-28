CREATE TABLE "event_rsvps" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"sponsor_id" integer NOT NULL,
	"member_id" integer,
	"member_name" text NOT NULL,
	"fields" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"sponsor_id" integer NOT NULL,
	"title" text NOT NULL,
	"receipt_date" date NOT NULL,
	"file_name" text NOT NULL,
	"byte_size" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "capacity" integer;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "sponsor_id" integer;--> statement-breakpoint
ALTER TABLE "sponsors" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_edits" ADD CONSTRAINT "sponsor_edits_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_edits" ADD CONSTRAINT "sponsor_edits_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_receipts" ADD CONSTRAINT "sponsor_receipts_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_receipts" ADD CONSTRAINT "sponsor_receipts_uploaded_by_admins_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_rsvps_event_member_idx" ON "event_rsvps" USING btree ("event_id","member_id");--> statement-breakpoint
CREATE INDEX "event_rsvps_member_idx" ON "event_rsvps" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "sponsor_edits_sponsor_created_idx" ON "sponsor_edits" USING btree ("sponsor_id","created_at");--> statement-breakpoint
CREATE INDEX "sponsor_receipts_sponsor_idx" ON "sponsor_receipts" USING btree ("sponsor_id");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_sponsor_idx" ON "members" USING btree ("sponsor_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_capacity_positive" CHECK ("events"."capacity" > 0);