/*
  Warnings:

  - You are about to drop the column `spendingPower` on the `CardAccount` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[provider,ownerId]` on the table `CardAccount` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CardAccount" DROP COLUMN "spendingPower",
ADD COLUMN     "spendingPowerCents" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "CardAccount_provider_ownerId_key" ON "CardAccount"("provider", "ownerId");
