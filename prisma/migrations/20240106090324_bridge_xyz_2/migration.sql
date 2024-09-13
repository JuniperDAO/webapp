-- AlterTable
ALTER TABLE "CardAccount" DROP COLUMN "signedAgreementID",
ADD COLUMN     "bridgeCustomerId" TEXT,
ADD COLUMN     "signedAgreementId" TEXT;
