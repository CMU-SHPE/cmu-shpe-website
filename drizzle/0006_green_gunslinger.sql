CREATE TABLE "event_time_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "event_time_slots_end_date_after_start" CHECK ("event_time_slots"."end_date" >= "event_time_slots"."start_date"),
	CONSTRAINT "event_time_slots_end_time_after_start" CHECK ("event_time_slots"."end_time" > "event_time_slots"."start_time")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "event_time_slots" ADD CONSTRAINT "event_time_slots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_time_slots_event_idx" ON "event_time_slots" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_end_date_after_start" CHECK ("events"."end_date" >= "events"."date");