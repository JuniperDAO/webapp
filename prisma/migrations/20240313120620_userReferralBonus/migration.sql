-- CreateTable
CREATE TABLE "UserReferralBonus" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "bonusData" JSONB,

    CONSTRAINT "UserReferralBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserReferralBonus_ownerId_referredId_key" ON "UserReferralBonus"("ownerId", "referredId");
