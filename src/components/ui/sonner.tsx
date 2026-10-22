import { CircleCheckIcon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useResolvedTheme } from '@/lib/theme'

// 저장 알림: 화면 아래 가운데, 알약 모양, 2초 (docs/디자인.md 6장)
const Toaster = (props: ToasterProps) => {
  const theme = useResolvedTheme()

  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      duration={2000}
      offset={96}
      mobileOffset={96}
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-fit max-w-[calc(100vw-40px)] items-center gap-2 rounded-full bg-toast px-5 py-3 text-[15px] font-medium text-toast-text shadow-lg mx-auto',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
