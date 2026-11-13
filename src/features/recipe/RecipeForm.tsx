import { useEffect, useRef, useState, type BaseSyntheticEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FormActions, FormPage } from '@/components/FormPage'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { RecipeIngredientsField, RecipeStepsField } from './RecipeTextFields'
import { ingredientKey, ingredientsToText, initialIngredientLinks, stepsToText } from './recipeText'
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
  const [ingredientLinks, setIngredientLinks] = useState(() =>
    initialIngredientLinks(initial?.ingredients ?? []),
  )
  const { control, handleSubmit } = useForm<RecipeFormValues, unknown, RecipeFormOutput>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: initial?.name ?? '',
      servings: initial?.servings ?? '',
      note: initial?.note ?? '',
      ingredientsText: ingredientsToText(initial?.ingredients ?? []),
      stepsText: stepsToText(initial?.steps ?? []),
    },
  })
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
          {
            name: output.name,
            servings: output.servings,
            note: output.note,
            steps: output.stepsText,
            ingredients: output.ingredientsText.map((item, index) => ({
              ...item,
              foodId: ingredientLinks[ingredientKey(output.ingredientsText, index)] ?? null,
            })),
          },
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
          {foods.isError && (
            <ErrorBanner
              message="음식 목록을 불러오지 못했어요. 입력은 계속할 수 있으며 기존 음식 연결은 유지돼요."
              onRetry={() => void foods.refetch()}
            />
          )}
          <RecipeIngredientsField
            control={control}
            foods={foods.data ?? []}
            links={ingredientLinks}
            onLink={(key, id) => setIngredientLinks((links) => ({ ...links, [key]: id }))}
          />
          <RecipeStepsField control={control} />
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
