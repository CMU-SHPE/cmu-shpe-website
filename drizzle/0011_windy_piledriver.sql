ALTER TABLE "events" ADD COLUMN "series_id" uuid;--> statement-breakpoint
CREATE INDEX "events_series_idx" ON "events" USING btree ("series_id");