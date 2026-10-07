#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/26e79520d2236b0bdaf6036faf566d6f591810c2d0ecc11077a8782044eaedc4/contract';
import endContract from '../../snapshots/26e79520d2236b0bdaf6036faf566d6f591810c2d0ecc11077a8782044eaedc4/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6b6a8714d03fdb1315d0d0339b186378efe5f949c5045ac7cf789840bbc154f4/contract';
import startContract from '../../snapshots/6b6a8714d03fdb1315d0d0339b186378efe5f949c5045ac7cf789840bbc154f4/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'menuItem',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('menu', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('price', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('restaurantId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'menuItem_menu_check_2cc72902',
            "\"menu\" IN ('SPEISEKARTE', 'GAESTEVERKAUF')",
          ),
          checkExpression('menuItem_price_nonneg_0b66b9e8', '"price" >= 0'),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'menuItem',
        index: 'menuItem_restaurantId_idx_cf3ee7d0',
        columns: ['restaurantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'menuItem',
        index: 'menuItem_restaurantId_menu_active_sortOrder_idx_8a9556c8',
        columns: ['restaurantId', 'menu', 'active', 'sortOrder'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'menuItem',
        foreignKey: {
          name: 'menuItem_restaurantId_fkey',
          columns: ['restaurantId'],
          references: { schema: 'public', table: 'restaurant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
