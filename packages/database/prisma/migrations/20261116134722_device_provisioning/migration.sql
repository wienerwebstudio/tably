-- AlterTable
ALTER TABLE "NfcDevice" ADD COLUMN     "chipFileKeyEnc" TEXT,
ADD COLUMN     "chipMetaKeyEnc" TEXT,
ADD COLUMN     "masterKeyEnc" TEXT;

-- CreateTable
CREATE TABLE "DeviceProvisioning" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceProvisioning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceProvisioning_codeHash_key" ON "DeviceProvisioning"("codeHash");

-- CreateIndex
CREATE INDEX "DeviceProvisioning_deviceId_idx" ON "DeviceProvisioning"("deviceId");

-- AddForeignKey
ALTER TABLE "DeviceProvisioning" ADD CONSTRAINT "DeviceProvisioning_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "NfcDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
