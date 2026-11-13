import { fitPhotoSize, PHOTO_MAX_BYTES, PhotoError } from './photoTypes'
type PhotoFormat = 'jpeg' | 'png' | 'heic'

/** MIME·확장자를 믿지 않고 파일 헤더로 검사한다. 파일 이름은 업로드 경로에 쓰지 않는다. */
export async function recipePhotoFormat(file: File): Promise<PhotoFormat> {
  if (file.size === 0 || file.size > PHOTO_MAX_BYTES) throw new PhotoError('size')
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value))
    return 'png'
  const header = new TextDecoder().decode(bytes)
  if (
    header.slice(4, 8) === 'ftyp' &&
    !/avif|avis/.test(header) &&
    /heic|heix|hevc|hevx|mif1|msf1/.test(header.slice(8))
  )
    return 'heic'
  throw new PhotoError('format')
}
interface DecodedPhoto {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}
async function decodeRaster(blob: Blob): Promise<DecodedPhoto> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new PhotoError('decode'))
      image.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch {
    URL.revokeObjectURL(url)
    throw new PhotoError('decode')
  }
}
async function decodeHeic(file: File): Promise<DecodedPhoto> {
  try {
    // 변환기는 별도 청크·내부 Worker로 실행한다. 사진을 외부 변환 서버에 보내지 않는다.
    const { heicTo } = await import('heic-to/csp')
    const bitmap = await heicTo({ blob: file, type: 'bitmap' })
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    }
  } catch {
    throw new PhotoError('decode')
  }
}

/** 방향을 반영해 그린 뒤 긴 변 1,280px 이하·JPEG로 저장한다. PNG 투명 부분은 흰색으로 채운다. */
export async function prepareRecipePhoto(file: File): Promise<Blob> {
  const format = await recipePhotoFormat(file)
  const image = format === 'heic' ? await decodeHeic(file) : await decodeRaster(file)
  const canvas = document.createElement('canvas')
  try {
    const size = fitPhotoSize(image.width, image.height)
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new PhotoError('encode')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size.width, size.height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(image.source, 0, 0, size.width, size.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.type !== 'image/jpeg') reject(new PhotoError('encode'))
          else resolve(blob)
        },
        'image/jpeg',
        0.82,
      ),
    )
  } finally {
    image.release()
    canvas.width = 1
    canvas.height = 1
  }
}
