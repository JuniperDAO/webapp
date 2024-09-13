-- AlterTable
ALTER TABLE "UserBankAccount" DROP COLUMN "pladItemId",
ADD COLUMN     "plaidItemId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserBankAccount_plaidAccountId_key" ON "UserBankAccount"("plaidAccountId");
