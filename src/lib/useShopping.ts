import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteShoppingItem,
  fetchShoppingItem,
  fetchShoppingItems,
  saveShoppingItem,
  setShoppingStatus,
  type ShoppingInput,
} from './shoppingApi'
export const SHOPPING_QUERY_KEY = ['shopping'] as const
export function useShoppingItems() {
  return useQuery({ queryKey: [...SHOPPING_QUERY_KEY, 'list'], queryFn: fetchShoppingItems })
}
export function useShoppingItem(id?: string) {
  return useQuery({
    queryKey: [...SHOPPING_QUERY_KEY, 'item', id],
    queryFn: () => fetchShoppingItem(id!),
    enabled: !!id,
  })
}
export function useSaveShopping() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      input,
      id,
      savedOnly,
    }: {
      input: ShoppingInput
      id?: string
      savedOnly?: boolean
    }) => saveShoppingItem(input, id, savedOnly),
    onSuccess: () => client.invalidateQueries({ queryKey: SHOPPING_QUERY_KEY }),
  })
}
export function useSetShoppingStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'purchased' }) =>
      setShoppingStatus(id, status),
    onSuccess: () => client.invalidateQueries({ queryKey: SHOPPING_QUERY_KEY }),
  })
}
export function useDeleteShopping() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteShoppingItem(id),
    onSuccess: (_, id) =>
      client.invalidateQueries({
        queryKey: SHOPPING_QUERY_KEY,
        predicate: (query) => query.queryKey[2] !== id,
      }),
  })
}
