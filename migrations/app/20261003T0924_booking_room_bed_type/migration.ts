#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c0b473f82865463373971640b54b38086e6c5d820be91ac22b4c2237981eeb55/contract';
import endContract from '../../snapshots/c0b473f82865463373971640b54b38086e6c5d820be91ac22b4c2237981eeb55/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e8b57114034c78c554f7f965e000ad9995112a72a0ae9ec02911c0393925c71d/contract';
import startContract from '../../snapshots/e8b57114034c78c554f7f965e000ad9995112a72a0ae9ec02911c0393925c71d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'hotel',
        table: 'bookingRoom',
        column: col('bedType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'bookingRoom',
        constraint: 'bookingRoom_bedType_check_e45e091c',
        expression:
          "\"bedType\" IN ('EINZELBETT', 'DOPPELBETT', 'ZWEI_EINZELBETTEN', 'DOPPELBETT_PLUS_ZWEI', 'DREI_BETTEN')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
