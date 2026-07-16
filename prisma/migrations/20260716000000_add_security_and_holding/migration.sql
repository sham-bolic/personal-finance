-- CreateTable
CREATE TABLE "Security" (
    "id" UUID NOT NULL,
    "tickerSymbol" TEXT,
    "type" TEXT NOT NULL DEFAULT 'unknown',
    "plaidSecurityId" TEXT,
    "name" TEXT,
    "closePrice" DECIMAL(20,8),
    "closePriceAsOf" DATE,
    "isoCurrencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "securityId" UUID NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "costBasis" DECIMAL(20,4),
    "marketValue" DECIMAL(20,4) NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "isoCurrencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Security_plaidSecurityId_key" ON "Security"("plaidSecurityId");

-- CreateIndex
CREATE UNIQUE INDEX "Security_tickerSymbol_type_key" ON "Security"("tickerSymbol", "type");

-- CreateIndex
CREATE INDEX "Holding_accountId_idx" ON "Holding"("accountId");

-- CreateIndex
CREATE INDEX "Holding_securityId_idx" ON "Holding"("securityId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_accountId_securityId_key" ON "Holding"("accountId", "securityId");

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
