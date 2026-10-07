#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/90ff17feb90fb2b26b1d615f5e4b8e87f57c13a9c73125eb40b66a8e69502f0a/contract';
import startContract from '../../snapshots/90ff17feb90fb2b26b1d615f5e4b8e87f57c13a9c73125eb40b66a8e69502f0a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e8b57114034c78c554f7f965e000ad9995112a72a0ae9ec02911c0393925c71d/contract';
import endContract from '../../snapshots/e8b57114034c78c554f7f965e000ad9995112a72a0ae9ec02911c0393925c71d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'hotel',
        table: 'room',
        column: col('bedType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      rawSql({
        id: 'backfill-room-bedType',
        label: 'Bettart je physischem Zimmer setzen',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [],
        execute: [
          {
            description: 'Bettart je physischem Zimmer setzen',
            sql: "UPDATE \"hotel\".\"room\" SET \"bedType\" = CASE WHEN \"number\" IN ('11', '12', '14', '17', '18', '19', '20') THEN 'EINZELBETT' WHEN \"number\" IN ('15', '16', '23', '25') THEN 'DOPPELBETT' WHEN \"number\" IN ('27', '28') THEN 'ZWEI_EINZELBETTEN' WHEN \"number\" IN ('21', '22', '24') THEN 'DOPPELBETT_PLUS_ZWEI' WHEN \"number\" IN ('26') THEN 'DREI_BETTEN' END WHERE \"bedType\" IS NULL",
          },
        ],
        postcheck: [
          {
            description: 'Keine Zimmer ohne bedType',
            sql: "SELECT NOT EXISTS (SELECT 1 FROM \"hotel\".\"room\" WHERE \"bedType\" IS NULL) AS \"result\"",
          },
        ],
      }),
      this.setNotNull({ schema: 'hotel', table: 'room', column: 'bedType' }),
      this.addColumn({
        schema: 'hotel',
        table: 'room',
        column: col('maxOccupancy', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      rawSql({
        id: 'backfill-room-maxOccupancy',
        label: 'Maximale Belegung je physischem Zimmer setzen',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [],
        execute: [
          {
            description: 'Maximale Belegung je physischem Zimmer setzen',
            sql: "UPDATE \"hotel\".\"room\" SET \"maxOccupancy\" = CASE WHEN \"number\" IN ('11', '12', '14', '17', '18', '19', '20') THEN 1 WHEN \"number\" IN ('15', '16', '23', '25', '27', '28') THEN 2 WHEN \"number\" IN ('26') THEN 3 WHEN \"number\" IN ('21', '22', '24') THEN 4 END WHERE \"maxOccupancy\" IS NULL",
          },
        ],
        postcheck: [
          {
            description: 'Keine Zimmer ohne maxOccupancy',
            sql: "SELECT NOT EXISTS (SELECT 1 FROM \"hotel\".\"room\" WHERE \"maxOccupancy\" IS NULL) AS \"result\"",
          },
        ],
      }),
      this.setNotNull({ schema: 'hotel', table: 'room', column: 'maxOccupancy' }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'room',
        constraint: 'room_bedType_check_e45e091c',
        expression:
          "\"bedType\" IN ('EINZELBETT', 'DOPPELBETT', 'ZWEI_EINZELBETTEN', 'DOPPELBETT_PLUS_ZWEI', 'DREI_BETTEN')",
      }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'room',
        constraint: 'room_maxOccupancy_positive_4567c694',
        expression: '"maxOccupancy" >= 1',
      }),
      this.createIndex({
        schema: 'hotel',
        table: 'room',
        index: 'room_roomTypeId_active_maxOccupancy_idx_8f0e25e9',
        columns: ['roomTypeId', 'active', 'maxOccupancy'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
