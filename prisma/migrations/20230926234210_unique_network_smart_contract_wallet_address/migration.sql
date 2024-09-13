/*
  Warnings:

  - A unique constraint covering the columns `[network,smartContractWalletAddress]` on the table `UserSmartWallet` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserSmartWallet_network_smartContractWalletAddress_key" ON "UserSmartWallet"("network", "smartContractWalletAddress");
