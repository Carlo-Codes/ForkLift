import type { DatabaseType } from "./database";
import { getDb, setDb } from "./database";
import type { PaginatedData, Pagination } from "./dbUtils";
import { customCount, formatPaginated } from "./dbUtils";
import type {
  ColumnsInput,
  QueryFilters,
  TableNames,
  TransactionType,
  WhereInput,
  WithInput
} from "./types";

// Safe for React Native: no better-sqlite3 or Node built-ins.
export * from "drizzle-orm";
export * from "./schemas";
export { relations, tables } from "./relations";
export type {
  DatabaseType,
  Pagination,
  PaginatedData,
  WhereInput,
  WithInput,
  ColumnsInput,
  QueryFilters,
  TableNames,
  TransactionType
};
export {
  getDb, setDb, formatPaginated, customCount
};
