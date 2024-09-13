-- DropIndex
DROP INDEX "CardAccount_address_key";

-- DropIndex
DROP INDEX "CardAccount_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "CardAccount_ownerId_name_key" ON "CardAccount"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CardAccount_ownerId_address_key" ON "CardAccount"("ownerId", "address");
