-- DropIndex
DROP INDEX "CardAccount_provider_ownerId_key";

-- CreateIndex
CREATE UNIQUE INDEX "CardAccount_customerId_externalAccountId_key" ON "CardAccount"("customerId", "externalAccountId");
