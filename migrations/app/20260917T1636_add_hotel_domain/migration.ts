#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/494ce199e551d31dadf0097d595f126561f193c830b79cf0e1205734f5805f45/contract';
import endContract from '../../snapshots/494ce199e551d31dadf0097d595f126561f193c830b79cf0e1205734f5805f45/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/61a9f9729fb88e32b8831378f9dd5e91643077af0fc124fdfdc5a07af85e3396/contract';
import startContract from '../../snapshots/61a9f9729fb88e32b8831378f9dd5e91643077af0fc124fdfdc5a07af85e3396/contract.json' with { type: 'json' };
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
      this.createSchema({ schema: 'hotel' }),
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
        table: 'booking',
        columns: [
          col('adults', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('bookingNumber', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('cancellationFee', 'numeric(10,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('cancellationPolicySnapshot', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('cancelledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('checkIn', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('checkOut', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('children', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('currency', 'text', {
            notNull: true,
            default: lit('EUR'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('depositDue', 'numeric(10,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('depositPaidAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('externalBookingId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('externalChannel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('extrasTotal', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('guestId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('guestMessage', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('internalNote', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('roomsTotal', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('source', 'text', {
            notNull: true,
            default: lit('WEBSITE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('INQUIRY'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('totalAmount', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('updatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('booking_dates_ordered_895ca4da', '"checkOut" > "checkIn"'),
          checkExpression(
            'booking_source_check_0cd4d5fd',
            "\"source\" IN ('WEBSITE', 'PHONE', 'EMAIL', 'WALK_IN', 'MANUAL', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB', 'OTHER')",
          ),
          checkExpression(
            'booking_status_check_8281edf7',
            "\"status\" IN ('INQUIRY', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW')",
          ),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'bookingExtra',
        columns: [
          col('bookingId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('bookingRoomId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('quantity', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('serviceItemId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('totalAmount', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('unitPrice', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('unitSnapshot', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('bookingExtra_quantity_positive_4c388344', '"quantity" >= 1'),
          checkExpression(
            'bookingExtra_unitSnapshot_check_0f625b6f',
            "\"unitSnapshot\" IN ('PER_STAY', 'PER_NIGHT', 'PER_DAY', 'PER_PERSON', 'PER_PERSON_NIGHT')",
          ),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'bookingRoom',
        columns: [
          col('adults', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('bookingId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('checkIn', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('checkOut', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('children', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('guestName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('pricingModeSnapshot', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ratePlanId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('roomId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('roomTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('totalAmount', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('bookingRoom_dates_ordered_895ca4da', '"checkOut" > "checkIn"'),
          checkExpression(
            'bookingRoom_pricingModeSnapshot_check_114bbb7c',
            "\"pricingModeSnapshot\" IN ('PER_ROOM', 'PER_PERSON')",
          ),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'bookingRoomGuest',
        columns: [
          col('bookingRoomId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('guestId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isChild', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isPrimary', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('registeredAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'bookingRoomNight',
        columns: [
          col('amount', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('bookingRoomId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('date', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('occupancySnapshot', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('bookingRoomNight_amount_nonneg_b0224f56', '"amount" >= 0'),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'cancellationPolicy',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'cancellationRule',
        columns: [
          col('appliesFromDaysBefore', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('basis', 'text', {
            notNull: true,
            default: lit('PERCENT_OF_TOTAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('feeAmount', 'numeric(10,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('feePercent', 'numeric(5,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('policyId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'cancellationRule_basis_check_87bb958e',
            "\"basis\" IN ('PERCENT_OF_TOTAL', 'FIRST_NIGHT', 'FIXED_AMOUNT')",
          ),
          checkExpression(
            'cancellationRule_percent_range_3f55e59c',
            '"feePercent" IS NULL OR ("feePercent" >= 0 AND "feePercent" <= 100)',
          ),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'guest',
        columns: [
          col('birthDate', 'date', { codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('city', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('countryCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('firstName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('idDocumentNo', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('idDocumentType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nationality', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('postalCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('street', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'hotel',
        columns: [
          col('checkInFrom', 'time', { codecRef: { codecId: 'pg/time-temporal@1' } }),
          col('checkOutUntil', 'time', { codecRef: { codecId: 'pg/time-temporal@1' } }),
          col('city', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('countryCode', 'text', {
            notNull: true,
            default: lit('AT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('currency', 'text', {
            notNull: true,
            default: lit('EUR'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('defaultVatRate', 'numeric(5,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fax', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('latitude', 'numeric(9,6)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 9, scale: 6 } },
          }),
          col('legalName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('longitude', 'numeric(9,6)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 9, scale: 6 } },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('postalCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('receptionFrom', 'time', { codecRef: { codecId: 'pg/time-temporal@1' } }),
          col('receptionUntil', 'time', { codecRef: { codecId: 'pg/time-temporal@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('street', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timezone', 'text', {
            notNull: true,
            default: lit('Europe/Vienna'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('vatId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'hotelUser',
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
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('employee'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'inventory',
        columns: [
          col('allotment', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('booked', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('closedToArrival', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('closedToDeparture', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('date', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('minStay', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('roomTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('stopSell', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'inventory_booked_within_allotment_20d5e4c4',
            '"booked" >= 0 AND "booked" <= "allotment"',
          ),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'ratePlan',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('advanceBookingDays', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('cancellationPolicyId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('channelCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('discountPercent', 'numeric(5,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('maxStay', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('mealPlan', 'text', {
            notNull: true,
            default: lit('BREAKFAST'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('minStay', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ratePlan_mealPlan_check_280a1e27',
            "\"mealPlan\" IN ('ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD')",
          ),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'ratePrice',
        columns: [
          col('amount', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('date', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('occupancy', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ratePlanId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('roomTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('ratePrice_amount_nonneg_b0224f56', '"amount" >= 0'),
          checkExpression('ratePrice_occupancy_positive_1dbe677e', '"occupancy" >= 1'),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'room',
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
          col('floor', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('number', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('roomTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('CLEAN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'room_status_check_b5dad1ea',
            "\"status\" IN ('CLEAN', 'DIRTY', 'INSPECTED', 'OUT_OF_SERVICE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'roomType',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('bedConfiguration', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('breakfastIncluded', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('channelCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('maxAdults', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('maxChildren', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('maxOccupancy', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('pricingMode', 'text', {
            notNull: true,
            default: lit('PER_ROOM'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('shortDescription', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sizeSqm', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('standardOccupancy', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'roomType_occupancy_sane_f5a2c30b',
            '"maxOccupancy" >= "standardOccupancy" AND "standardOccupancy" >= 1',
          ),
          checkExpression(
            'roomType_pricingMode_check_9fbdfe81',
            "\"pricingMode\" IN ('PER_ROOM', 'PER_PERSON')",
          ),
        ],
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
      this.createTable({
        schema: 'hotel',
        table: 'roomTypeImage',
        columns: [
          col('alt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isPrimary', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('roomTypeId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'hotel',
        table: 'serviceItem',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('hotelId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('mandatory', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('price', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('unit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('vatRate', 'numeric(5,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'serviceItem_unit_check_4bc12991',
            "\"unit\" IN ('PER_STAY', 'PER_NIGHT', 'PER_DAY', 'PER_PERSON', 'PER_PERSON_NIGHT')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'amenity',
        constraint: 'amenity_hotelId_code_key',
        columns: ['hotelId', 'code'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'booking',
        constraint: 'booking_bookingNumber_key',
        columns: ['bookingNumber'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'booking',
        constraint: 'booking_externalChannel_externalBookingId_key',
        columns: ['externalChannel', 'externalBookingId'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'bookingRoomGuest',
        constraint: 'bookingRoomGuest_bookingRoomId_guestId_key',
        columns: ['bookingRoomId', 'guestId'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'bookingRoomNight',
        constraint: 'bookingRoomNight_bookingRoomId_date_key',
        columns: ['bookingRoomId', 'date'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'cancellationPolicy',
        constraint: 'cancellationPolicy_hotelId_code_key',
        columns: ['hotelId', 'code'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'cancellationRule',
        constraint: 'cancellationRule_policyId_appliesFromDaysBefore_key',
        columns: ['policyId', 'appliesFromDaysBefore'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'hotel',
        constraint: 'hotel_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'hotelUser',
        constraint: 'hotelUser_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'inventory',
        constraint: 'inventory_roomTypeId_date_key',
        columns: ['roomTypeId', 'date'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'ratePlan',
        constraint: 'ratePlan_hotelId_code_key',
        columns: ['hotelId', 'code'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'ratePrice',
        constraint: 'ratePrice_ratePlanId_roomTypeId_date_occupancy_key',
        columns: ['ratePlanId', 'roomTypeId', 'date', 'occupancy'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'room',
        constraint: 'room_hotelId_number_key',
        columns: ['hotelId', 'number'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'roomType',
        constraint: 'roomType_hotelId_code_key',
        columns: ['hotelId', 'code'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'roomType',
        constraint: 'roomType_hotelId_slug_key',
        columns: ['hotelId', 'slug'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'roomTypeAmenity',
        constraint: 'roomTypeAmenity_roomTypeId_amenityId_key',
        columns: ['roomTypeId', 'amenityId'],
      }),
      this.addUnique({
        schema: 'hotel',
        table: 'serviceItem',
        constraint: 'serviceItem_hotelId_code_key',
        columns: ['hotelId', 'code'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'amenity',
        index: 'amenity_hotelId_idx_462a16a4',
        columns: ['hotelId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'booking',
        index: 'booking_guestId_idx_39c95865',
        columns: ['guestId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'booking',
        index: 'booking_hotelId_checkIn_idx_37dd233b',
        columns: ['hotelId', 'checkIn'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'booking',
        index: 'booking_hotelId_idx_462a16a4',
        columns: ['hotelId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'booking',
        index: 'booking_hotelId_status_idx_9add637b',
        columns: ['hotelId', 'status'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingExtra',
        index: 'bookingExtra_bookingId_idx_17848f4a',
        columns: ['bookingId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingExtra',
        index: 'bookingExtra_bookingRoomId_idx_d276de28',
        columns: ['bookingRoomId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingExtra',
        index: 'bookingExtra_serviceItemId_idx_92c43a54',
        columns: ['serviceItemId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoom',
        index: 'bookingRoom_bookingId_idx_17848f4a',
        columns: ['bookingId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoom',
        index: 'bookingRoom_ratePlanId_idx_18cf7a69',
        columns: ['ratePlanId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoom',
        index: 'bookingRoom_roomId_checkIn_idx_35b569d4',
        columns: ['roomId', 'checkIn'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoom',
        index: 'bookingRoom_roomId_idx_fe51d647',
        columns: ['roomId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoom',
        index: 'bookingRoom_roomTypeId_checkIn_checkOut_idx_63f5ddf2',
        columns: ['roomTypeId', 'checkIn', 'checkOut'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoom',
        index: 'bookingRoom_roomTypeId_idx_0c4e04bc',
        columns: ['roomTypeId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoomGuest',
        index: 'bookingRoomGuest_bookingRoomId_idx_d276de28',
        columns: ['bookingRoomId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoomGuest',
        index: 'bookingRoomGuest_guestId_idx_39c95865',
        columns: ['guestId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoomNight',
        index: 'bookingRoomNight_bookingRoomId_idx_d276de28',
        columns: ['bookingRoomId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'bookingRoomNight',
        index: 'bookingRoomNight_date_idx_b4ca319c',
        columns: ['date'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'cancellationPolicy',
        index: 'cancellationPolicy_hotelId_idx_462a16a4',
        columns: ['hotelId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'cancellationRule',
        index: 'cancellationRule_policyId_idx_17c369b7',
        columns: ['policyId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'guest',
        index: 'guest_email_idx_46df9cad',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'guest',
        index: 'guest_lastName_firstName_idx_3659da4b',
        columns: ['lastName', 'firstName'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'hotelUser',
        index: 'hotelUser_hotelId_idx_462a16a4',
        columns: ['hotelId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'inventory',
        index: 'inventory_date_idx_b4ca319c',
        columns: ['date'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'inventory',
        index: 'inventory_roomTypeId_idx_0c4e04bc',
        columns: ['roomTypeId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'ratePlan',
        index: 'ratePlan_cancellationPolicyId_idx_1c1d783e',
        columns: ['cancellationPolicyId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'ratePlan',
        index: 'ratePlan_hotelId_active_idx_f1412091',
        columns: ['hotelId', 'active'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'ratePlan',
        index: 'ratePlan_hotelId_idx_462a16a4',
        columns: ['hotelId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'ratePrice',
        index: 'ratePrice_ratePlanId_idx_18cf7a69',
        columns: ['ratePlanId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'ratePrice',
        index: 'ratePrice_roomTypeId_date_idx_e3cdd455',
        columns: ['roomTypeId', 'date'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'ratePrice',
        index: 'ratePrice_roomTypeId_idx_0c4e04bc',
        columns: ['roomTypeId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'room',
        index: 'room_hotelId_idx_462a16a4',
        columns: ['hotelId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'room',
        index: 'room_roomTypeId_active_idx_90d77a69',
        columns: ['roomTypeId', 'active'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'room',
        index: 'room_roomTypeId_idx_0c4e04bc',
        columns: ['roomTypeId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'roomType',
        index: 'roomType_hotelId_active_sortOrder_idx_a0fbd2a6',
        columns: ['hotelId', 'active', 'sortOrder'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'roomType',
        index: 'roomType_hotelId_idx_462a16a4',
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
        index: 'roomTypeImage_roomTypeId_idx_0c4e04bc',
        columns: ['roomTypeId'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'roomTypeImage',
        index: 'roomTypeImage_roomTypeId_sortOrder_idx_001bce14',
        columns: ['roomTypeId', 'sortOrder'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'serviceItem',
        index: 'serviceItem_hotelId_active_idx_f1412091',
        columns: ['hotelId', 'active'],
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'serviceItem',
        index: 'serviceItem_hotelId_idx_462a16a4',
        columns: ['hotelId'],
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
        table: 'booking',
        foreignKey: {
          name: 'booking_hotelId_fkey',
          columns: ['hotelId'],
          references: { schema: 'hotel', table: 'hotel', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'booking',
        foreignKey: {
          name: 'booking_guestId_fkey',
          columns: ['guestId'],
          references: { schema: 'hotel', table: 'guest', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingExtra',
        foreignKey: {
          name: 'bookingExtra_bookingId_fkey',
          columns: ['bookingId'],
          references: { schema: 'hotel', table: 'booking', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingExtra',
        foreignKey: {
          name: 'bookingExtra_bookingRoomId_fkey',
          columns: ['bookingRoomId'],
          references: { schema: 'hotel', table: 'bookingRoom', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingExtra',
        foreignKey: {
          name: 'bookingExtra_serviceItemId_fkey',
          columns: ['serviceItemId'],
          references: { schema: 'hotel', table: 'serviceItem', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingRoom',
        foreignKey: {
          name: 'bookingRoom_bookingId_fkey',
          columns: ['bookingId'],
          references: { schema: 'hotel', table: 'booking', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingRoom',
        foreignKey: {
          name: 'bookingRoom_roomTypeId_fkey',
          columns: ['roomTypeId'],
          references: { schema: 'hotel', table: 'roomType', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingRoom',
        foreignKey: {
          name: 'bookingRoom_roomId_fkey',
          columns: ['roomId'],
          references: { schema: 'hotel', table: 'room', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingRoom',
        foreignKey: {
          name: 'bookingRoom_ratePlanId_fkey',
          columns: ['ratePlanId'],
          references: { schema: 'hotel', table: 'ratePlan', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingRoomGuest',
        foreignKey: {
          name: 'bookingRoomGuest_bookingRoomId_fkey',
          columns: ['bookingRoomId'],
          references: { schema: 'hotel', table: 'bookingRoom', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingRoomGuest',
        foreignKey: {
          name: 'bookingRoomGuest_guestId_fkey',
          columns: ['guestId'],
          references: { schema: 'hotel', table: 'guest', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'bookingRoomNight',
        foreignKey: {
          name: 'bookingRoomNight_bookingRoomId_fkey',
          columns: ['bookingRoomId'],
          references: { schema: 'hotel', table: 'bookingRoom', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'cancellationPolicy',
        foreignKey: {
          name: 'cancellationPolicy_hotelId_fkey',
          columns: ['hotelId'],
          references: { schema: 'hotel', table: 'hotel', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'cancellationRule',
        foreignKey: {
          name: 'cancellationRule_policyId_fkey',
          columns: ['policyId'],
          references: { schema: 'hotel', table: 'cancellationPolicy', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'hotelUser',
        foreignKey: {
          name: 'hotelUser_hotelId_fkey',
          columns: ['hotelId'],
          references: { schema: 'hotel', table: 'hotel', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'inventory',
        foreignKey: {
          name: 'inventory_roomTypeId_fkey',
          columns: ['roomTypeId'],
          references: { schema: 'hotel', table: 'roomType', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'ratePlan',
        foreignKey: {
          name: 'ratePlan_hotelId_fkey',
          columns: ['hotelId'],
          references: { schema: 'hotel', table: 'hotel', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'ratePlan',
        foreignKey: {
          name: 'ratePlan_cancellationPolicyId_fkey',
          columns: ['cancellationPolicyId'],
          references: { schema: 'hotel', table: 'cancellationPolicy', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'ratePrice',
        foreignKey: {
          name: 'ratePrice_ratePlanId_fkey',
          columns: ['ratePlanId'],
          references: { schema: 'hotel', table: 'ratePlan', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'ratePrice',
        foreignKey: {
          name: 'ratePrice_roomTypeId_fkey',
          columns: ['roomTypeId'],
          references: { schema: 'hotel', table: 'roomType', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'room',
        foreignKey: {
          name: 'room_hotelId_fkey',
          columns: ['hotelId'],
          references: { schema: 'hotel', table: 'hotel', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'room',
        foreignKey: {
          name: 'room_roomTypeId_fkey',
          columns: ['roomTypeId'],
          references: { schema: 'hotel', table: 'roomType', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'roomType',
        foreignKey: {
          name: 'roomType_hotelId_fkey',
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
      this.addForeignKey({
        schema: 'hotel',
        table: 'roomTypeImage',
        foreignKey: {
          name: 'roomTypeImage_roomTypeId_fkey',
          columns: ['roomTypeId'],
          references: { schema: 'hotel', table: 'roomType', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'hotel',
        table: 'serviceItem',
        foreignKey: {
          name: 'serviceItem_hotelId_fkey',
          columns: ['hotelId'],
          references: { schema: 'hotel', table: 'hotel', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
