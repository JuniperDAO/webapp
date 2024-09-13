-- We presume the db already exists, most cloud platforms will do this

-- CREATE DATABASE "juniper";

-- The next 3 lines work on Neon.tech (Vercel's db partner)
-- The nodejs user isn't really used in dev environments
-- ... and Neon is considered throwaway
CREATE USER nodejs WITH PASSWORD 'wajsob-horde1-biwkaN';
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nodejs;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO nodejs;

-- Notably, the above doesn't work on Vercel (no users, no roles etc)

-- CreateEnum
CREATE TYPE "CardProvider" AS ENUM ('coinbase', 'crypto_dot_com');

-- CreateEnum
CREATE TYPE "Network" AS ENUM ('mainnet', 'optimism', 'goerli');

-- CreateTable
CREATE TABLE "JuniperUser" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "oauthProvider" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "issuer" TEXT,

    CONSTRAINT "JuniperUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSmartWallet" (
    "id" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "smartContractWalletAddress" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "sessionKeyWhitelist" TEXT[],
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "UserSmartWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardAccount" (
    "id" TEXT NOT NULL,
    "provider" "CardProvider" NOT NULL,
    "spendingPower" INTEGER NOT NULL DEFAULT 0,
    "apiAccessToken" TEXT,
    "apiRefreshToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "CardAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JuniperUser_email_key" ON "JuniperUser"("email");

-- AddForeignKey
ALTER TABLE "UserSmartWallet" ADD CONSTRAINT "UserSmartWallet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "JuniperUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardAccount" ADD CONSTRAINT "CardAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "JuniperUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
