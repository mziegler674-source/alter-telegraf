#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/502c11bb190331d01c50670a1ae835808ac8389177aa52d75ae02137f6c52779/contract';
import startContract from '../../snapshots/502c11bb190331d01c50670a1ae835808ac8389177aa52d75ae02137f6c52779/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/85cb3e7546fca1161e2a8d47879f31aa5a728021c8f86f615590ec876befdec2/contract';
import endContract from '../../snapshots/85cb3e7546fca1161e2a8d47879f31aa5a728021c8f86f615590ec876befdec2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'emailLog',
        columns: [
          col('attempt', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('error', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('messageId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('recipient', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subjectId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('subjectType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('transport', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailLog',
        index: 'emailLog_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailLog',
        index: 'emailLog_subjectType_subjectId_idx_34976a96',
        columns: ['subjectType', 'subjectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailLog',
        index: 'emailLog_type_createdAt_idx_00d94001',
        columns: ['type', 'createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
