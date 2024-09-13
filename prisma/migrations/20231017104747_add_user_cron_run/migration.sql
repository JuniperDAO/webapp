-- CreateTable
CREATE TABLE "UserCronRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "didSucceed" BOOLEAN NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "UserCronRun_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserCronRun" ADD CONSTRAINT "UserCronRun_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "JuniperUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
