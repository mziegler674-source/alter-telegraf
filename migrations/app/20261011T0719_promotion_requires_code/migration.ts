#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4f615bea1375d3a5e4b9440499dd63e5b6b334643543da68ca2d2f9b8db5d414/contract';
import startContract from '../../snapshots/4f615bea1375d3a5e4b9440499dd63e5b6b334643543da68ca2d2f9b8db5d414/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9f2428f692cbd8bc586a0c4c52118981b533b17fe74c305c08275eab1aec2858/contract';
import endContract from '../../snapshots/9f2428f692cbd8bc586a0c4c52118981b533b17fe74c305c08275eab1aec2858/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'hotel',
        table: 'promotion',
        column: col('requiresCode', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
