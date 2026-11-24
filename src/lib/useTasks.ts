import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteTask,
  fetchTask,
  fetchTasks,
  saveTask,
  setTaskCompleted,
  type TaskInput,
} from './taskApi'
export const TASK_QUERY_KEY = ['preparation-tasks'] as const
export function useTasks() {
  return useQuery({ queryKey: [...TASK_QUERY_KEY, 'list'], queryFn: fetchTasks })
}
export function useTask(id?: string) {
  return useQuery({
    queryKey: [...TASK_QUERY_KEY, 'item', id],
    queryFn: () => fetchTask(id!),
    enabled: !!id,
  })
}
export function useSaveTask() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ input, id }: { input: TaskInput; id?: string }) => saveTask(input, id),
    onSuccess: () => client.invalidateQueries({ queryKey: TASK_QUERY_KEY }),
  })
}
export function useSetTaskCompleted() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      setTaskCompleted(id, completed),
    onSuccess: () => client.invalidateQueries({ queryKey: TASK_QUERY_KEY }),
  })
}
export function useDeleteTask() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: (_, id) =>
      client.invalidateQueries({
        queryKey: TASK_QUERY_KEY,
        predicate: (query) => query.queryKey[2] !== id,
      }),
  })
}
