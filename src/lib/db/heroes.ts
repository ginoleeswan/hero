// Barrel for the heroes-table DB layer. Implementation is split into focused
// modules under ./heroes/ — import from here ('../lib/db/heroes') as before.
//
//   types.ts          shared types (Hero, HeroSearchResult, CategorySlug, …)
//   core.ts           by-id lookups, search/browse RPC, pure filters, count
//   feed.ts           home/explore feed rows (popular, villains, spotlight, …)
//   categories.ts     category browse pages, covers, era timeline, labels
//   relationships.ts  related/rivalries/most-feared, power-range, publisher counts
//   transforms.ts     heroRowToCharacterData, getHeroFamily

export * from './heroes/types';
export * from './heroes/core';
export * from './heroes/feed';
export * from './heroes/categories';
export * from './heroes/relationships';
export * from './heroes/transforms';
