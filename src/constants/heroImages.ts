export const HERO_IMAGES: Record<string, number> = {
  '620': require('../../assets/images/spiderman.jpg'),
  '346': require('../../assets/images/ironman.jpg'),
  '70': require('../../assets/images/batman.jpg'),
  '644': require('../../assets/images/superman.jpg'),
  '370': require('../../assets/images/joker.jpg'),
  '149': require('../../assets/images/captain-america.jpg'),
  '226': require('../../assets/images/doctor-strange.jpg'),
  '720': require('../../assets/images/wonder-woman.jpg'),
  '717': require('../../assets/images/wolverine.jpg'),
  '659': require('../../assets/images/thor.jpg'),
  '332': require('../../assets/images/hulk.jpg'),
  '213': require('../../assets/images/deadpool.jpg'),
  '313': require('../../assets/images/hawkeye.jpg'),
  '414': require('../../assets/images/loki.jpg'),
  '687': require('../../assets/images/venom.jpeg'),
  '630': require('../../assets/images/star-lord.jpg'),
  '106': require('../../assets/images/black-panther.jpg'),
  '30': require('../../assets/images/ant-man.jpg'),
  '222': require('../../assets/images/doctor-doom.jpg'),
  '208': require('../../assets/images/darth-vader.jpg'),
  '479': require('../../assets/images/mysterio.jpg'),
  '650': require('../../assets/images/terminator.jpeg'),
  '225': require('../../assets/images/doctor-octopus.jpg'),
  '299': require('../../assets/images/green-goblin.jpg'),
  '423': require('../../assets/images/magneto.jpg'),
  '196': require('../../assets/images/cyclops.jpg'),
  '480': require('../../assets/images/mystique.jpg'),
  '638': require('../../assets/images/storm.jpg'),
  '75': require('../../assets/images/beast.jpg'),
  '567': require('../../assets/images/rogue.jpg'),
  '185': require('../../assets/images/colossus.png'),
  '490': require('../../assets/images/nightcrawler.jpg'),
  '710': require('../../assets/images/weapon-x.jpg'),
  '274': require('../../assets/images/gambit.jpg'),
  // Publisher logos
  'marvel-logo': require('../../assets/images/Marvel-Logo.jpg'),
  'dc-logo': require('../../assets/images/DC-Logo.png'),
};

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md';

/**
 * Resolves a hero image source.
 * Tries imageUrl slug first, then numeric id, then falls back to CDN using the numeric id.
 */
export function heroImageSource(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
): number | { uri: string } {
  if (portraitUrl) return { uri: portraitUrl };
  if (imageUrl && HERO_IMAGES[imageUrl]) return HERO_IMAGES[imageUrl];
  const local = HERO_IMAGES[String(id)];
  if (local) return local;
  if (imageUrl && imageUrl.startsWith('http')) return { uri: imageUrl };
  return { uri: `${CDN_BASE}/${id}.jpg` };
}
