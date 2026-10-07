#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/494ce199e551d31dadf0097d595f126561f193c830b79cf0e1205734f5805f45/contract';
import startContract from '../../snapshots/494ce199e551d31dadf0097d595f126561f193c830b79cf0e1205734f5805f45/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6b6a8714d03fdb1315d0d0339b186378efe5f949c5045ac7cf789840bbc154f4/contract';
import endContract from '../../snapshots/6b6a8714d03fdb1315d0d0339b186378efe5f949c5045ac7cf789840bbc154f4/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  rawSql,
  primaryKey,
} from '@prisma/orm-postgres/migration';


export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      // Reihenfolge gegenueber dem Planner getauscht: roomTypeAmenity haelt einen
      // Fremdschluessel auf amenity, deshalb muss die Zuordnungstabelle zuerst weg.
      this.dropTable({ schema: 'hotel', table: 'roomTypeAmenity' }),
      this.dropTable({ schema: 'hotel', table: 'amenity' }),
      this.dropIndex({
        schema: 'hotel',
        table: 'bookingRoom',
        index: 'bookingRoom_roomId_checkIn_idx_35b569d4',
      }),
      this.createTable({
        schema: 'hotel',
        table: 'promotion',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('bookingFrom', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('bookingTo', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('channel', 'text', {
            notNull: true,
            default: lit('PUBLIC'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('discountPercent', 'numeric(5,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('earlyBookerDays', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastMinuteDays', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('minStayNights', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('stayFrom', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('stayTo', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'promotion_channel_check_d475113f',
            "\"channel\" IN ('PUBLIC', 'MOBILE')",
          ),
          checkExpression(
            'promotion_type_check_8763061b',
            "\"type\" IN ('BASIC', 'EARLY_BOOKER', 'LAST_MINUTE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'promotionRatePlan',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('promotionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ratePlanId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'promotionRoomType',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('promotionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('roomTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'booking',
        column: col('paymentAuthorizedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'booking',
        column: col('paymentChargedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'booking',
        column: col('paymentCustomerRef', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'booking',
        column: col('paymentMethod', 'text', {
          notNull: true,
          default: lit('PAY_AT_HOTEL'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'booking',
        column: col('paymentMethodRef', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'booking',
        column: col('paymentProvider', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'booking',
        column: col('paymentStatus', 'text', {
          notNull: true,
          default: lit('NOT_REQUIRED'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'ratePlan',
        column: col('cardGuaranteeRequired', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'booking',
        column: col('discountTotal', 'numeric(10,2)', {
          codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
        }),
      }),
      rawSql({
        id: 'backfill-booking-discountTotal',
        label: 'Backfill booking.discountTotal mit 0',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [],
        execute: [
          {
            description: 'Backfill booking.discountTotal mit 0',
            sql: "UPDATE \"hotel\".\"booking\" SET \"discountTotal\" = 0 WHERE \"discountTotal\" IS NULL",
          },
        ],
        postcheck: [
          {
            description: 'Keine NULL-Werte in booking.discountTotal mehr',
            sql: "SELECT NOT EXISTS (SELECT 1 FROM \"hotel\".\"booking\" WHERE \"discountTotal\" IS NULL) AS \"result\"",
          },
        ],
      }),
      this.setNotNull({ schema: 'hotel', table: 'booking', column: 'discountTotal' }),
      this.addColumn({
        schema: 'hotel',
        table: 'bookingRoom',
        column: col('mealPlanSnapshot', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      rawSql({
        id: 'backfill-bookingRoom-mealPlanSnapshot',
        label: 'Backfill bookingRoom.mealPlanSnapshot mit ROOM_ONLY',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [],
        execute: [
          {
            description: 'Backfill bookingRoom.mealPlanSnapshot mit ROOM_ONLY',
            sql: "UPDATE \"hotel\".\"bookingRoom\" SET \"mealPlanSnapshot\" = 'ROOM_ONLY' WHERE \"mealPlanSnapshot\" IS NULL",
          },
        ],
        postcheck: [
          {
            description: 'Keine NULL-Werte in bookingRoom.mealPlanSnapshot mehr',
            sql: "SELECT NOT EXISTS (SELECT 1 FROM \"hotel\".\"bookingRoom\" WHERE \"mealPlanSnapshot\" IS NULL) AS \"result\"",
          },
        ],
      }),
      this.setNotNull({ schema: 'hotel', table: 'bookingRoom', column: 'mealPlanSnapshot' }),
      this.addColumn({
        schema: 'hotel',
        table: 'room',
        column: col('bedConfiguration', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      rawSql({
        id: 'backfill-room-bedConfiguration',
        label: 'Backfill room.bedConfiguration mit Uebergangswert',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [],
        execute: [
          {
            description: 'Backfill room.bedConfiguration mit Uebergangswert',
            sql: "UPDATE \"hotel\".\"room\" SET \"bedConfiguration\" = 'Nicht erfasst' WHERE \"bedConfiguration\" IS NULL",
          },
        ],
        postcheck: [
          {
            description: 'Keine NULL-Werte in room.bedConfiguration mehr',
            sql: "SELECT NOT EXISTS (SELECT 1 FROM \"hotel\".\"room\" WHERE \"bedConfiguration\" IS NULL) AS \"result\"",
          },
        ],
      }),
      this.setNotNull({ schema: 'hotel', table: 'room', column: 'bedConfiguration' }),
      // this.setDefault(...) wurde vom Runner nicht ausgefuehrt: die Schemapruefung
      // fand danach weiterhin die alten Defaults. Deshalb explizit als rawSql,
      // inklusive Nachpruefung des tatsaechlichen Wertes.
      rawSql({
        id: 'setDefault.ratePlan.mealPlan',
        label: 'Default von ratePlan.mealPlan auf ROOM_ONLY setzen',
        operationClass: 'widening',
        target: { id: 'postgres' },
        precheck: [],
        execute: [
          {
            description: 'ratePlan.mealPlan SET DEFAULT ROOM_ONLY',
            sql: "ALTER TABLE \"hotel\".\"ratePlan\" ALTER COLUMN \"mealPlan\" SET DEFAULT 'ROOM_ONLY'",
          },
        ],
        postcheck: [
          {
            description: 'Default ist ROOM_ONLY',
            sql: "SELECT (SELECT \"column_default\" FROM \"information_schema\".\"columns\" WHERE \"table_schema\" = 'hotel' AND \"table_name\" = 'ratePlan' AND \"column_name\" = 'mealPlan') = '''ROOM_ONLY''::text' AS \"result\"",
          },
        ],
      }),
      rawSql({
        id: 'setDefault.roomType.breakfastIncluded',
        label: 'Default von roomType.breakfastIncluded auf false setzen',
        operationClass: 'widening',
        target: { id: 'postgres' },
        precheck: [],
        execute: [
          {
            description: 'roomType.breakfastIncluded SET DEFAULT false',
            sql: 'ALTER TABLE "hotel"."roomType" ALTER COLUMN "breakfastIncluded" SET DEFAULT false',
          },
        ],
        postcheck: [
          {
            description: 'Default ist false',
            sql: "SELECT (SELECT \"column_default\" FROM \"information_schema\".\"columns\" WHERE \"table_schema\" = 'hotel' AND \"table_name\" = 'roomType' AND \"column_name\" = 'breakfastIncluded') = 'false' AS \"result\"",
          },
        ],
      }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'booking',
        constraint: 'booking_paymentMethod_check_1857449a',
        expression: "\"paymentMethod\" IN ('PAY_AT_HOTEL', 'CARD_GUARANTEE')",
      }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'booking',
        constraint: 'booking_paymentStatus_check_d1c93aff',
        expression:
          "\"paymentStatus\" IN ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'AUTHORIZED', 'CHARGED', 'FAILED', 'CANCELLED')",
      }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'bookingRoom',
        constraint: 'bookingRoom_mealPlanSnapshot_check_fb97cc4d',
        expression:
          "\"mealPlanSnapshot\" IN ('ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD')",
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'promotion',
        constraint: 'promotion_hotelId_code_key',
        columns: ['hotelId', 'code'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'promotionRatePlan',
        constraint: 'promotionRatePlan_promotionId_ratePlanId_key',
        columns: ['promotionId', 'ratePlanId'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'promotionRoomType',
        constraint: 'promotionRoomType_promotionId_roomTypeId_key',
        columns: ['promotionId', 'roomTypeId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'booking',
        index: 'booking_hotelId_checkOut_idx_ac162b13',
        columns: ['hotelId', 'checkOut'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoom',
        index: 'bookingRoom_roomId_checkIn_checkOut_idx_f5abf4de',
        columns: ['roomId', 'checkIn', 'checkOut'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'promotion',
        index: 'promotion_hotelId_active_idx_f1412091',
        columns: ['hotelId', 'active'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'promotion',
        index: 'promotion_hotelId_idx_462a16a4',
        columns: ['hotelId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'promotionRatePlan',
        index: 'promotionRatePlan_promotionId_idx_61ce0068',
        columns: ['promotionId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'promotionRatePlan',
        index: 'promotionRatePlan_ratePlanId_idx_18cf7a69',
        columns: ['ratePlanId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'promotionRoomType',
        index: 'promotionRoomType_promotionId_idx_61ce0068',
        columns: ['promotionId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'promotionRoomType',
        index: 'promotionRoomType_roomTypeId_idx_0c4e04bc',
        columns: ['roomTypeId'],
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'promotion',
        foreignKey: {
          name: 'promotion_hotelId_fkey',
          columns: ['hotelId'],
          references: { schema: 'hotel', table: 'hotel', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'promotionRatePlan',
        foreignKey: {
          name: 'promotionRatePlan_promotionId_fkey',
          columns: ['promotionId'],
          references: { schema: 'hotel', table: 'promotion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'promotionRatePlan',
        foreignKey: {
          name: 'promotionRatePlan_ratePlanId_fkey',
          columns: ['ratePlanId'],
          references: { schema: 'hotel', table: 'ratePlan', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'promotionRoomType',
        foreignKey: {
          name: 'promotionRoomType_promotionId_fkey',
          columns: ['promotionId'],
          references: { schema: 'hotel', table: 'promotion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'promotionRoomType',
        foreignKey: {
          name: 'promotionRoomType_roomTypeId_fkey',
          columns: ['roomTypeId'],
          references: { schema: 'hotel', table: 'roomType', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
