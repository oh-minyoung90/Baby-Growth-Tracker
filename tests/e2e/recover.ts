import { lock, login, restore } from './data.ts'

const unlock = await lock()
try {
  const data = await login()
  try {
    await restore(data)
    process.stdout.write('테스트 계정의 기존 기록·사진 복구를 확인했습니다.\n')
  } finally {
    await data.client.auth.signOut({ scope: 'local' })
  }
} finally {
  await unlock()
}
