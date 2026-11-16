
-- CreateTable
CREATE TABLE "TeamSeason" (
    "teamId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "chassis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "engines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,

    CONSTRAINT "TeamSeason_pkey" PRIMARY KEY ("teamId","year")
);

-- CreateIndex
CREATE INDEX "TeamSeason_year_idx" ON "TeamSeason"("year");

-- AddForeignKey
ALTER TABLE "TeamSeason" ADD CONSTRAINT "TeamSeason_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Constructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeason" ADD CONSTRAINT "TeamSeason_year_fkey" FOREIGN KEY ("year") REFERENCES "Season"("year") ON DELETE CASCADE ON UPDATE CASCADE;

