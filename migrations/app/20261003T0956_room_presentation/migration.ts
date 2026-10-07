#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4e4f8b2f2759116601434a271ca84bb6d0935b395d7a14c0c2fcba2faf32123c/contract';
import endContract from '../../snapshots/4e4f8b2f2759116601434a271ca84bb6d0935b395d7a14c0c2fcba2faf32123c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c0b473f82865463373971640b54b38086e6c5d820be91ac22b4c2237981eeb55/contract';
import startContract from '../../snapshots/c0b473f82865463373971640b54b38086e6c5d820be91ac22b4c2237981eeb55/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'hotel',
        table: 'amenity',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('icon', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'roomTypeAmenity',
        columns: [
          col('amenityId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('roomTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'roomTypeImage',
        column: col('contentType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'roomTypeImage',
        column: col('data', 'bytea', { codecRef: { codecId: 'pg/bytea@1' } }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'roomTypeImage',
        column: col('fileName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'roomTypeImage',
        column: col('sizeBytes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'hotel',
        table: 'roomTypeImage',
        column: col('uploadedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.dropNotNull({ schema: 'hotel', table: 'roomTypeImage', column: 'url' }),
      this.addUnique({
        schema: 'hotel',
        table: 'amenity',
        constraint: 'amenity_hotelId_code_key',
        columns: ['hotelId', 'code'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'roomTypeAmenity',
        constraint: 'roomTypeAmenity_roomTypeId_amenityId_key',
        columns: ['roomTypeId', 'amenityId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'amenity',
        index: 'amenity_hotelId_idx_462a16a4',
        columns: ['hotelId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'roomTypeAmenity',
        index: 'roomTypeAmenity_amenityId_idx_28149e7b',
        columns: ['amenityId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'roomTypeAmenity',
        index: 'roomTypeAmenity_roomTypeId_idx_0c4e04bc',
        columns: ['roomTypeId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'roomTypeImage',
        index: 'roomTypeImage_roomTypeId_isPrimary_idx_ba36f106',
        columns: ['roomTypeId', 'isPrimary'],
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'amenity',
        foreignKey: {
          name: 'amenity_hotelId_fkey',
          columns: ['hotelId'],
          references: { schema: 'hotel', table: 'hotel', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'roomTypeAmenity',
        foreignKey: {
          name: 'roomTypeAmenity_roomTypeId_fkey',
          columns: ['roomTypeId'],
          references: { schema: 'hotel', table: 'roomType', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'roomTypeAmenity',
        foreignKey: {
          name: 'roomTypeAmenity_amenityId_fkey',
          columns: ['amenityId'],
          references: { schema: 'hotel', table: 'amenity', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
