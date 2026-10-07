#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7022103f751f618c06f5107afe144ae87b8d050db7d65e2aa128230e50ca0ef9/contract';
import startContract from '../../snapshots/7022103f751f618c06f5107afe144ae87b8d050db7d65e2aa128230e50ca0ef9/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/90ff17feb90fb2b26b1d615f5e4b8e87f57c13a9c73125eb40b66a8e69502f0a/contract';
import endContract from '../../snapshots/90ff17feb90fb2b26b1d615f5e4b8e87f57c13a9c73125eb40b66a8e69502f0a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropNotNull({ schema: 'hotel', table: 'ratePrice', column: 'date' }),
      this.createIndex({
        schema: 'hotel',
        table: 'ratePrice',
        index: 'ratePrice_base_unique_fa612b53',
        columns: ['ratePlanId', 'roomTypeId', 'occupancy'],
        extras: { where: '"date" IS NULL', unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
