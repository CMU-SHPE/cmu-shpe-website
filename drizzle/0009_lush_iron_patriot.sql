CREATE TABLE "gallery_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"image_original_url" text,
	"image_crop" text,
	"alt_text" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
