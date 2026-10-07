#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/502c11bb190331d01c50670a1ae835808ac8389177aa52d75ae02137f6c52779/contract';
import endContract from '../../snapshots/502c11bb190331d01c50670a1ae835808ac8389177aa52d75ae02137f6c52779/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/571d9bda09e551510ac041e43d62609dc755ea81198c2cff5bb86f30de0238b8/contract';
import startContract from '../../snapshots/571d9bda09e551510ac041e43d62609dc755ea81198c2cff5bb86f30de0238b8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'hotel',
        table: 'paymentEvent',
        columns: [
          col('bookingId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('eventId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('processedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('result', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'paymentEvent',
        constraint: 'paymentEvent_provider_eventId_key',
        columns: ['provider', 'eventId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'paymentEvent',
        index: 'paymentEvent_bookingId_idx_17848f4a',
        columns: ['bookingId'],
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'paymentEvent',
        foreignKey: {
          name: 'paymentEvent_bookingId_fkey',
          columns: ['bookingId'],
          references: { schema: 'hotel', table: 'booking', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
