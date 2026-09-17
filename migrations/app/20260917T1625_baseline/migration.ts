#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/61a9f9729fb88e32b8831378f9dd5e91643077af0fc124fdfdc5a07af85e3396/contract';
import endContract from '../../snapshots/61a9f9729fb88e32b8831378f9dd5e91643077af0fc124fdfdc5a07af85e3396/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'dailyMenu',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('dish', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('price', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('restaurantId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('visible', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('weekday', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'menuTemplate',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('dish', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('price', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('restaurantId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'reservation',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('firstName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('guests', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reservationDate', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('reservationTime', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('restaurantId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('NEW'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'restaurant',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('restaurantId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('employee'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'dailyMenu',
        constraint: 'dailyMenu_restaurantId_weekday_key',
        columns: ['restaurantId', 'weekday'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'restaurant',
        constraint: 'restaurant_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'dailyMenu',
        index: 'dailyMenu_restaurantId_idx_cf3ee7d0',
        columns: ['restaurantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'menuTemplate',
        index: 'menuTemplate_restaurantId_idx_cf3ee7d0',
        columns: ['restaurantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'reservation',
        index: 'reservation_restaurantId_idx_cf3ee7d0',
        columns: ['restaurantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'reservation',
        index: 'reservation_restaurantId_reservationDate_idx_da900b66',
        columns: ['restaurantId', 'reservationDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'reservation',
        index: 'reservation_restaurantId_status_idx_a6df7642',
        columns: ['restaurantId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user',
        index: 'user_restaurantId_idx_cf3ee7d0',
        columns: ['restaurantId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'dailyMenu',
        foreignKey: {
          name: 'dailyMenu_restaurantId_fkey',
          columns: ['restaurantId'],
          references: { schema: 'public', table: 'restaurant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'menuTemplate',
        foreignKey: {
          name: 'menuTemplate_restaurantId_fkey',
          columns: ['restaurantId'],
          references: { schema: 'public', table: 'restaurant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'reservation',
        foreignKey: {
          name: 'reservation_restaurantId_fkey',
          columns: ['restaurantId'],
          references: { schema: 'public', table: 'restaurant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'user',
        foreignKey: {
          name: 'user_restaurantId_fkey',
          columns: ['restaurantId'],
          references: { schema: 'public', table: 'restaurant', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
