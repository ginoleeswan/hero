import { useCallback, useRef, useState } from 'react';
import {
  loadPromptState,
  savePromptState,
  shouldPrompt,
  detectMilestone,
} from '../lib/support/donationPrompt';
import { openKofi } from '../lib/support/kofi';

export function useDonationNudge() {
  const [visible, setVisible] = useState(false);
  // Dedupe: only process a given tier+badge signature once per mount.
  const lastSig = useRef<string | null>(null);

  const requestNudge = useCallback(async (_reason: 'share' | 'milestone') => {
    const state = await loadPromptState();
    if (shouldPrompt(state, Date.now())) {
      await savePromptState({ lastShownAt: Date.now() });
      setVisible(true);
    }
  }, []);

  const syncMilestones = useCallback(
    async (input: { tier: string; earnedBadgeIds: string[] }) => {
      const sig = `${input.tier}|${[...input.earnedBadgeIds].sort().join(',')}`;
      if (lastSig.current === sig) return;
      lastSig.current = sig;

      const state = await loadPromptState();
      const milestone = detectMilestone(
        { lastSeenTier: state.lastSeenTier, seenBadgeIds: state.seenBadgeIds },
        input,
      );
      // Always record the current baseline so a milestone only counts once.
      await savePromptState({ lastSeenTier: input.tier, seenBadgeIds: input.earnedBadgeIds });
      if (milestone && shouldPrompt(state, Date.now())) {
        await savePromptState({ lastShownAt: Date.now() });
        setVisible(true);
      }
    },
    [],
  );

  const onConvert = useCallback(() => {
    void savePromptState({ lastConvertedAt: Date.now() });
    openKofi();
    setVisible(false);
  }, []);

  const onDismiss = useCallback(() => {
    void savePromptState({ lastDismissedAt: Date.now() });
    setVisible(false);
  }, []);

  return { visible, requestNudge, syncMilestones, onConvert, onDismiss };
}
