-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "locked_by_account_deletion" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletion_requested_at" TIMESTAMP(3),
ADD COLUMN     "deletion_scheduled_for" TIMESTAMP(3);
