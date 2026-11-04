ALTER TABLE "member_tokens" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "member_tokens" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "member_tokens" ADD COLUMN "privacy_policy_version" text;--> statement-breakpoint
ALTER TABLE "member_tokens" ADD COLUMN "age_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_tokens" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_tokens" ADD CONSTRAINT "member_tokens_sign_up_complete" CHECK (num_nulls("member_tokens"."name", "member_tokens"."password_hash", "member_tokens"."privacy_policy_version", "member_tokens"."age_confirmed_at", "member_tokens"."terms_accepted_at") = 5 or ("member_tokens"."purpose" = 'confirm_email' and num_nulls("member_tokens"."name", "member_tokens"."password_hash", "member_tokens"."privacy_policy_version", "member_tokens"."age_confirmed_at", "member_tokens"."terms_accepted_at") = 0));