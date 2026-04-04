# Profile Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `app/(tabs)/profile.tsx` with a branded cover banner, avatar overlap, hairline divider, and iOS-style account row badges — purely cosmetic, no data or logic changes.

**Architecture:** Single file edit to `app/(tabs)/profile.tsx`. The cover banner is a `LinearGradient` with an inline `react-native-svg` halftone pattern and logo overlay. Avatar is restructured to overlap the cover edge via negative `marginTop`. Account rows get rounded-square coloured icon badges.

**Tech Stack:** expo-linear-gradient, react-native-svg (already direct dependency at 15.15.3), Ionicons, existing COLORS palette.

---

> **Note on testing:** All changes are purely visual (layout, colours, styling). `CLAUDE.md` explicitly says "Do not test navigation or rendering of full screens." No automated tests are written for this plan — verify each task by running the dev server and inspecting the screen.

---

### Task 1: Add cover banner

**Files:**
- Modify: `app/(tabs)/profile.tsx`

The cover replaces the standalone `pageTitle` text. It uses `LinearGradient` as the container (so it fills the background), an inline `Svg` halftone overlay, and an inline `Svg` logo.

The `HERO_LOGO_PATH` constant holds the SVG path data from `assets/hero-logo.svg` so no asset loader is needed.

- [ ] **Step 1: Add the `HERO_LOGO_PATH` constant and the `Svg` import**

At the top of `app/(tabs)/profile.tsx`, replace:

```tsx
import { LinearGradient } from 'expo-linear-gradient';
```

with:

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Circle, Rect, Path } from 'react-native-svg';
```

Then add this constant directly after the `THUMB_SIZE` line:

```tsx
const HERO_LOGO_PATH =
  'M771.83 359.726C790.233 359.157 809.038 360.561 827.217 363.687C860.194 368.791 880.58 384.832 899.577 411.588C952.323 485.882 910.478 588.451 840.684 635.156C777.716 677.292 684.759 672.267 615.599 648.433C606.232 645.205 596.363 641.14 587.513 636.51C560.951 620.256 539.813 614.985 508.598 616.581C476.925 618.201 457.215 629.785 428.71 641.463C378.199 662.157 312.618 674.016 258.384 663.281C223.369 657.798 188.002 641.874 162.23 617.635C99.3027 558.45 73.5282 462.814 138.958 393.848C166.265 365.064 197.584 361.227 235.229 360.28C291.337 358.869 345.958 367.328 400.078 381.829C413.535 385.43 426.897 389.376 440.151 393.665C470.511 403.519 493.246 412.119 526.372 410.492C544.544 409.599 556.786 403.601 573.782 397.773C584.487 394.125 595.271 390.711 606.126 387.535C659.036 371.973 716.754 361.015 771.83 359.726ZM379.43 580.576C404.316 570.739 422.585 557.516 434.848 532.384C439.037 523.799 439.936 512.178 436.403 503.212C428.365 482.815 393.689 466.137 374.256 457.991C346.125 446.198 312.018 435.868 281.435 435.007C275.287 434.834 268.989 434.216 262.784 434.713C226.343 436.857 209.334 467.83 211.588 501.699C213.173 525.52 224.795 548.661 242.631 564.609C267.287 585.96 306.277 591.723 337.967 589.297C352.112 588.232 366.054 585.299 379.43 580.576ZM669.618 585.812C703.165 593.579 746.514 591.622 776.102 573.056C796.619 559.96 811.158 539.317 816.578 515.588C826.183 473.57 805.637 434.865 760.026 435.926C754.894 436.045 749.642 435.782 744.496 436.282C698.168 440.71 646.68 454.898 608.343 482.267C576.199 505.214 594.861 542.717 619.664 562.508C634.433 574.519 651.324 581.316 669.618 585.812Z';
```

- [ ] **Step 2: Replace the `pageTitle` JSX with the cover banner**

In the `ProfileScreen` return, replace:

```tsx
        {/* Page title */}
        <Text style={styles.pageTitle}>profile</Text>

        {/* Identity card */}
        <View style={styles.identityCard}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <LinearGradient colors={[COLORS.orange, '#c04a10']} style={styles.avatar}>
              <Text style={styles.avatarInitials}>{name.slice(0, 2).toUpperCase()}</Text>
            </LinearGradient>
          </View>

          <Text style={styles.username}>{name}</Text>
          <Text style={styles.email}>{email}</Text>

          {/* Stat pill */}
          <View style={styles.statPill}>
            <Ionicons name="heart" size={14} color={COLORS.orange} />
            <Text style={styles.statPillText}>
              {loading ? '–' : favourites.length} saved heroes
            </Text>
          </View>
        </View>
```

with:

```tsx
        {/* Cover banner */}
        <LinearGradient
          colors={['#293C43', '#3d5a66']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cover}
        >
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <Pattern id="dots" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
                <Circle cx="7" cy="7" r="1.5" fill="rgba(231,115,51,0.22)" />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#dots)" />
          </Svg>
          <Svg style={styles.coverLogo} width={48} height={48} viewBox="0 0 1024 1024">
            <Path fill="#ECECDE" d={HERO_LOGO_PATH} />
          </Svg>
        </LinearGradient>

        {/* Avatar overlap */}
        <View style={styles.avatarZone}>
          <LinearGradient colors={[COLORS.orange, '#c04a10']} style={styles.avatar}>
            <Text style={styles.avatarInitials}>{name.slice(0, 2).toUpperCase()}</Text>
          </LinearGradient>
        </View>

        {/* Identity */}
        <View style={styles.identityBlock}>
          <Text style={styles.username}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.statPill}>
            <Ionicons name="heart" size={14} color={COLORS.orange} />
            <Text style={styles.statPillText}>
              {loading ? '–' : favourites.length} saved heroes
            </Text>
          </View>
        </View>
