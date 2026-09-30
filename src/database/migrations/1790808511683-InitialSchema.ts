import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790808511683 implements MigrationInterface {
  name = 'InitialSchema1790808511683';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."seat_status_enum" AS ENUM('available', 'locked', 'sold')`,
    );
    await queryRunner.query(
      `CREATE TABLE "seat" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "row" character varying(10) NOT NULL, "number" integer NOT NULL, "price" numeric(10,2) NOT NULL, "status" "public"."seat_status_enum" NOT NULL DEFAULT 'available', "version" integer NOT NULL, "event_id" uuid NOT NULL, CONSTRAINT "UQ_1d8d8b976344e33635160d8b9f6" UNIQUE ("event_id", "row", "number"), CONSTRAINT "PK_4e72ae40c3fbd7711ccb380ac17" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "description" character varying(255) NOT NULL, "date" TIMESTAMP WITH TIME ZONE NOT NULL, "total_tickets" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_30c2f3bbaf6d34a55f8ae6e4614" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_status_enum" AS ENUM('pending', 'paid', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "order" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "status" "public"."order_status_enum" NOT NULL DEFAULT 'pending', "amount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "seat_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1031171c13130102495201e3e20" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9dd481dc7ea4c1a3777a417827" ON "order" ("status", "expires_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payment_status_enum" AS ENUM('pending', 'paid', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payment" ("id" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL, "status" "public"."payment_status_enum" NOT NULL DEFAULT 'pending', "orderId" uuid NOT NULL, "externalId" character varying(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d09d285fe1645cd2f0db811e293" UNIQUE ("orderId"), CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_100f1d6e907e792a369ccce3f5" ON "payment" ("status", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "seat" ADD CONSTRAINT "FK_459b72aacbcf1ee405375b09cd5" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD CONSTRAINT "FK_7651fa224c0a0f28e096b5e2e4b" FOREIGN KEY ("seat_id") REFERENCES "seat"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP CONSTRAINT "FK_7651fa224c0a0f28e096b5e2e4b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seat" DROP CONSTRAINT "FK_459b72aacbcf1ee405375b09cd5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_100f1d6e907e792a369ccce3f5"`,
    );
    await queryRunner.query(`DROP TABLE "payment"`);
    await queryRunner.query(`DROP TYPE "public"."payment_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9dd481dc7ea4c1a3777a417827"`,
    );
    await queryRunner.query(`DROP TABLE "order"`);
    await queryRunner.query(`DROP TYPE "public"."order_status_enum"`);
    await queryRunner.query(`DROP TABLE "event"`);
    await queryRunner.query(`DROP TABLE "seat"`);
    await queryRunner.query(`DROP TYPE "public"."seat_status_enum"`);
  }
}
