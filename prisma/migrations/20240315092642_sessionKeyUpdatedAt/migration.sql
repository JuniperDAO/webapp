-- AlterTable
ALTER TABLE "UserSmartWallet" DROP COLUMN "sessionKeyWhitelist",
ADD COLUMN     "sessionKeyUpdatedAt" TIMESTAMP(3);
