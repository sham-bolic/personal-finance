-- CreateTable
CREATE TABLE "AccountBalanceSnapshot" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "currentBalance" DECIMAL(14,2) NOT NULL,
    "availableBalance" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountBalanceSnapshot_accountId_idx" ON "AccountBalanceSnapshot"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBalanceSnapshot_accountId_date_key" ON "AccountBalanceSnapshot"("accountId", "date");

-- AddForeignKey
ALTER TABLE "AccountBalanceSnapshot" ADD CONSTRAINT "AccountBalanceSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
