#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/26e79520d2236b0bdaf6036faf566d6f591810c2d0ecc11077a8782044eaedc4/contract';
import startContract from '../../snapshots/26e79520d2236b0bdaf6036faf566d6f591810c2d0ecc11077a8782044eaedc4/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7022103f751f618c06f5107afe144ae87b8d050db7d65e2aa128230e50ca0ef9/contract';
import endContract from '../../snapshots/7022103f751f618c06f5107afe144ae87b8d050db7d65e2aa128230e50ca0ef9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'menuCard',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('data', 'bytea', { codecRef: { codecId: 'pg/bytea@1' } }),
          col('fileName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('restaurantId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sizeBytes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uploadedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'menuCard',
        constraint: 'menuCard_restaurantId_slug_key',
        columns: ['restaurantId', 'slug'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'menuCard',
        index: 'menuCard_restaurantId_idx_cf3ee7d0',
        columns: ['restaurantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'menuCard',
        index: 'menuCard_restaurantId_sortOrder_idx_6ecc974f',
        columns: ['restaurantId', 'sortOrder'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'menuCard',
        foreignKey: {
          name: 'menuCard_restaurantId_fkey',
          columns: ['restaurantId'],
          references: { schema: 'public', table: 'restaurant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
