import type { AnyColumn } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface Pagination<T> {
  orderBy: { [key in keyof T]?: "asc" | "desc" };
  limit: number;
  offset: number;
}

export interface PaginatedData<T> {
  data: T[];
  pageCount: number;
  totalCount: number;
  currentPage: number;
  limit: number;
  offset: number;
  orderBy: Pagination<T>["orderBy"];
}

export const formatPaginated = <T>(
  totalCount: number,
  pagination: Pagination<T>,
  results: T[]
): PaginatedData<T> => {
  return {
    data: results,
    pageCount: Math.ceil(totalCount / pagination.limit),
    totalCount,
    currentPage: Math.ceil(pagination.offset / pagination.limit) + 1,
    limit: pagination.limit,
    offset: pagination.offset,
    orderBy: pagination.orderBy
  };
};

export const customCount = (column?: AnyColumn) => {
  if (column) {
    return sql<number>`count(${column}) OVER ()`;
  } else {
    return sql<number>`count(*) OVER ()`;
  }
};
