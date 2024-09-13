-- AlterTable
ALTER TABLE "CardAccount" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JuniperUser" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserSmartWallet" ADD COLUMN     "deletedAt" TIMESTAMP(3);
