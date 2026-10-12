#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4f615bea1375d3a5e4b9440499dd63e5b6b334643543da68ca2d2f9b8db5d414/contract';
import endContract from '../../snapshots/4f615bea1375d3a5e4b9440499dd63e5b6b334643543da68ca2d2f9b8db5d414/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/85cb3e7546fca1161e2a8d47879f31aa5a728021c8f86f615590ec876befdec2/contract';
import startContract from '../../snapshots/85cb3e7546fca1161e2a8d47879f31aa5a728021c8f86f615590ec876befdec2/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'hotel',
        table: 'roomBlock',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('endDate', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reason', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('roomId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('startDate', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('updatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('roomBlock_dates_ordered_e041dc87', '"endDate" > "startDate"'),
        ],
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'promotion',
        column: col('arrivalTo', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'promotion',
        column: col('departureFrom', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'promotion',
        column: col('discountAmount', 'numeric(10,2)', {
          codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
        }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'promotion',
        column: col('maxStayNights', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'promotion',
        constraint: 'promotion_amount_positive_913e8f61',
        expression: '"discountAmount" IS NULL OR "discountAmount" >= 0',
      }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'promotion',
        constraint: 'promotion_exactly_one_discount_2f378b04',
        expression:
          '("discountPercent" > 0) <> ("discountAmount" IS NOT NULL AND "discountAmount" > 0)',
      }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'promotion',
        constraint: 'promotion_percent_range_9843ff63',
        expression: '"discountPercent" >= 0 AND "discountPercent" <= 100',
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'roomBlock',
        index: 'roomBlock_roomId_idx_fe51d647',
        columns: ['roomId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'roomBlock',
        index: 'roomBlock_roomId_startDate_endDate_idx_d3b26066',
        columns: ['roomId', 'startDate', 'endDate'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'roomBlock',
        index: 'roomBlock_startDate_endDate_idx_c734dcfc',
        columns: ['startDate', 'endDate'],
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'roomBlock',
        foreignKey: {
          name: 'roomBlock_roomId_fkey',
          columns: ['roomId'],
          references: { schema: 'hotel', table: 'room', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
