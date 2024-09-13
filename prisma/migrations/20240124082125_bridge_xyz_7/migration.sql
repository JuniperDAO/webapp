-- AlterTable
ALTER TABLE "JuniperUser" DROP COLUMN "bridgeCustomerId",
DROP COLUMN "kycLinkId",
DROP COLUMN "plaidCallbackUrl",
DROP COLUMN "plaidLinkToken",
DROP COLUMN "publicToken",
DROP COLUMN "signedAgreementId";

-- CreateTable
CREATE TABLE "UserBridge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "kycLink" TEXT NOT NULL,
    "tosLink" TEXT NOT NULL,
    "kycStatus" TEXT NOT NULL,
    "tosStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "kycLinkId" TEXT,
    "signedAgreementId" TEXT,
    "bridgeCustomerId" TEXT,
    "plaidLinkToken" TEXT,
    "plaidCallbackUrl" TEXT,
    "publicToken" TEXT,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "UserBridge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBridge_email_key" ON "UserBridge"("email");

-- AddForeignKey
ALTER TABLE "UserBridge" ADD CONSTRAINT "UserBridge_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "JuniperUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
