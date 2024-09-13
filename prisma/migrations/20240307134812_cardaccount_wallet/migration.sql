-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CardProvider" ADD VALUE 'wallet';
ALTER TYPE "CardProvider" ADD VALUE 'kraken';
ALTER TYPE "CardProvider" ADD VALUE 'binance';
ALTER TYPE "CardProvider" ADD VALUE 'other_exchange';

-- CreateIndex
CREATE UNIQUE INDEX "CardAccount_name_key" ON "CardAccount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CardAccount_address_key" ON "CardAccount"("address");
