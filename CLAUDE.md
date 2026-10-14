# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Baby Growth Tracker is a personal web app for recording a child's growth (height/weight, milestones, sleep) and meals (food list, weekly meal plan, recipes). The project is in the design phase: no source code exists yet.

Workflow: PRD → 기능요구사항서 → 기술요구사항서 → task breakdown → implementation (MVP-1 growth records, then MVP-2 meal records) → testing.

## Documents

- `PRD.md` (v1.0, confirmed) is the source of truth for scope, features (F-01–F-24), data model, and decisions. Read section 9 (결정 사항) before proposing behavior; do not reopen decided items without the user.
- Design documents go under `docs/` (기능요구사항서, 기술요구사항서). When they conflict with `PRD.md`, flag it instead of picking one silently.
- Uncertain items are marked as "확인 필요" rather than assumed.

## Tech stack

- Backend: Supabase Free plan (PostgreSQL, Auth, Storage). Access control via RLS on `ownerId`.
- Frontend framework and web hosting: not decided yet. Confirm with the user before scaffolding.

## Commands

None yet. Add build, lint, test, and single-test commands once the frontend stack is chosen.

## Architecture

None yet. Once code exists, document the big-picture structure here (data model, main modules, how data flows between them).

## Conventions

- Default response and documentation language is Korean.
- Never hardcode secrets. Supabase keys and the allowed login email live in environment variables. Only the anon key may be used in the browser; the service role key must never reach frontend code.
- Child data (including allergy information and photos) is sensitive: do not log it, and use pseudonymous data in tests and examples.
