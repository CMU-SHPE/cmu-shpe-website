CREATE TYPE "public"."sponsor_editor_kind" AS ENUM('sponsor', 'officer');--> statement-breakpoint
ALTER TABLE "sponsor_edits" ADD COLUMN "editor_kind" "sponsor_editor_kind" DEFAULT 'sponsor' NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_edits" ADD COLUMN "admin_id" integer;--> statement-breakpoint
ALTER TABLE "sponsor_edits" ADD CONSTRAINT "sponsor_edits_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_edits" ADD CONSTRAINT "sponsor_edits_one_editor" CHECK (("sponsor_edits"."editor_kind" = 'sponsor' and "sponsor_edits"."admin_id" is null) or ("sponsor_edits"."editor_kind" = 'officer' and "sponsor_edits"."member_id" is null));