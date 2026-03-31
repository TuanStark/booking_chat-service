/*
  Warnings:

  - A unique constraint covering the columns `[supportKey]` on the table `conversations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "mergedAt" TIMESTAMP(3),
ADD COLUMN     "mergedIntoConversationId" TEXT,
ADD COLUMN     "supportKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_supportKey_key" ON "conversations"("supportKey");

-- CreateIndex
CREATE INDEX "conversations_mergedIntoConversationId_idx" ON "conversations"("mergedIntoConversationId");
