# RupeeLog — Product Requirements (Living Doc)

## Original Problem Statement
Mobile expense tracker "RupeeLog" (React Native + Expo, Android + iOS). Phase 1 = 3 screens built to an exact design system (dark navy #0D0F14, Inter font, indigo #4F46E5). Local data only via expo-sqlite. No backend, no auth, no payments. Seed 5 expenses on first install. Test via Expo Go QR.

## Architecture
- **Frontend:** Expo Router (file-based), React Native 0.81 / Expo SDK 54.
- **Data:** Local only. Native = `expo-sqlite`; Web preview = localStorage fallback (real persistence, seeded identically) since expo-sqlite has no web worker in preview. See `src/db.ts`.
- **Fonts:** Inter (400/500/600/700) loaded via `expo-font` from `assets/fonts` (no @expo-google-fonts pkg).
- **Backend:** FastAPI/Mongo template present but UNUSED in Phase 1.

## Core (static) Requirements
- 4-point spacing grid, exact color/radius/typography tokens, Ionicons (no emoji), per-category icon bg/color pairs.
- Reanimated animations: staggered bar grow, bottom-sheet open, screen fade, save checkmark; Haptics throughout.

## Phase 2A — Expenses List (2026-06-18)
- **Expenses screen** (`app/(tabs)/expenses.tsx`, wired to Expenses tab): title + dynamic count, real-time search (title/note), single-select category filter chips, independent single-select payment filter chips (incl. BNPL/Cheque), sort modal (Newest/Oldest/Highest/Lowest), FlatList grouped by date headers (Today/Yesterday/"Mon, 16 Jun"), rows with colored category icon + amount + relative time, FAB, empty state.
- **Swipe actions** via `ReanimatedSwipeable`: left→delete (red, undo toast 4s + deferred DB delete), right→edit (opens Add sheet pre-filled).
- **db.ts**: added `updateExpense`, `deleteExpense` (web + native).
- **add-expense.tsx**: edit-mode via route params (`id` ⇒ UPDATE, button "Update Expense").
- Verified on web: search/filters/sort/add all PASS. Swipe gestures (delete/undo, edit) require native (Expo Go) verification — cannot be simulated by web automation.

## Implemented (2026-06-18) (`app/onboarding.tsx`): 3 swipeable slides, name input, currency modal (INR/USD/EUR/GBP/AED), progress dots, persists name+currency+`onboarding_complete` to storage, navigates to Home; never re-shows.
- **Home Dashboard** (`app/(tabs)/index.tsx`): greeting w/ stored name, hero card (This Month total/income/expenses/net, Indian number format), animated 6-month bar chart (current month teal), recent expenses list w/ colored category icons + relative time, FAB, custom 4-tab bottom bar.
- **Add Expense** (`app/add-expense.tsx`): transparentModal bottom sheet w/ drag handle + swipe-to-dismiss, amount display, 4x4 calculator (expression eval), merchant input, horizontal category chips, payment-method wrap chips, date/time native pickers, note, Save (disabled until amount>0) w/ success checkmark; refreshes Home.
- **Tabs**: Expenses/Groups/Insights = "Coming soon" placeholders.
- DB seeds 5 expenses (Zomato/Petrol/Netflix/Metro/DMart).
- Testing agent: all 6 Phase-1 scenarios PASS.

## Backlog (future phases)
- **P1:** Expenses screen (full list, search, filter by category/date). Insights screen (category breakdown, trends).
- **P1:** Edit / delete an expense; swipe actions on rows.
- **P2:** Groups (split shared expenses). SMS auto-detect (native build required). Budgets & monthly limits. Export CSV. Income entry UI.

## Next Tasks
1. Build Expenses screen (full history + filters).
2. Build Insights screen (charts/breakdowns).
3. Add edit/delete for expenses.
