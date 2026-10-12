#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9d59143b657cf231e47c170e01773395c275c97c0ef148e54d735515afbb0bc0/contract';
import endContract from '../../snapshots/9d59143b657cf231e47c170e01773395c275c97c0ef148e54d735515afbb0bc0/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9f2428f692cbd8bc586a0c4c52118981b533b17fe74c305c08275eab1aec2858/contract';
import startContract from '../../snapshots/9f2428f692cbd8bc586a0c4c52118981b533b17fe74c305c08275eab1aec2858/contract.json' with { type: 'json' };
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
        schema: 'hotel',
        table: 'channelMapping',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('externalPropertyId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('externalRatePlanId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('externalRoomTypeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ratePlanId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('roomTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('syncStatus', 'text', {
            notNull: true,
            default: lit('UNVERIFIED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'syncJob',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('bookingId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('dateFrom', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('dateTo', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('direction', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('externalRef', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('maxAttempts', 'int4', {
            notNull: true,
            default: lit(5),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('messageId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('nextAttemptAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('operation', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payload', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('roomTypeId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('syncJob_attempts_positive_0969939d', '"attempts" >= 0'),
        ],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'channelMapping',
        constraint: 'channelMapping_provider_externalRoomTypeId_key',
        columns: ['provider', 'externalRoomTypeId'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'syncJob',
        constraint: 'syncJob_provider_messageId_key',
        columns: ['provider', 'messageId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'channelMapping',
        index: 'channelMapping_hotelId_idx_462a16a4',
        columns: ['hotelId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'channelMapping',
        index: 'channelMapping_hotelId_provider_idx_e27ad65a',
        columns: ['hotelId', 'provider'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'channelMapping',
        index: 'channelMapping_ratePlanId_idx_18cf7a69',
        columns: ['ratePlanId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'channelMapping',
        index: 'channelMapping_roomTypeId_idx_0c4e04bc',
        columns: ['roomTypeId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'syncJob',
        index: 'syncJob_bookingId_idx_17848f4a',
        columns: ['bookingId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'syncJob',
        index: 'syncJob_provider_operation_status_idx_c7eecee3',
        columns: ['provider', 'operation', 'status'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'syncJob',
        index: 'syncJob_status_nextAttemptAt_idx_8ba20615',
        columns: ['status', 'nextAttemptAt'],
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'channelMapping',
        foreignKey: {
          name: 'channelMapping_hotelId_fkey',
          columns: ['hotelId'],
          references: { schema: 'hotel', table: 'hotel', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'channelMapping',
        foreignKey: {
          name: 'channelMapping_roomTypeId_fkey',
          columns: ['roomTypeId'],
          references: { schema: 'hotel', table: 'roomType', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'channelMapping',
        foreignKey: {
          name: 'channelMapping_ratePlanId_fkey',
          columns: ['ratePlanId'],
          references: { schema: 'hotel', table: 'ratePlan', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'syncJob',
        foreignKey: {
          name: 'syncJob_bookingId_fkey',
          columns: ['bookingId'],
          references: { schema: 'hotel', table: 'booking', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
