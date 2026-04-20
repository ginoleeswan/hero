# Donation Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Support this project" row to the Account card on the Profile screen that opens a Ko-fi donation page in the browser.

**Architecture:** Single file change to `app/(tabs)/profile.tsx` — add a `Linking` import, a `KO_FI_URL` constant, one new JSX row (with divider) above the Sign Out row, and one new style entry. No new components, no SDK, no state.

**Tech Stack:** React Native `Linking` (core), Ionicons, existing `StyleSheet`/`COLORS` patterns.

---

## Prerequisites (not code steps)

Before writing any code, create a Ko-fi account at https://ko-fi.com and note your username (e.g. `ko-fi.com/yourname`). You will substitute it for `YOUR_KOFI_HANDLE` in Task 1.

---

## File Map

| Action | File |
|---|---|
| Modify | `app/(tabs)/profile.tsx` |

No new files. No DB changes. No migrations.

---

### Task 1: Add Linking import and KO_FI_URL constant

**Files:**
- Modify: `app/(tabs)/profile.tsx:1-15` (imports) and top of component file (constant)

- [ ] **Step 1: Add `Linking` to the React Native import**

In `app/(tabs)/profile.tsx`, find the existing RN import block (line 2) and add `Linking`:

```ts
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Dimensions,
  Alert,
  ActionSheetIOS,
  Platform,
  Animated,
  Linking,
} from 'react-native';
```

- [ ] **Step 2: Add the KO_FI_URL constant**

Immediately after the `HERO_LOGO_PATH` constant (around line 41), add:

```ts
const KO_FI_URL = 'https://ko-fi.com/glstudio';
```

Replace `YOUR_KOFI_HANDLE` with your actual Ko-fi username.

- [ ] **Step 3: Verify the app still compiles**

```bash
yarn expo export --platform ios --dev 2>&1 | head -20
```

Expected: no TypeScript or Metro errors. (Or just check the running dev server has no red errors.)

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat(profile): add KO_FI_URL constant and Linking import"
```

---

### Task 2: Add the donation row JSX

**Files:**
- Modify: `app/(tabs)/profile.tsx` — JSX section, Account card (~line 507)

- [ ] **Step 1: Insert divider + donation row above the Sign Out divider**

Locate this block in `app/(tabs)/profile.tsx` (around line 507):

```tsx
            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.accountRow}
              onPress={handleSignOut}
```

Insert the following immediately **before** that `<View style={styles.divider} />`:

```tsx
            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.accountRow}
              onPress={() => Linking.openURL(KO_FI_URL)}
              activeOpacity={0.7}
            >
              <View style={[styles.accountIconBadge, styles.accountIconBadgeOrange]}>
                <Ionicons name="heart-outline" size={16} color={COLORS.orange} />
              </View>
              <Text style={styles.accountLabel}>Support this project</Text>
              <Text style={styles.accountValue}>Ko-fi</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
            </TouchableOpacity>
```

The result is that the card order becomes: Email → (Google/Change Password) → (Member since) → **Support this project** → Sign Out → Delete Account.

- [ ] **Step 2: Add the accountIconBadgeOrange style**

In the `StyleSheet.create` block, after `accountIconBadgeRed`, add:

```ts
  accountIconBadgeOrange: {
    backgroundColor: '#fff5ee',
  },
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat(profile): add Support this project donation row linking to Ko-fi"
```

---

## Manual Testing Checklist

After implementation, verify on a device or simulator:

- [ ] Profile screen renders without crash
- [ ] "Support this project" row appears above Sign Out
- [ ] Row shows heart icon (orange), "Support this project" label, "Ko-fi" value, and chevron
- [ ] Tapping opens the Ko-fi URL in the default browser
- [ ] All other Account rows (email, change password, sign out, delete) are unaffected
