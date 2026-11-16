-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'DEFUNCT', 'BECAME_ANOTHER_TEAM');

-- CreateEnum
CREATE TYPE "CircuitType" AS ENUM ('PERMANENT', 'STREET', 'ROAD');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('SEASON', 'RACE', 'DRIVER', 'TEAM', 'CIRCUIT', 'ERA', 'GLOSSARY', 'PAGE');

-- CreateEnum
CREATE TYPE "ImageKind" AS ENUM ('DRIVER', 'TEAM', 'CAR', 'CIRCUIT', 'TRACK_MAP');

-- CreateTable
CREATE TABLE "Season" (
    "year" INTEGER NOT NULL,
    "url" TEXT,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "headline" TEXT,
    "headlineAuto" BOOLEAN NOT NULL DEFAULT true,
    "regulationChanges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "championDriverId" TEXT,
    "championConstructorId" TEXT,
    "eraSlug" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "url" TEXT,
    "circuitId" TEXT NOT NULL,
    "winnerDriverId" TEXT,
    "winnerConstructorId" TEXT,
    "poleDriverId" TEXT,
    "fastestLapDriverId" TEXT,
    "hasSprint" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" SERIAL NOT NULL,
    "raceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "constructorId" TEXT NOT NULL,
    "engine" TEXT,
    "isSprint" BOOLEAN NOT NULL DEFAULT false,
    "number" TEXT,
    "grid" INTEGER,
    "position" INTEGER,
    "positionText" TEXT NOT NULL,
    "positionOrder" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laps" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "timeText" TEXT,
    "timeMillis" BIGINT,
    "fastestLapRank" INTEGER,
    "fastestLapTime" TEXT,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualifying" (
    "id" SERIAL NOT NULL,
    "raceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "constructorId" TEXT NOT NULL,
    "number" TEXT,
    "position" INTEGER NOT NULL,
    "q1" TEXT,
    "q2" TEXT,
    "q3" TEXT,

    CONSTRAINT "Qualifying_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverStanding" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "driverId" TEXT NOT NULL,
    "position" INTEGER,
    "positionText" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "wins" INTEGER NOT NULL,
    "constructorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "DriverStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructorStanding" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "constructorId" TEXT NOT NULL,
    "position" INTEGER,
    "positionText" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "wins" INTEGER NOT NULL,

    CONSTRAINT "ConstructorStanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "permanentNumber" TEXT,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "dateOfDeath" TIMESTAMP(3),
    "nationality" TEXT,
    "url" TEXT,
    "wikidataId" TEXT,
    "imageId" INTEGER,
    "starts" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "poles" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "fastestLaps" INTEGER NOT NULL DEFAULT 0,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "titles" INTEGER NOT NULL DEFAULT 0,
    "firstYear" INTEGER,
    "lastYear" INTEGER,
    "numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Constructor" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "nationality" TEXT,
    "url" TEXT,
    "wikidataId" TEXT,
    "color" TEXT NOT NULL DEFAULT '#5A5F66',
    "founded" INTEGER,
    "base" TEXT,
    "founder" TEXT,
    "status" "TeamStatus" NOT NULL DEFAULT 'DEFUNCT',
    "whyDisappeared" TEXT,
    "imageId" INTEGER,
    "entries" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "poles" INTEGER NOT NULL DEFAULT 0,
    "podiums" INTEGER NOT NULL DEFAULT 0,
    "driverTitles" INTEGER NOT NULL DEFAULT 0,
    "constructorTitles" INTEGER NOT NULL DEFAULT 0,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstYear" INTEGER,
    "lastYear" INTEGER,

    CONSTRAINT "Constructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructorLineage" (
    "id" SERIAL NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ConstructorLineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circuit" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "locality" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "url" TEXT,
    "wikidataId" TEXT,
    "type" "CircuitType" NOT NULL DEFAULT 'PERMANENT',
    "lengthKm" DOUBLE PRECISION,
    "turns" INTEGER,
    "lapRecord" TEXT,
    "firstYear" INTEGER,
    "lastYear" INTEGER,
    "raceCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "imageId" INTEGER,
    "trackMapId" INTEGER,

    CONSTRAINT "Circuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircuitLayout" (
    "id" SERIAL NOT NULL,
    "circuitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fromYear" INTEGER NOT NULL,
    "toYear" INTEGER,
    "lengthKm" DOUBLE PRECISION,
    "turns" INTEGER,
    "notes" TEXT,

    CONSTRAINT "CircuitLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engine" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configuration" TEXT,

    CONSTRAINT "Engine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chassis" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "constructorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "engineId" TEXT,
    "designer" TEXT,
    "notes" TEXT,
    "imageId" INTEGER,

    CONSTRAINT "Chassis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Era" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER,
    "tagline" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Era_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "kind" "ImageKind" NOT NULL,
    "entityId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "srcset" JSONB,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "commonsFile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" SERIAL NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "lastEdited" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedBy" TEXT,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiExtract" (
    "id" SERIAL NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "extract" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiExtract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "slug" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "long" TEXT NOT NULL,
    "eli5" TEXT NOT NULL,

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Embedding" (
    "id" SERIAL NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyFeature" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "links" JSONB NOT NULL DEFAULT '[]',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyFeature_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" SERIAL NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,

    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Race_circuitId_idx" ON "Race"("circuitId");

-- CreateIndex
CREATE INDEX "Race_date_idx" ON "Race"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Race_year_round_key" ON "Race"("year", "round");

-- CreateIndex
CREATE UNIQUE INDEX "Race_year_slug_key" ON "Race"("year", "slug");

-- CreateIndex
CREATE INDEX "Result_driverId_idx" ON "Result"("driverId");

-- CreateIndex
CREATE INDEX "Result_constructorId_idx" ON "Result"("constructorId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_raceId_driverId_isSprint_positionOrder_key" ON "Result"("raceId", "driverId", "isSprint", "positionOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Qualifying_raceId_driverId_key" ON "Qualifying"("raceId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverStanding_year_driverId_key" ON "DriverStanding"("year", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructorStanding_year_constructorId_key" ON "ConstructorStanding"("year", "constructorId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_slug_key" ON "Driver"("slug");

-- CreateIndex
CREATE INDEX "Driver_searchName_idx" ON "Driver"("searchName");

-- CreateIndex
CREATE INDEX "Driver_lastYear_idx" ON "Driver"("lastYear");

-- CreateIndex
CREATE UNIQUE INDEX "Constructor_slug_key" ON "Constructor"("slug");

-- CreateIndex
CREATE INDEX "Constructor_searchName_idx" ON "Constructor"("searchName");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructorLineage_predecessorId_successorId_key" ON "ConstructorLineage"("predecessorId", "successorId");

-- CreateIndex
CREATE UNIQUE INDEX "Circuit_slug_key" ON "Circuit"("slug");

-- CreateIndex
CREATE INDEX "Circuit_searchName_idx" ON "Circuit"("searchName");

-- CreateIndex
CREATE UNIQUE INDEX "CircuitLayout_circuitId_fromYear_key" ON "CircuitLayout"("circuitId", "fromYear");

-- CreateIndex
CREATE INDEX "Chassis_constructorId_idx" ON "Chassis"("constructorId");

-- CreateIndex
CREATE UNIQUE INDEX "Image_kind_entityId_key" ON "Image"("kind", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_entityType_entityId_key" ON "Article"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiExtract_entityType_entityId_key" ON "WikiExtract"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Embedding_entityType_entityId_chunkIndex_key" ON "Embedding"("entityType", "entityId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_championDriverId_fkey" FOREIGN KEY ("championDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_championConstructorId_fkey" FOREIGN KEY ("championConstructorId") REFERENCES "Constructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_eraSlug_fkey" FOREIGN KEY ("eraSlug") REFERENCES "Era"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_year_fkey" FOREIGN KEY ("year") REFERENCES "Season"("year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_winnerDriverId_fkey" FOREIGN KEY ("winnerDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_winnerConstructorId_fkey" FOREIGN KEY ("winnerConstructorId") REFERENCES "Constructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_poleDriverId_fkey" FOREIGN KEY ("poleDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Race" ADD CONSTRAINT "Race_fastestLapDriverId_fkey" FOREIGN KEY ("fastestLapDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_constructorId_fkey" FOREIGN KEY ("constructorId") REFERENCES "Constructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualifying" ADD CONSTRAINT "Qualifying_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualifying" ADD CONSTRAINT "Qualifying_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualifying" ADD CONSTRAINT "Qualifying_constructorId_fkey" FOREIGN KEY ("constructorId") REFERENCES "Constructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverStanding" ADD CONSTRAINT "DriverStanding_year_fkey" FOREIGN KEY ("year") REFERENCES "Season"("year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverStanding" ADD CONSTRAINT "DriverStanding_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructorStanding" ADD CONSTRAINT "ConstructorStanding_year_fkey" FOREIGN KEY ("year") REFERENCES "Season"("year") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructorStanding" ADD CONSTRAINT "ConstructorStanding_constructorId_fkey" FOREIGN KEY ("constructorId") REFERENCES "Constructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constructor" ADD CONSTRAINT "Constructor_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructorLineage" ADD CONSTRAINT "ConstructorLineage_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "Constructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructorLineage" ADD CONSTRAINT "ConstructorLineage_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "Constructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circuit" ADD CONSTRAINT "Circuit_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circuit" ADD CONSTRAINT "Circuit_trackMapId_fkey" FOREIGN KEY ("trackMapId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircuitLayout" ADD CONSTRAINT "CircuitLayout_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chassis" ADD CONSTRAINT "Chassis_constructorId_fkey" FOREIGN KEY ("constructorId") REFERENCES "Constructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chassis" ADD CONSTRAINT "Chassis_year_fkey" FOREIGN KEY ("year") REFERENCES "Season"("year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chassis" ADD CONSTRAINT "Chassis_engineId_fkey" FOREIGN KEY ("engineId") REFERENCES "Engine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chassis" ADD CONSTRAINT "Chassis_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
