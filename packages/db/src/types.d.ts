import type { DatabaseType } from "./database";
import type { Pagination } from "./dbUtils";
import type { tables } from "./relations";

export type TableNames = keyof typeof tables;
export type TransactionType = Parameters<
  Parameters<DatabaseType["transaction"]>[0]
>[0];
export type WithInput<T extends TableNames> =
  NonNullable<Parameters<DatabaseType["query"][T]["findFirst"]>[0]> extends {
    with?: infer W;
  }
    ? W
    : never;
export type WhereInput<T extends TableNames> =
  NonNullable<Parameters<DatabaseType["query"][T]["findFirst"]>[0]> extends {
    where?: infer W;
  }
    ? W
    : never;

export type QueryReturnType<T extends TableNames> = NonNullable<
  Awaited<ReturnType<DatabaseType["query"][T]["findFirst"]>>
>;

export type ColumnsInput<T extends TableNames> = Record<
  keyof (typeof tables)[T]["_"]["columns"],
  boolean
>;
export interface QueryFilters<T extends TableNames> {
  columns?: ColumnsInput<T>;
  pagination?: Pagination<QueryReturnType<T>>;
  where?: WhereInput<T>;
  with?: WithInput<T>;
}
