export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export async function getCroppedImageFile(
  imageSrc: string,
  cropArea: CropArea,
  fileName: string,
  rotation = 0
): Promise<File> {
  const image = await loadImage(imageSrc)

  // 회전된 이미지를 담을 충분히 큰 캔버스 (회전 시 이미지가 캔버스 밖으로 안 나가게)
  const rotRad = (rotation * Math.PI) / 180
  const { width: bBoxWidth, height: bBoxHeight } = getRotatedSize(image.width, image.height, rotation)

  const rotatedCanvas = document.createElement('canvas')
  rotatedCanvas.width = bBoxWidth
  rotatedCanvas.height = bBoxHeight
  const rotatedCtx = rotatedCanvas.getContext('2d')!

  rotatedCtx.translate(bBoxWidth / 2, bBoxHeight / 2)
  rotatedCtx.rotate(rotRad)
  rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2)

  // 회전된 이미지에서 크롭 영역만 잘라내기
  const canvas = document.createElement('canvas')
  canvas.width = cropArea.width
  canvas.height = cropArea.height
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(
    rotatedCanvas,
    cropArea.x, cropArea.y, cropArea.width, cropArea.height,
    0, 0, cropArea.width, cropArea.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('크롭 실패'))
      resolve(new File([blob], fileName, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  })
}

function getRotatedSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}