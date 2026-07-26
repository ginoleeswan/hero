// src/lib/family/displayName.ts
// How a relative's name is written inside a family tree.
//
// A genealogy repeats the house name on every node by default, which is how a
// Targaryen tree ends up saying "Targaryen" forty times and burying the part
// that actually identifies anyone — the given name and regnal number. Printed
// family trees don't do this: the tree IS the surname, so nodes carry given
// names and a surname appears only when it differs.
//
// That inverts the noise into signal. In Aegon I's tree the cards read "Aenys
// I", "Maegor I", "Rhaenyra" — and "Steffon Baratheon" keeps his house, which
// is precisely the moment the bloodline leaves House Targaryen. In Eddard
// Stark's tree his children shorten to "Arya" and "Robb" while "Jon Snow" keeps
// Snow, which is the whole meaning of a bastard's name.

/** The house a name belongs to: its last whitespace-separated word. */
function houseOf(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

/**
 * `name` as it should appear on a node in the tree belonging to `heroName`.
 * Falls back to the full name whenever shortening would lose information or
 * leave nothing behind.
 */
export function treeDisplayName(name: string, heroName: string): string {
  const house = houseOf(heroName);
  if (!house) return name;

  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  if (parts[parts.length - 1].toLowerCase() !== house.toLowerCase()) return name;

  const shortened = parts.slice(0, -1).join(' ');
  return shortened.length > 0 ? shortened : name;
}
