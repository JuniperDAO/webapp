-- CreateTable
CREATE TABLE IF NOT EXISTS "UserBankAccount" (
    "plaidAccountId" TEXT NOT NULL,
    "pladItemId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "routing" TEXT NOT NULL,
    "wireRouting" TEXT,
    "mask" TEXT,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "UserBankAccount_pkey" PRIMARY KEY ("plaidAccountId")
);

-- AddForeignKey
ALTER TABLE "UserBankAccount" ADD CONSTRAINT "UserBankAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "JuniperUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
