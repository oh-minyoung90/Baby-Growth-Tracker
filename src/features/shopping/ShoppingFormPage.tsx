import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChoiceChips } from '@/components/ChoiceChips'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FormActions, FormPage } from '@/components/FormPage'
import { ListLoading } from '@/components/ListLoading'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { ShoppingItem, ShoppingInput } from '@/lib/shoppingApi'
import { SHOPPING_CATEGORIES } from '@/lib/shoppingTypes'
import { useDeleteShopping, useSaveShopping, useShoppingItem } from '@/lib/useShopping'
import { useGoBack } from '@/lib/useGoBack'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { notifySaved, notifyDone } from '@/lib/notify'
import { shoppingSchema, type ShoppingValues } from './shoppingSchema'

export function ShoppingFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const query = useShoppingItem(id)
  const savedOnly = params.get('frequent') === '1'
  const goBack = useGoBack(`/shopping${savedOnly ? '?tab=frequent' : ''}`)
  return (
    <FormPage title={id ? '물건 수정' : '물건 추가'} onBack={goBack}>
      {id && query.isPending ? (
        <ListLoading />
      ) : id && query.isError ? (
        <ErrorBanner message={NETWORK_ERROR_MESSAGES.load} onRetry={() => void query.refetch()} />
      ) : id && !query.data ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          물건을 찾을 수 없어요. 이미 삭제됐을 수 있어요
        </p>
      ) : (
        <ShoppingForm
          key={id ?? 'new'}
          initial={query.data ?? undefined}
          savedOnly={savedOnly || query.data?.status === 'saved'}
          onDone={goBack}
        />
      )}
    </FormPage>
  )
}
function ShoppingForm({
  initial,
  savedOnly,
  onDone,
}: {
  initial?: ShoppingItem
  savedOnly: boolean
  onDone: () => void
}) {
  const save = useSaveShopping(),
    remove = useDeleteShopping()
  const [failed, setFailed] = useState(false)
  const busy = save.isPending || remove.isPending
  const form = useForm<ShoppingValues, unknown, ShoppingInput>({
    resolver: zodResolver(shoppingSchema),
    defaultValues: {
      name: initial?.name ?? '',
      category: initial?.category ?? 'etc',
      url: initial?.url ?? '',
      memo: initial?.memo ?? '',
      frequent: savedOnly || initial?.frequent || false,
    },
  })
  const category = useWatch({ control: form.control, name: 'category' })
  const frequent = useWatch({ control: form.control, name: 'frequent' })
  const submit = async (input: ShoppingInput) => {
    if (busy) return
    setFailed(false)
    try {
      await save.mutateAsync({ input, id: initial?.id, savedOnly })
      notifySaved()
      onDone()
    } catch {
      setFailed(true)
    }
  }
  const deleteItem = async () => {
    if (!initial || busy) return
    setFailed(false)
    try {
      await remove.mutateAsync(initial.id)
      notifyDone('삭제했어요')
      onDone()
    } catch {
      setFailed(true)
    }
  }
  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5" noValidate>
      {failed && <ErrorBanner />}
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
        <TextField
          control={form.control}
          name="name"
          label="물건 이름"
          maxLength={80}
          placeholder="예: 아기 내복"
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold">카테고리</legend>
          <ChoiceChips
            label="카테고리"
            options={[...SHOPPING_CATEGORIES]}
            value={category}
            onChange={(value) => form.setValue('category', value, { shouldDirty: true })}
          />
        </fieldset>
        <TextField
          control={form.control}
          name="url"
          label="구매 링크 (선택)"
          maxLength={2048}
          placeholder="https://"
        />
        <p className="-mt-3 text-[13px] text-muted-foreground">
          구매한 뒤에도 링크를 추가할 수 있어요
        </p>
        <TextField
          control={form.control}
          name="memo"
          label="메모 (선택)"
          maxLength={500}
          multiline
          placeholder="사이즈나 수량 등을 적어 주세요"
        />
        {savedOnly ? (
          <p className="rounded-input bg-soft p-3 text-sm text-soft-text">
            자주 사는 물건에 보관해요. 구매하려면 목록에서 다시 담기를 눌러 주세요.
          </p>
        ) : (
          <label className="flex min-h-11 items-center gap-3 px-2.5 text-sm font-medium">
            <Checkbox
              checked={frequent}
              onCheckedChange={(checked) =>
                form.setValue('frequent', checked === true, { shouldDirty: true })
              }
            />
            자주 사는 물건에 보관
          </label>
        )}
        {initial && (
          <DeleteRecordButton
            onConfirm={() => void deleteItem()}
            pending={busy}
            title="이 물건을 삭제할까요?"
            description="살 물건·구매 완료·자주 사는 물건에서 함께 삭제돼요"
          />
        )}
        <FormActions>
          <Button type="button" variant="soft" onClick={onDone} disabled={busy}>
            취소
          </Button>
          <Button type="submit" disabled={busy}>
            {save.isPending ? '저장하는 중…' : initial ? '저장' : '추가하기'}
          </Button>
        </FormActions>
      </fieldset>
    </form>
  )
}
