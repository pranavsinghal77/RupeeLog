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

## Phase 3A.1 — Grocery category + Daily reminder (2026-06-22)
- Added **Grocery** category (basket-outline, icon #86EFAC / bg #1A3A2A) in `src/categories.ts` between Food and Transport — auto-propagates to Add Expense, Add Template, Expenses filters, Insights. Seed "DMart groceries" recategorized Shopping→Grocery.
- Installed expo-notifications. New `src/notifications.ts`: local DAILY reminder at 21:30 (id rupeelog_daily_reminder, "Don't break your streak! 🔥"). Scheduled on onboarding finish (permission requested after slide 3) and when Settings Notifications toggled ON; cancelled when OFF. If permission denied → Settings toggle shows OFF + greyed. Local-only (no push token/backend). Web = no-op (toggle stays interactive in preview).

## Phase 3A — Home upgrades + Settings (2026-06-22)
- **Home (additive only)**: logging streak below greeting (`src/streak.ts`, shown when streak≥2, amber→red at ≥7, "Best: N days"); quick-add Templates row (`src/templates.ts`, chips one-tap log + green toast, long-press delete, free limit 5, dashed Add chip → `add-template.tsx` sheet with calculator; 6th save → ProModal); settings gear → Settings.
- **Settings** (`app/settings.tsx`, push route): Profile (Name inline-edit → updates Home greeting; Currency picker), Security (App Lock switch — UI only), Preferences (Notifications + SMS switches), Data (Export CSV via Share + toast; Clear all data → confirm → `resetAllData()` → onboarding), About (Version 1.0.0, Privacy modal, Rate via expo-store-review).
- **db.ts**: added `resetAllData` (drops/recreates tables native, clears localStorage web, wipes settings keys). add-expense calls `updateStreak()` after a new save. Reusable `src/components/ProModal.tsx`.
- Installed expo-store-review. Storage keys: rupeelog_streak_data, rupeelog_templates, rupeelog_app_lock, rupeelog_notifications, rupeelog_sms_enabled (name/currency reuse existing keys so they reflect on Home).
- Testing agent: 6/7 PASS; fixed CRITICAL web-only bug (Alert.alert multi-button no-op → Platform-branch to window.confirm) — Clear-data now navigates to onboarding. Removed dead ICON code.

## Phase 2B — Groups + Insights (2026-06-18)
- **Groups tab** = nested Stack (`groups/_layout.tsx`, `index.tsx`, `[id].tsx`): GroupsList (empty state, create-group bottom sheet with 6 colour dots, cards with net/count/date-range, FREE LIMIT gate → Upgrade-to-Pro modal at ≥3 groups). GroupDetail (total header, add-expense action sheet → New expense / Add-from-existing sheet, read-only list, native Share).
- **Insights tab** (`insights.tsx`): month navigator (no future), SPENT/INCOME/SAVED cards, react-native-svg donut (center top category) + category list with %, animated payment-method bars, daily-spending sparkline (area+peak+axis), smart-insight card (4-rule priority).
- **db.ts**: groups + expense_groups tables; createGroup/getGroups/getGroupById/getGroupExpenses/addExpenseToGroup/getExpensesNotInAnyGroup/deleteGroup; `addExpense` now returns new id. Web localStorage keys rupeelog_groups + rupeelog_expense_groups.
- **add-expense.tsx**: optional `group_id` param links a newly-created expense to a group.
- Installed react-native-svg. Testing agent: all 7 Phase 2B features PASS + Phase 1/2A regression clean.

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
