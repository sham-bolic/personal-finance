-- CreateEnum
CREATE TYPE "PlaidPrimaryCategory" AS ENUM ('INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS', 'BANK_FEES', 'ENTERTAINMENT', 'FOOD_AND_DRINK', 'GENERAL_MERCHANDISE', 'HOME_IMPROVEMENT', 'MEDICAL', 'PERSONAL_CARE', 'GENERAL_SERVICES', 'GOVERNMENT_AND_NON_PROFIT', 'TRANSPORTATION', 'TRAVEL', 'RENT_AND_UTILITIES');

-- CreateTable
CREATE TABLE "Budget" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "PlaidPrimaryCategory" NOT NULL,
    "monthlyAmount" DECIMAL(14,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Budget_userId_idx" ON "Budget"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_category_effectiveFrom_key" ON "Budget"("userId", "category", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
