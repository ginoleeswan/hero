# Donation Row — Design Spec

**Date:** 2026-04-21  
**Status:** Approved

## Overview

Add a tasteful "Support this project" row to the Account card on the Profile screen, linking to Ko-fi. The app is a copyright-sensitive fan project that cannot be monetised directly, so donations must feel quiet and discoverable — not pushy.

## Placement

Inside the existing Account card in `app/(tabs)/profile.tsx`, inserted as a new row with a divider immediately above the Sign Out row. This keeps it within the settings context rather than interrupting the content experience.

## Row Design

Follows the exact existing `accountRow` pattern:

| Part | Value |
|---|---|
| Icon badge background | Orange (`#fff5ee` tint with orange icon — matches `accountIconBadgeOrange`) |
| Icon | `heart-outline` (Ionicons) — ties into the favourites/fan theme |
| Label | "Support this project" — `Nunito_700Bold`, `COLORS.navy` |
| Right label | "Ko-fi" — `Nunito_400Regular`, `COLORS.grey` — subtle, informative |
| Trailing chevron | `chevron-forward`, muted navy opacity (same as Change Password row) |

## Behaviour

- Tapping opens `https://ko-fi.com/YOUR_KOFI_HANDLE` via `Linking.openURL` (React Native core)
- Opens in the device's default browser — no in-app browser, no SDK
- `KO_FI_URL` defined as a constant at the top of `profile.tsx`

## New Style

One new style entry added to `StyleSheet.create` in `profile.tsx`:

```ts
accountIconBadgeOrange: {
  backgroundColor: '#fff5ee',
},
```

The icon itself renders in `COLORS.orange`.

## What Is Not In Scope

- No analytics on taps
- No "thank you" state or confirmation
- No in-app browser
- No external SDK or package
- No new screen or modal

## Prerequisites

Set up a Ko-fi account at ko-fi.com, then replace `YOUR_KOFI_HANDLE` in the constant with your username.
