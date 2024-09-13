-- AlterTable
ALTER TABLE "UserPlaidItem" ADD COLUMN     "accounts" JSONB,
ADD COLUMN     "identities" JSONB,
ADD COLUMN     "numbers" JSONB;
