/** Maps hero ID → list of rival hero IDs (both directions intentional) */
const RIVALS_MAP: Record<string, string[]> = {
  '70':  ['644', '370', '69'],        // Batman → Superman, Joker, Bane
  '644': ['70', '423', '149'],        // Superman → Batman, Magneto, Captain America
  '370': ['70', '149'],               // Joker → Batman, Captain America
  '620': ['299', '687', '717'],       // Spider-Man → Green Goblin, Venom, Wolverine
  '346': ['222', '717', '332'],       // Iron Man → Doctor Doom, Wolverine, Hulk
  '149': ['423', '370', '222'],       // Captain America → Magneto, Joker, Doctor Doom
  '717': ['346', '620', '332'],       // Wolverine → Iron Man, Spider-Man, Hulk
  '332': ['346', '717', '659'],       // Hulk → Iron Man, Wolverine, Thor
  '659': ['423', '332', '414'],       // Thor → Magneto, Hulk, Loki
  '414': ['659', '346'],              // Loki → Thor, Iron Man
  '423': ['149', '659', '196'],       // Magneto → Captain America, Thor, Cyclops
  '687': ['620', '717'],              // Venom → Spider-Man, Wolverine
  '299': ['620'],                     // Green Goblin → Spider-Man
  '222': ['346', '149'],              // Doctor Doom → Iron Man, Captain America
  '720': ['70', '644'],               // Wonder Woman → Batman, Superman
  '226': ['222', '414'],              // Doctor Strange → Doctor Doom, Loki
  '208': ['644', '149'],              // Darth Vader → Superman, Captain America
  '196': ['423', '480'],              // Cyclops → Magneto, Mystique
  '480': ['196', '717'],              // Mystique → Cyclops, Wolverine
  '638': ['423'],                     // Storm → Magneto
};

export function getRivals(hero: string): string[] {
  return RIVALS_MAP[hero] ?? [];
}
