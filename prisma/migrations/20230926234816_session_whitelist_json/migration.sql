/*
  Warnings:

  - Changed the type of `sessionKeyWhitelist` on the `UserSmartWallet` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "UserSmartWallet" DROP COLUMN "sessionKeyWhitelist",
ADD COLUMN     "sessionKeyWhitelist" JSONB NOT NULL;
