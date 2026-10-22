import { Navigate, type RouteObject } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { RedirectIfSignedIn, RequireAuth } from '@/features/auth/RouteGuards'
import { BodyPage } from '@/features/body/BodyPage'
import { FoodsPage } from '@/features/food/FoodsPage'
import { GrowthLayout } from '@/features/growth/GrowthLayout'
import { HomePage } from '@/features/home/HomePage'
import { MealsLayout } from '@/features/meal/MealsLayout'
import { MealWeekPage } from '@/features/meal/MealWeekPage'
import { WordsPage } from '@/features/milestone/WordsPage'
import { RecipesPage } from '@/features/recipe/RecipesPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { SleepPage } from '@/features/sleep/SleepPage'
import { TimelinePage } from '@/features/timeline/TimelinePage'
import { AppLayout } from './AppLayout'
import { RouteError } from './RouteError'

/**
 * 화면 주소 (기능요구사항서 2.1)
 * /login                     로그인 (SCR-01)
 * /                          홈 (SCR-03)
 * /growth/body|words|sleep   성장 (SCR-04, 06, 08)
 * /timeline                  타임라인 (SCR-07)
 * /meals/week|foods|recipes  식사 (SCR-10~12)
 * /settings                  설정 (SCR-09)
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <RedirectIfSignedIn />,
        children: [{ path: '/login', element: <LoginPage /> }],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomePage /> },
              {
                path: 'growth',
                element: <GrowthLayout />,
                children: [
                  { index: true, element: <Navigate to="body" replace /> },
                  { path: 'body', element: <BodyPage /> },
                  { path: 'words', element: <WordsPage /> },
                  { path: 'sleep', element: <SleepPage /> },
                ],
              },
              { path: 'timeline', element: <TimelinePage /> },
              {
                path: 'meals',
                element: <MealsLayout />,
                children: [
                  { index: true, element: <Navigate to="week" replace /> },
                  { path: 'week', element: <MealWeekPage /> },
                  { path: 'foods', element: <FoodsPage /> },
                  { path: 'recipes', element: <RecipesPage /> },
                ],
              },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
      // 공통 컴포넌트 확인 화면: 개발 서버에서만 (운영 빌드에서는 이 줄이 통째로 빠진다)
      ...(import.meta.env.DEV
        ? [
            {
              path: '/dev/ui',
              lazy: async () => ({ Component: (await import('./dev/UiPreview')).default }),
            },
          ]
        : []),
      { path: '*', element: <RouteError notFound /> },
    ],
  },
]
