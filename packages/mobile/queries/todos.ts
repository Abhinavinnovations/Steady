import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

/** Temporary to-dos (the casual list under the consistent tasks) + categories. */

export function useTodos() {
  return useQuery(
    orpc.todos.list.queryOptions({ retry: false, refetchInterval: 60_000 }),
  );
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation(
    orpc.todos.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.todos.key() }),
    }),
  );
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation(
    orpc.todos.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.todos.key() }),
    }),
  );
}

export function useToggleTodo() {
  const qc = useQueryClient();
  return useMutation(
    orpc.todos.toggle.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.todos.key() }),
    }),
  );
}

export function useRemoveTodo() {
  const qc = useQueryClient();
  return useMutation(
    orpc.todos.remove.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.todos.key() }),
    }),
  );
}

export function useCategories() {
  return useQuery(orpc.categories.list.queryOptions({ retry: false }));
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation(
    orpc.categories.create.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: orpc.categories.key() }),
    }),
  );
}

export function useRemoveCategory() {
  const qc = useQueryClient();
  return useMutation(
    orpc.categories.remove.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.categories.key() });
        // tasks/todos keep existing but lose the label — refresh both lists
        qc.invalidateQueries({ queryKey: orpc.todos.key() });
        qc.invalidateQueries({ queryKey: orpc.today.key() });
        qc.invalidateQueries({ queryKey: orpc.tasks.key() });
      },
    }),
  );
}

/** Edit a consistent task's settings (schedule/category/duration — never title). */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation(
    orpc.tasks.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.tasks.key() });
        qc.invalidateQueries({ queryKey: orpc.today.key() });
      },
    }),
  );
}
