import { useEffect, useRef, useState, type BaseSyntheticEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { ArrowDown, ArrowUp, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FormActions, FormPage } from '@/components/FormPage'
import { FieldError } from '@/components/form/Field'
import { TextField } from '@/components/form/TextField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { notifySaved } from '@/lib/notify'
import { PHOTO_MESSAGES, PhotoError } from '@/lib/photoTypes'
import { RecipeSaveError, type Recipe } from '@/lib/recipeApi'
import {
  discardRecipeDraft,
  removeRecipeWithPhoto,
  saveRecipeDraft,
  type RecipeEditSession,
} from '@/lib/recipeEditorApi'
import { useFoods } from '@/lib/useFoods'
import { useInvalidateRecipes } from '@/lib/useRecipes'
import { RecipePhoto } from './RecipePhoto'
import { recipeSchema, type RecipeFormOutput, type RecipeFormValues } from './recipeSchema'

export function RecipeForm({
  initial,
  onDone,
  onDeleted,
}: {
  initial?: Recipe
  onDone: () => void
  onDeleted: () => void
}) {
  const [session] = useState<RecipeEditSession>(() => ({
    id: initial?.id ?? crypto.randomUUID(),
    createNew: !initial,
    oldPhotoId: initial?.photoId ?? null,
    uploaded: null,
    uploadCleanup: null,
    committed: false,
  }))
  const [file, setFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [failed, setFailed] = useState<{
    action: 'save' | 'delete' | 'cancel'
    message: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const foods = useFoods()
  const invalidate = useInvalidateRecipes()
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RecipeFormValues, unknown, RecipeFormOutput>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: initial?.name ?? '',
      servings: initial?.servings ?? '',
      note: initial?.note ?? '',
      ingredients: initial?.ingredients.length
        ? initial.ingredients.map((i) => ({ ...i, amount: i.amount ?? '' }))
        : [{ foodId: null, name: '', amount: '' }],
      steps: initial?.steps.map((text) => ({ text })) ?? [{ text: '' }],
    },
  })
  const ingredients = useFieldArray({ control, name: 'ingredients' })
  const steps = useFieldArray({ control, name: 'steps' })
  const values = useWatch({ control, name: 'ingredients' })
  const locked = busy || session.committed || deleting
  const run = async (action: 'save' | 'delete' | 'cancel', fn: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setFailed(null)
    try {
      await fn()
    } catch (error) {
      const message = session.committed
        ? '레시피는 저장됐지만 이전 사진을 정리하지 못했어요. 다시 시도해 주세요'
        : error instanceof PhotoError
          ? PHOTO_MESSAGES[error.reason]
          : error instanceof RecipeSaveError && error.reason === 'validation'
            ? '입력값이나 선택한 재료·사진이 바뀌었어요. 내용을 확인하고 다시 저장해 주세요'
            : error instanceof RecipeSaveError && error.reason === 'notFound'
              ? '레시피가 삭제되어 저장할 수 없어요'
              : action === 'delete'
                ? '삭제를 마치지 못했어요. 다시 시도해 주세요'
                : action === 'cancel'
                  ? '사진 정리를 마치지 못했어요. 다시 시도해 주세요'
                  : '저장하지 못했어요. 입력값은 유지되니 다시 시도해 주세요'
      setFailed({ action, message })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const submit = (event?: BaseSyntheticEvent) =>
    handleSubmit((output) =>
      run('save', async () => {
        await saveRecipeDraft(
          session,
          { ...output, steps: output.steps.map((s) => s.text) },
          file,
          removePhoto,
        )
        await invalidate()
        notifySaved()
        onDone()
      }),
    )(event)
  const cancel = () =>
    run('cancel', async () => {
      await discardRecipeDraft(session)
      await invalidate()
      onDone()
    })
  const remove = () =>
    run('delete', async () => {
      setDeleting(true)
      await discardRecipeDraft(session)
      await removeRecipeWithPhoto(session.id)
      await invalidate()
      onDeleted()
    })
  const retry = () =>
    failed?.action === 'delete' ? remove() : failed?.action === 'cancel' ? cancel() : submit()
  return (
    <FormPage
      title={initial ? '레시피 수정' : '레시피 등록'}
      onBack={() => {
        if (!busyRef.current) void cancel()
      }}
    >
      <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-5">
        {failed && (
          <ErrorBanner message={failed.message} onRetry={() => void retry()} retrying={busy} />
        )}
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5">
          <TextField control={control} name="name" label="레시피 이름" maxLength={30} />
          <TextField
            control={control}
            name="servings"
            label="완성량 (선택)"
            placeholder="예: 2회분"
            maxLength={20}
          />
          <section
            aria-labelledby="recipe-ingredients-label"
            className="flex min-w-0 flex-col gap-3"
          >
            <h2 id="recipe-ingredients-label" className="font-bold">
              재료
            </h2>
            <p className="text-sm text-muted-foreground">
              음식을 검색해 고르거나 직접 입력해 주세요. 직접 입력한 재료는 음식 목록에 추가되지
              않아요.
            </p>
            {foods.isError && (
              <ErrorBanner
                message="음식 목록을 불러오지 못했어요. 직접 입력하거나 다시 시도해 주세요"
                onRetry={() => void foods.refetch()}
              />
            )}
            {ingredients.fields.map((row, index) => {
              const selected = foods.data?.find((f) => f.id === values[index]?.foodId)
              const query = values[index]?.name.trim() ?? ''
              const options =
                !values[index]?.foodId && query
                  ? foods.data?.filter((f) => f.name.includes(query)).slice(0, 8)
                  : []
              return (
                <div
                  key={row.id}
                  className="flex min-w-0 flex-col gap-3 rounded-input border bg-surface p-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">재료 {index + 1}</h3>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`재료 ${index + 1} 삭제`}
                      disabled={ingredients.fields.length === 1}
                      onClick={() => ingredients.remove(index)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <label className="flex flex-col gap-1.5 text-sm font-bold">
                    재료 {index + 1} 이름
                    <Input
                      {...register(`ingredients.${index}.name`)}
                      maxLength={20}
                      autoComplete="off"
                      aria-invalid={!!errors.ingredients?.[index]?.name}
                      onChange={(e) => {
                        setValue(`ingredients.${index}.name`, e.target.value, { shouldDirty: true })
                        setValue(`ingredients.${index}.foodId`, null, { shouldDirty: true })
                      }}
                    />
                  </label>
                  {errors.ingredients?.[index]?.name && (
                    <FieldError>{errors.ingredients[index].name.message}</FieldError>
                  )}
                  {values[index]?.foodId && (
                    <p className="text-xs text-muted-foreground">
                      음식 목록에서 선택됨
                      {selected && (selected.status === 'caution' || selected.cautionTag) && (
                        <Badge variant="caution" className="ml-2">
                          <TriangleAlert aria-hidden />
                          주의
                        </Badge>
                      )}
                    </p>
                  )}
                  {!!options?.length && (
                    <ul
                      aria-label={`재료 ${index + 1} 검색 결과`}
                      className="max-h-48 overflow-auto rounded-input border"
                    >
                      {options.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left hover:bg-soft"
                            onClick={() => {
                              setValue(`ingredients.${index}.foodId`, f.id, { shouldDirty: true })
                              setValue(`ingredients.${index}.name`, f.name, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }}
                          >
                            {f.name}
                            {(f.status === 'caution' || f.cautionTag) && (
                              <Badge variant="caution">
                                <TriangleAlert aria-hidden />
                                주의
                              </Badge>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <TextField
                    control={control}
                    name={`ingredients.${index}.amount`}
                    label={`재료 ${index + 1} 양 (선택)`}
                    placeholder="예: 30g"
                    maxLength={20}
                  />
                </div>
              )
            })}
            <Button
              type="button"
              variant="outline"
              onClick={() => ingredients.append({ foodId: null, name: '', amount: '' })}
            >
              <Plus aria-hidden />
              재료 추가
            </Button>
          </section>
          <section aria-labelledby="recipe-steps-label" className="flex min-w-0 flex-col gap-3">
            <h2 id="recipe-steps-label" className="font-bold">
              조리 순서
            </h2>
            {steps.fields.map((row, index) => (
              <div
                key={row.id}
                className="flex min-w-0 flex-col gap-2 rounded-input border bg-surface p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <label htmlFor={`recipe-step-${row.id}`} className="text-sm font-bold">
                    조리 순서 {index + 1}
                  </label>
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`단계 ${index + 1} 위로`}
                      disabled={index === 0}
                      onClick={() => steps.move(index, index - 1)}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`단계 ${index + 1} 아래로`}
                      disabled={index === steps.fields.length - 1}
                      onClick={() => steps.move(index, index + 1)}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`단계 ${index + 1} 삭제`}
                      disabled={steps.fields.length === 1}
                      onClick={() => steps.remove(index)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
                <Textarea
                  id={`recipe-step-${row.id}`}
                  {...register(`steps.${index}.text`)}
                  aria-invalid={!!errors.steps?.[index]?.text}
                />
                {errors.steps?.[index]?.text && (
                  <FieldError>{errors.steps[index].text.message}</FieldError>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => steps.append({ text: '' })}>
              <Plus aria-hidden />
              단계 추가
            </Button>
          </section>
          <TextField control={control} name="note" label="참고 (선택)" maxLength={500} multiline />
        </fieldset>
        <fieldset
          disabled={locked || !!session.uploaded || !!session.uploadCleanup}
          className="flex min-w-0 flex-col gap-3"
        >
          <label htmlFor="recipe-photo" className="text-sm font-bold">
            사진 (선택, 1장)
          </label>
          <p className="text-sm text-muted-foreground">JPG·PNG·HEIC, 20MB 이하</p>
          <Input
            id="recipe-photo"
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setRemovePhoto(false)
            }}
            className="h-auto min-h-12 py-2 file:mr-2 file:text-sm"
          />
          {file ? (
            <SelectedPhoto file={file} />
          ) : !removePhoto && initial?.photoId ? (
            <RecipePhoto id={initial.photoId} name={initial.name} />
          ) : null}
          {(file || (!removePhoto && initial?.photoId)) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFile(null)
                setRemovePhoto(true)
                const input = document.getElementById('recipe-photo') as HTMLInputElement | null
                if (input) input.value = ''
              }}
            >
              사진 삭제
            </Button>
          )}
        </fieldset>
        <FormActions>
          <Button
            type="button"
            variant="soft"
            size="lg"
            disabled={busy}
            onClick={() => void cancel()}
          >
            취소
          </Button>
          <Button type="submit" size="lg" disabled={busy || deleting}>
            {busy ? '처리하는 중…' : session.committed ? '사진 정리 다시 시도' : '저장'}
          </Button>
        </FormActions>
        {initial && (
          <DeleteRecordButton
            onConfirm={() => void remove()}
            pending={busy || session.committed}
            title="레시피를 삭제할까요?"
            description="식단에 적힌 레시피 이름은 그대로 남아요. 사진도 함께 삭제돼요."
          />
        )}
      </form>
    </FormPage>
  )
}
function SelectedPhoto({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const next = URL.createObjectURL(file)
    if (image.current) image.current.src = next
    return () => URL.revokeObjectURL(next)
  }, [file])
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {!/\.hei[cf]$/i.test(file.name) && (
        <img
          ref={image}
          alt="선택한 사진 미리보기"
          className="max-h-72 w-full rounded-input object-contain"
        />
      )}
      <p className="text-sm break-all text-muted-foreground">선택한 사진: {file.name}</p>
    </div>
  )
}
