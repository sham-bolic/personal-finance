-- CreateEnum
CREATE TYPE "Source" AS ENUM ('user', 'agent');

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'user';

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'user';

-- AlterTable
ALTER TABLE "GoalContribution" ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'user';