```

- [ ] **Step 3: Replace the cover/avatar/identity styles in `StyleSheet.create`**

Remove these style blocks entirely:

```tsx
  // Header
  pageTitle: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 50,
    color: COLORS.navy,
    paddingTop: 8,
    paddingLeft: 4,
    marginBottom: 20,
  },

  // Identity card
  identityCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarWrapper: {
    marginBottom: 14,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Flame-Bold',
    fontSize: 28,
    color: '#fff',
  },
  username: {
    fontFamily: 'Flame-Bold',
    fontSize: 22,
    color: COLORS.navy,
    marginBottom: 4,
  },
  email: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    marginBottom: 16,
  },
```

And replace with:

```tsx
  // Cover
  cover: {
    height: 140,
    overflow: 'hidden',
  },
  coverLogo: {
    position: 'absolute',
    bottom: -4,
    right: 8,
    opacity: 0.10,
  },

  // Avatar
  avatarZone: {
    alignItems: 'center',
    marginTop: -30,
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.beige,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarInitials: {
    fontFamily: 'Flame-Bold',
    fontSize: 20,
    color: '#fff',
  },

  // Identity
  identityBlock: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  username: {
    fontFamily: 'Flame-Bold',
    fontSize: 22,
    color: COLORS.navy,
    marginBottom: 4,
  },
  email: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    marginBottom: 16,
  },
```

- [ ] **Step 4: Update scroll container padding**

The old layout used `paddingHorizontal: 16` on the scroll container. Now that the cover is full-bleed, horizontal padding is handled per-section. Replace:

```tsx
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
```

with:

```tsx
  scroll: {
    paddingBottom: 40,
  },
```

- [ ] **Step 5: Run the dev server and verify the cover appears**

```bash
bun start
```

Open on iOS simulator or device. Expected: navy gradient cover with orange halftone dots and faint logo in the bottom-right corner, avatar overlapping the bottom edge.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat: add cover banner with halftone dots and logo to profile screen"
```

---

### Task 2: Add hairline divider between identity and favourites

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Add the hairline `View` between identity and favourites**

In the JSX, between the identity block and the favourites section, add:

```tsx
        <View style={styles.hairline} />
```

So the JSX reads:

```tsx
        {/* Identity */}
        <View style={styles.identityBlock}>
          ...
        </View>

        <View style={styles.hairline} />

        {/* My Favourites */}
        <View style={styles.section}>
```

- [ ] **Step 2: Add the `hairline` style and update `section` padding**

Add after the `statPillText` style block:

```tsx
  // Hairline
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e8ddd0',
    marginHorizontal: 16,
    marginBottom: 20,
  },
```

Then update `section` to remove its own `marginBottom` that was accounting for the card's padding — replace:

```tsx
  section: {
    marginBottom: 24,
  },
```

with:

```tsx
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
```

And update `accountSection` similarly:

```tsx
  accountSection: {
    marginBottom: 8,
  },
```

becomes:

```tsx
  accountSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
```

- [ ] **Step 3: Verify in simulator**

The hairline should appear as a thin separator between the stat pill and the "My Favourites" heading.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat: add hairline divider between identity and favourites on profile screen"
```

---

### Task 3: Add coloured icon badges to account rows

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Replace the email row icon with a badge**

In the JSX, replace:

```tsx
            <View style={styles.accountRow}>
              <Ionicons name="mail-outline" size={18} color={COLORS.navy} />
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue} numberOfLines={1}>
                {email}
              </Text>
            </View>
```

with:

```tsx
            <View style={styles.accountRow}>
              <View style={[styles.accountIconBadge, styles.accountIconBadgeNavy]}>
                <Ionicons name="mail-outline" size={16} color={COLORS.navy} />
              </View>
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue} numberOfLines={1}>
                {email}
              </Text>
            </View>
```

- [ ] **Step 2: Replace the sign out row icon with a badge**

Replace:

```tsx
            <TouchableOpacity
              style={styles.accountRow}
              onPress={handleSignOut}
              disabled={signingOut}
              activeOpacity={0.7}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
              ) : (
                <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
              )}
              <Text style={[styles.accountLabel, { color: COLORS.red }]}>
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </Text>
            </TouchableOpacity>
```

with:

```tsx
            <TouchableOpacity
              style={styles.accountRow}
              onPress={handleSignOut}
              disabled={signingOut}
              activeOpacity={0.7}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
              ) : (
                <View style={[styles.accountIconBadge, styles.accountIconBadgeRed]}>
                  <Ionicons name="log-out-outline" size={16} color={COLORS.red} />
                </View>
              )}
              <Text style={[styles.accountLabel, { color: COLORS.red }]}>
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </Text>
            </TouchableOpacity>
```

- [ ] **Step 3: Add badge styles and update `accountRow` padding**

Add these style blocks in the account section of `StyleSheet.create`:

```tsx
  accountIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconBadgeNavy: {
    backgroundColor: '#e8f0f2',
  },
  accountIconBadgeRed: {
    backgroundColor: '#fde8e8',
  },
```

Update `accountRow` padding to tighten slightly to match the badge height:

```tsx
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
```

- [ ] **Step 4: Verify in simulator**

Email row: light navy square badge with mail icon. Sign Out row: light red square badge with logout icon. Signing out spinner replaces the badge while in progress.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat: add iOS-style icon badges to account rows on profile screen"
```
