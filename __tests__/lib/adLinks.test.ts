import { buildAdLink, slugifyCampaign, battlePath, bioLink } from '../../src/lib/marketing/adLinks';

describe('slugifyCampaign', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyCampaign('Aquaman Challenge V2')).toBe('aquaman-challenge-v2');
  });
  it('collapses punctuation runs and trims edge hyphens', () => {
    expect(slugifyCampaign('  --Top 10!! Villains--  ')).toBe('top-10-villains');
  });
  it('caps length at 60', () => {
    expect(slugifyCampaign('x'.repeat(100))).toHaveLength(60);
  });
});

describe('buildAdLink', () => {
  it('builds a fully tagged homepage link', () => {
    expect(buildAdLink({ source: 'tiktok', medium: 'paid', campaign: 'Aqua V2' })).toBe(
      'https://mythique.app/?utm_source=tiktok&utm_medium=paid&utm_campaign=aqua-v2',
    );
  });
  it('supports deep paths', () => {
    expect(
      buildAdLink({ source: 'reddit', medium: 'social', campaign: 'x', path: '/battle/a/b' }),
    ).toBe('https://mythique.app/battle/a/b?utm_source=reddit&utm_medium=social&utm_campaign=x');
  });
  it('falls back to "untitled" for an empty campaign', () => {
    expect(buildAdLink({ source: 'x', medium: 'paid', campaign: '  ' })).toContain(
      'utm_campaign=untitled',
    );
  });
});

describe('battlePath', () => {
  it('normalizes pair order to the canonical id order', () => {
    expect(battlePath('h_z', 'h_a')).toBe('/battle/h_a/h_z');
    expect(battlePath('h_a', 'h_z')).toBe('/battle/h_a/h_z');
  });
});

describe('bioLink', () => {
  it('is the evergreen organic profile link', () => {
    expect(bioLink('tiktok')).toBe(
      'https://mythique.app/?utm_source=tiktok&utm_medium=social&utm_campaign=bio',
    );
  });
});
