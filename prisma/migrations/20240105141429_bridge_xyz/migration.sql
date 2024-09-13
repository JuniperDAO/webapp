-- AlterEnum
BEGIN;
CREATE TYPE "CardProvider_new" AS ENUM ('coinbase', 'crypto_dot_com', 'bridge');
ALTER TABLE "CardAccount" ALTER COLUMN "provider" TYPE "CardProvider_new" USING ("provider"::text::"CardProvider_new");
ALTER TYPE "CardProvider" RENAME TO "CardProvider_old";
ALTER TYPE "CardProvider_new" RENAME TO "CardProvider";
DROP TYPE "CardProvider_old";
COMMIT;
