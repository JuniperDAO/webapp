-- AlterTable
ALTER TABLE "CardAccount" DROP COLUMN "bridgeCustomerId",
DROP COLUMN "kycLinkId",
DROP COLUMN "plaidCallbackUrl",
DROP COLUMN "plaidLinkToken",
DROP COLUMN "publicToken",
DROP COLUMN "signedAgreementId";

-- AlterTable
ALTER TABLE "JuniperUser" ADD COLUMN     "bridgeCustomerId" TEXT,
ADD COLUMN     "kycLinkId" TEXT,
ADD COLUMN     "plaidCallbackUrl" TEXT,
ADD COLUMN     "plaidLinkToken" TEXT,
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "signedAgreementId" TEXT;
