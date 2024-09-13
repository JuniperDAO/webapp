-- AlterTable
ALTER TABLE "CardAccount" ADD COLUMN     "plaidAccessToken" TEXT,
ADD COLUMN     "plaidItemId" TEXT;

-- AlterTable
ALTER TABLE "UserBridge" DROP COLUMN "plaidCallbackUrl",
DROP COLUMN "plaidLinkToken",
DROP COLUMN "publicToken";

-- CreateTable
CREATE TABLE "UserPlaidItem" (
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "UserPlaidItem_pkey" PRIMARY KEY ("itemId")
);

-- AddForeignKey
ALTER TABLE "UserPlaidItem" ADD CONSTRAINT "UserPlaidItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "JuniperUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
