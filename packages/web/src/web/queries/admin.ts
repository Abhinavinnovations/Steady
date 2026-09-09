import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Table list + counts — also serves as the "is this key right?" probe. */
export function useAdminTables(key: string | null) {
  return useQuery({
    ...orpc.admin.tables.queryOptions({ input: { key: key ?? "" } }),
    enabled: !!key,
    retry: false,
    staleTime: 10_000,
  });
}

export function useAdminRows(
  key: string | null,
  table: string | null,
  offset: number,
  limit = 50,
) {
  return useQuery({
    ...orpc.admin.rows.queryOptions({
      input: { key: key ?? "", table: table ?? "", limit, offset },
    }),
    enabled: !!key && !!table,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useRunSql() {
  return useMutation(orpc.admin.query.mutationOptions());
}
