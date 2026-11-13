import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { heicTo } from 'heic-to/csp'
import { fitPhotoSize, PHOTO_MAX_BYTES } from './photoTypes'
import { prepareRecipePhoto, recipePhotoFormat } from './prepareRecipePhoto'
vi.mock('heic-to/csp', () => ({ heicTo: vi.fn() }))
// jsdom의 Blob에는 arrayBuffer가 없어 파일 조각의 읽기만 FileReader로 대체한다.
const file = (bytes: number[], name = '사진.jpg', type = '') => {
  const value = new File([new Uint8Array(bytes)], name, { type })
  const slice = value.slice.bind(value)
  value.slice = (...args) => {
    const blob = slice(...args)
    blob.arrayBuffer = () =>
      new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = reject
        reader.readAsArrayBuffer(blob)
      })
    return blob
  }
  return value
}
const jpeg = () => file([255, 216, 255, 0, 0])
const heic = () =>
  file([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0], '사진.heic')
const draw = vi.fn(),
  fill = vi.fn(),
  revoke = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:local-test'), revokeObjectURL: revoke })
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 2560
      naturalHeight = 1280
      onload: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: fill,
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
    callback(new Blob(['jpeg'], { type: 'image/jpeg' })),
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('레시피 사진 처리', () => {
  it('가로·세로 비율을 유지하고 작은 사진은 확대하지 않는다', () => {
    expect(fitPhotoSize(4000, 3000)).toEqual({ width: 1280, height: 960 })
    expect(fitPhotoSize(3000, 4000)).toEqual({ width: 960, height: 1280 })
    expect(fitPhotoSize(100, 50)).toEqual({ width: 100, height: 50 })
    expect(() => fitPhotoSize(0, 100)).toThrow('decode')
  })
  it('확장자·MIME가 달라도 실제 JPG·PNG·HEIC 헤더를 검사한다', async () => {
    expect(await recipePhotoFormat(jpeg())).toBe('jpeg')
    expect(await recipePhotoFormat(file([137, 80, 78, 71, 13, 10, 26, 10], '이름.bin'))).toBe('png')
    expect(await recipePhotoFormat(heic())).toBe('heic')
    await expect(
      recipePhotoFormat(file([60, 115, 118, 103], '거짓.jpg', 'image/jpeg')),
    ).rejects.toMatchObject({ reason: 'format' })
    await expect(
      recipePhotoFormat(file([0, 0, 0, 24, 102, 116, 121, 112, 97, 118, 105, 102], '사진.heic')),
    ).rejects.toMatchObject({ reason: 'format' })
  })
  it('0바이트와 20MB 초과를 거부하고 경계 크기는 허용한다', async () => {
    await expect(recipePhotoFormat(file([]))).rejects.toMatchObject({ reason: 'size' })
    const value = jpeg()
    Object.defineProperty(value, 'size', { value: PHOTO_MAX_BYTES + 1, configurable: true })
    await expect(recipePhotoFormat(value)).rejects.toMatchObject({ reason: 'size' })
    Object.defineProperty(value, 'size', { value: PHOTO_MAX_BYTES })
    expect(await recipePhotoFormat(value)).toBe('jpeg')
  })
  it('축소 JPEG를 만들고 일반 사진에는 HEIC 변환기를 호출하지 않는다', async () => {
    expect((await prepareRecipePhoto(jpeg())).type).toBe('image/jpeg')
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 640)
    expect(fill).toHaveBeenCalledWith(0, 0, 1280, 640)
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:local-test')
    expect(heicTo).not.toHaveBeenCalled()
  })
  it('HEIC는 지연 로딩한 변환기로 읽고 성공·실패 모두 자원을 정리한다', async () => {
    const close = vi.fn()
    vi.mocked(heicTo).mockResolvedValueOnce({
      width: 2000,
      height: 1000,
      close,
    } as unknown as Blob & ImageBitmap)
    await prepareRecipePhoto(heic())
    expect(close).toHaveBeenCalledOnce()
    vi.mocked(heicTo).mockRejectedValueOnce(new Error('corrupt'))
    await expect(prepareRecipePhoto(heic())).rejects.toMatchObject({ reason: 'decode' })
  })
  it('인코딩 실패도 사용자 오류로 돌려주고 임시 URL을 해제한다', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementationOnce((callback) =>
      callback(null),
    )
    await expect(prepareRecipePhoto(jpeg())).rejects.toMatchObject({ reason: 'encode' })
    expect(revoke).toHaveBeenCalledOnce()
  })
})
