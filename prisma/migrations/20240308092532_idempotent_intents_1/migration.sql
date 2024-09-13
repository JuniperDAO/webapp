-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('borrow_and_send', 'deposit');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CardProvider" ADD VALUE 'bybit';
ALTER TYPE "CardProvider" ADD VALUE 'okx';
ALTER TYPE "CardProvider" ADD VALUE 'gate_io';
ALTER TYPE "CardProvider" ADD VALUE 'kucoin';

-- DropForeignKey
ALTER TABLE "UserCronRun" DROP CONSTRAINT "UserCronRun_ownerId_fkey";

-- DropTable
DROP TABLE "UserCronRun";

-- CreateTable
CREATE TABLE "UserIntent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "intentType" "Intent" NOT NULL,
    "intentData" JSONB,

    CONSTRAINT "UserIntent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserIntent" ADD CONSTRAINT "UserIntent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "JuniperUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
