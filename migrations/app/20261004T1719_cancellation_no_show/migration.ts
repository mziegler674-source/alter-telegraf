#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4e4f8b2f2759116601434a271ca84bb6d0935b395d7a14c0c2fcba2faf32123c/contract';
import startContract from '../../snapshots/4e4f8b2f2759116601434a271ca84bb6d0935b395d7a14c0c2fcba2faf32123c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/571d9bda09e551510ac041e43d62609dc755ea81198c2cff5bb86f30de0238b8/contract';
import endContract from '../../snapshots/571d9bda09e551510ac041e43d62609dc755ea81198c2cff5bb86f30de0238b8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'hotel',
        table: 'cancellationPolicy',
        column: col('noShowFeePercent', 'numeric(5,2)', {
          codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 5, scale: 2 } },
        }),
      }),
      this.addCheckConstraint({
        schema: 'hotel',
        table: 'cancellationPolicy',
        constraint: 'cancellationPolicy_noShow_range_41e91451',
        expression:
          '"noShowFeePercent" IS NULL OR ("noShowFeePercent" >= 0 AND "noShowFeePercent" <= 100)',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
