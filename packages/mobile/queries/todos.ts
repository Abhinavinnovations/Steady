import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/api";
const listKey = () => orpc.todos.list.queryOptions().queryKey;

export function useTodos() {
  return useQuery(orpc.todos.list.queryOptions({ retry: false, refetchInterval: 60_000 }));
}
export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation(orpc.todos.create.mutationOptions({onSuccess: () => {
    void qc.invalidateQueries({queryKey:orpc.todos.key()});
    void qc.invalidateQueries({queryKey:orpc.calendar.key()});
  }}));
}
export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation(orpc.todos.update.mutationOptions({
    onMutate: async input => {
      await qc.cancelQueries({queryKey:listKey()});
      const previous = qc.getQueryData(listKey())?.todos.find(t=>t.id===input.id);
      if (input.flagged !== undefined) qc.setQueryData(listKey(), old=>old?{...old,todos:old.todos.map(t=>t.id===input.id?{...t,flagged:input.flagged!}:t)}:old);
      return {previous};
    },
    onError: (_error,input,ctx) => { if(ctx?.previous) qc.setQueryData(listKey(),old=>old?{...old,todos:old.todos.map(t=>t.id===input.id?ctx.previous!:t)}:old); },
    onSettled: () => { void qc.invalidateQueries({queryKey:orpc.todos.key()}); void qc.invalidateQueries({queryKey:orpc.calendar.key()}); },
  }));
}
export function useToggleTodo() {
  const qc = useQueryClient();
  return useMutation(orpc.todos.toggle.mutationOptions({
    scope:{id:"todo-checkoff"},
    onMutate: async input => {
      await qc.cancelQueries({queryKey:listKey()});
      const previous=qc.getQueryData(listKey())?.todos.find(t=>t.id===input.id);
      qc.setQueryData(listKey(),old=>old?{...old,todos:old.todos.map(t=>t.id===input.id&&(!input.occurrenceDate||t.occurrenceDate===input.occurrenceDate)?{...t,completedAt:input.done?new Date():null}:t)}:old);
      return {previous};
    },
    onError: (_error,input,ctx)=>{if(ctx?.previous) qc.setQueryData(listKey(),old=>old?{...old,todos:old.todos.map(t=>t.id===input.id?ctx.previous!:t)}:old);},
    onSettled:()=>{void qc.invalidateQueries({queryKey:orpc.todos.key()});void qc.invalidateQueries({queryKey:orpc.calendar.key()});},
  }));
}
export function useRemoveTodo() {
  const qc=useQueryClient();
  return useMutation(orpc.todos.remove.mutationOptions({onSuccess:()=>{void qc.invalidateQueries({queryKey:orpc.todos.key()});void qc.invalidateQueries({queryKey:orpc.calendar.key()});}}));
}
export function useCategories() { return useQuery(orpc.categories.list.queryOptions({retry:false})); }
export function useCreateCategory() {
  const qc=useQueryClient();
  return useMutation(orpc.categories.create.mutationOptions({onSuccess:()=>qc.invalidateQueries({queryKey:orpc.categories.key()})}));
}
export function useRemoveCategory() {
  const qc=useQueryClient();
  return useMutation(orpc.categories.remove.mutationOptions({onSuccess:()=>{
    for(const key of [orpc.calendar.key(),orpc.categories.key(),orpc.todos.key(),orpc.today.key(),orpc.tasks.key()]) void qc.invalidateQueries({queryKey:key});
  }}));
}
export function useUpdateTask() {
  const qc=useQueryClient();
  const key=orpc.today.get.queryOptions().queryKey;
  return useMutation(orpc.tasks.update.mutationOptions({
    onMutate:async input=>{
      await qc.cancelQueries({queryKey:key});
      const previous=qc.getQueryData(key)?.tasks.find(t=>t.id===input.id);
      if(input.flagged!==undefined) qc.setQueryData(key,old=>old?{...old,tasks:old.tasks.map(t=>t.id===input.id?{...t,flagged:input.flagged!}:t)}:old);
      return {previous};
    },
    onError:(_error,input,ctx)=>{if(ctx?.previous)qc.setQueryData(key,old=>old?{...old,tasks:old.tasks.map(t=>t.id===input.id?ctx.previous!:t)}:old);},
    onSettled:()=>{for(const k of [orpc.calendar.key(),orpc.tasks.key(),orpc.today.key()])void qc.invalidateQueries({queryKey:k});},
  }));
}
