-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- Preserve the existing single-table history implementation when this
-- migration is applied to a database that already has conversation_messages.
DO $$
BEGIN
  IF to_regclass('public.conversation_messages') IS NULL THEN
    CREATE TABLE "conversation_messages" (
        "id" BIGSERIAL NOT NULL,
        "conversation_id" UUID NOT NULL,
        "role" "MessageRole" NOT NULL,
        "content" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
    );
  ELSE
    DROP INDEX IF EXISTS "idx_conv_msg_user_created";

    ALTER TABLE "conversation_messages"
      ADD COLUMN IF NOT EXISTS "conversation_id" UUID;

    INSERT INTO "conversations" ("id", "user_id")
    SELECT gen_random_uuid(), legacy."user_id"
    FROM "conversation_messages" AS legacy
    GROUP BY legacy."user_id"
    ON CONFLICT DO NOTHING;

    UPDATE "conversation_messages" AS legacy
    SET "conversation_id" = conversation."id"
    FROM "conversations" AS conversation
    WHERE conversation."user_id" = legacy."user_id";

    ALTER TABLE "conversation_messages"
      ALTER COLUMN "conversation_id" SET NOT NULL;

    ALTER TABLE "conversation_messages"
      ALTER COLUMN "role" TYPE "MessageRole"
      USING UPPER("role")::"MessageRole";

    ALTER TABLE "conversation_messages"
      DROP COLUMN IF EXISTS "user_id";
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_user_id_key"
    ON "conversations"("user_id");

CREATE INDEX IF NOT EXISTS "conversations_updated_at_idx"
    ON "conversations"("updated_at");

CREATE INDEX IF NOT EXISTS "conversation_messages_context_idx"
    ON "conversation_messages"("conversation_id", "created_at", "id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversation_messages_conversation_id_fkey'
  ) THEN
    ALTER TABLE "conversation_messages"
      ADD CONSTRAINT "conversation_messages_conversation_id_fkey"
      FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
