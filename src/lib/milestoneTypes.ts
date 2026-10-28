import { Footprints, MessageCircle, Smile, type LucideIcon } from 'lucide-react'

/**
 * 발달 기록 유형 (F-06): 단어·행동·표정. 놀이는 행동에 포함한다 (R42).
 * 입력 화면, 타임라인, 홈이 함께 쓴다. 값은 DB milestones.type과 같다 (T-18).
 */
export type MilestoneType = 'word' | 'behavior' | 'expression'

export interface MilestoneTypeInfo {
  value: MilestoneType
  label: string
  icon: LucideIcon
  /** 내용 칸 안내 */
  placeholder: string
  /** 기본 예시 (기능요구사항서 부록 A). 단어는 예시 없이 직접 입력한다 (R11) */
  examples: readonly string[]
}

export const MILESTONE_TYPES: readonly MilestoneTypeInfo[] = [
  { value: 'word', label: '단어', icon: MessageCircle, placeholder: '예: 맘마', examples: [] },
  {
    value: 'behavior',
    label: '행동',
    icon: Footprints,
    placeholder: '예: 잡고 서기',
    examples: [
      '고개 가누기',
      '뒤집기',
      '되집기',
      '배밀이',
      '혼자 앉기',
      '기기',
      '잡고 서기',
      '혼자 서기',
      '첫걸음',
      '박수 치기',
      '손 흔들기',
      '손가락으로 가리키기',
      // 놀이에서 옮긴 예시 (R42)
      '까꿍놀이',
      '블록 쌓기',
      '공놀이',
    ],
  },
  {
    value: 'expression',
    label: '표정',
    icon: Smile,
    placeholder: '예: 소리 내어 웃기',
    examples: ['눈 맞추며 웃기', '소리 내어 웃기', '찡그리기', '놀란 표정', '삐죽거리기', '낯가림'],
  },
]

export const MILESTONE_TYPE_VALUES = MILESTONE_TYPES.map((type) => type.value) as [
  MilestoneType,
  ...MilestoneType[],
]

export function isMilestoneType(value: string | null | undefined): value is MilestoneType {
  return MILESTONE_TYPES.some((type) => type.value === value)
}

export function milestoneTypeInfo(value: MilestoneType): MilestoneTypeInfo {
  const info = MILESTONE_TYPES.find((type) => type.value === value)
  if (!info) throw new RangeError(`알 수 없는 발달 기록 유형입니다: ${value}`)
  return info
}
