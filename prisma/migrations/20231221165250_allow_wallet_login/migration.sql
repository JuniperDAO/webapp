-- AlterEnum
ALTER TYPE "CardProvider" ADD VALUE 'fiat';

-- AlterTable
ALTER TABLE "JuniperUser" DROP COLUMN "hasSeenOnboardingGuides",
ADD COLUMN     "did" TEXT,
ADD COLUMN     "eoaWalletAddress" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "JuniperUser_did_key" ON "JuniperUser"("did");

-- CreateIndex
CREATE UNIQUE INDEX "JuniperUser_eoaWalletAddress_key" ON "JuniperUser"("eoaWalletAddress");
