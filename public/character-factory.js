
const TYPE_BY_MODE = {
  signboard: ['store presenter', 'retail sales demonstrator', 'product presenter'],
  supplement_stop_scroll: ['wellness presenter', 'health routine demonstrator', 'trusted lifestyle presenter'],
  food: ['food presenter', 'kitchen demonstrator', 'lifestyle presenter'],
  snack: ['snack presenter', 'casual product demonstrator', 'lifestyle presenter'],
  snacks: ['snack presenter', 'casual product demonstrator', 'lifestyle presenter'],
  mom_baby: ['caregiver presenter', 'family lifestyle presenter', 'gentle product demonstrator'],
  fashion: ['fashion presenter', 'style model', 'lifestyle presenter'],
  shoes: ['footwear presenter', 'style model', 'lifestyle presenter'],
  lingerie: ['comfortwear presenter', 'lifestyle presenter', 'product demonstrator'],
  underwear: ['comfortwear presenter', 'lifestyle presenter', 'product demonstrator'],
  skincare: ['skincare presenter', 'beauty demonstrator', 'lifestyle presenter'],
  cosmetics: ['beauty presenter', 'makeup demonstrator', 'beauty advisor'],
  home: ['home product presenter', 'lifestyle demonstrator', 'household presenter'],
  bedding: ['sleep lifestyle presenter', 'home presenter', 'product demonstrator'],
  kitchen: ['kitchen presenter', 'cooking demonstrator', 'home presenter'],
  bathroom: ['bathroom product presenter', 'clean lifestyle presenter', 'home demonstrator'],
  laundry: ['laundry product presenter', 'household demonstrator', 'clean lifestyle presenter'],
  appliances: ['appliance presenter', 'tech lifestyle presenter', 'home demonstrator'],
  garden: ['garden lifestyle presenter', 'outdoor demonstrator', 'product presenter'],
  produce: ['fresh produce presenter', 'market demonstrator', 'lifestyle presenter'],
  tools: ['tool presenter', 'workshop demonstrator', 'practical product presenter'],
  stationery: ['study presenter', 'desk lifestyle presenter', 'product demonstrator'],
  books: ['reading lifestyle presenter', 'study presenter', 'product demonstrator']
};

const BODY_TYPES = ['natural human proportions', 'slim natural proportions', 'balanced adult proportions', 'petite natural proportions', 'fit natural proportions'];
const SKIN_TONES = ['warm cream skin', 'golden tan skin', 'light rosy skin', 'gentle neutral skin', 'medium warm skin'];
const MATERIALS = ['natural skin texture', 'realistic skin texture', 'photoreal skin with subtle detail', 'live-action natural texture', 'real human skin finish'];
const HAIR_STYLES = ['straight shoulder-length hair', 'soft side-parted hair', 'long smooth hair', 'neat tied-back hair', 'soft wavy hairstyle'];
const HAIR_COLORS = ['deep brown', 'chestnut brown', 'dark black', 'warm caramel', 'soft ash brown'];
const EYE_STYLES = ['warm brown eyes', 'friendly rounded eyes', 'bright lively eyes', 'soft expressive eyes', 'natural dark eyes'];
const OUTFIT_BASE = {
  signboard: ['clean retail uniform with promo badge', 'casual store outfit with sale pin', 'real retail presenter clothing with product badge'],
  supplement_stop_scroll: ['clean wellness outfit with minimal badge', 'natural lifestyle outfit in soft neutral tones', 'casual health presenter clothing'],
  food: ['clean casual kitchen outfit', 'simple chef-inspired apron over everyday clothing', 'natural food presenter clothing'],
  snacks: ['casual everyday outfit for snack presentation', 'clean lifestyle outfit in bright store setting', 'simple presenter clothing'],
  mom_baby: ['soft pastel lifestyle outfit', 'clean caregiver clothing', 'comfortable family presenter outfit'],
  fashion: ['modern stylish outfit matching the product category', 'clean fashion presenter clothing', 'minimal chic styling'],
  shoes: ['clean fashion-casual outfit that complements footwear', 'modern lifestyle clothing', 'street-casual styling'],
  underwear: ['modest lifestyle outfit suitable for product presentation', 'clean homewear styling', 'comfortable presenter clothing'],
  lingerie: ['modest lifestyle outfit suitable for product presentation', 'clean homewear styling', 'comfortable presenter clothing'],
  skincare: ['clean beauty presenter outfit', 'spa-inspired minimal clothing', 'soft neutral skincare styling'],
  cosmetics: ['clean beauty counter outfit', 'makeup presenter styling', 'modern beauty advisor outfit'],
  home: ['clean household lifestyle clothing', 'simple home presenter outfit', 'casual organized-home styling'],
  bedding: ['soft homewear styling', 'clean sleep-lifestyle clothing', 'comfortable neutral outfit'],
  kitchen: ['clean kitchen demonstrator outfit', 'casual apron over everyday clothes', 'simple cooking presenter styling'],
  bathroom: ['clean spa-like outfit', 'simple fresh lifestyle clothing', 'neutral home presenter styling'],
  laundry: ['clean everyday household outfit', 'simple utility presenter clothing', 'casual fresh-home styling'],
  appliances: ['modern neutral tech-home outfit', 'clean demonstrator clothing', 'minimal lifestyle styling'],
  garden: ['casual outdoor lifestyle outfit', 'simple garden demonstrator clothing', 'clean practical styling'],
  produce: ['fresh market lifestyle outfit', 'clean casual clothing', 'simple natural presenter styling'],
  tools: ['practical workshop outfit', 'clean utility clothing', 'casual demonstrator outfit'],
  stationery: ['clean study-life outfit', 'simple desk presenter clothing', 'minimal casual styling'],
  books: ['clean reading-life outfit', 'soft academic casual clothing', 'simple presenter styling']
};
const UNIQUE_TRAITS = ['wears a subtle product-themed accessory', 'keeps a neat signature hairstyle', 'has a consistent friendly smile', 'uses clean natural hand gestures', 'keeps a polished presenter look'];
const EXPRESSIONS = ['friendly and curious', 'confident and persuasive', 'soft and trustworthy', 'energetic and expressive'];

function hashString(input='') {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function pick(seed, list) {
  if (!Array.isArray(list) || !list.length) return '';
  return list[seed % list.length];
}

function getCharacterId(input='') {
  const raw = String(input || '').replace(/\D/g, '');
  if (raw.length >= 6) return raw.slice(0, 6);
  const hash = String(hashString(input)).padStart(6, '0');
  return hash.slice(0, 6);
}

export function buildCharacterFactoryProfile({ productName='', gemMode='signboard', sceneCount=1, characterSessionId='' }) {
  if (Number(sceneCount || 1) <= 1) {
    return { enabled: false, profileBlock: '', dnaBlock: '', lockBlock: '', summary: '', seed: '' };
  }

  const sessionId = getCharacterId(characterSessionId || `${Date.now()}${Math.random()}`);
  const seedSource = `${gemMode}::${String(productName).trim().toLowerCase()}::${sessionId}`;
  const seed = hashString(seedSource);
  const modeTypes = TYPE_BY_MODE[gemMode] || TYPE_BY_MODE.signboard;
  const outfitPool = OUTFIT_BASE[gemMode] || OUTFIT_BASE.signboard;

  const gender = pick(seed + 1, ['Male', 'Female']);
  const age = pick(seed + 2, ['young adult appearance', 'adult appearance', 'late 20s appearance', 'early 30s appearance']);
  const archetype = pick(seed + 3, modeTypes);
  const bodyType = pick(seed + 4, BODY_TYPES);
  const skinTone = pick(seed + 5, SKIN_TONES);
  const material = pick(seed + 6, MATERIALS);
  const hairStyle = pick(seed + 7, HAIR_STYLES);
  const hairColor = pick(seed + 8, HAIR_COLORS);
  const eyes = pick(seed + 9, EYE_STYLES);
  const outfit = pick(seed + 10, outfitPool);
  const trait = pick(seed + 11, UNIQUE_TRAITS);
  const expressionStyle = pick(seed + 12, EXPRESSIONS);

  const profileBlock = `🔒 Main Character Profile
Character ID: ${sessionId}
Role Type: ${archetype}
Gender Presentation: ${gender}
Age (appearance): ${age}
Body type: ${bodyType}
Skin tone / material: ${skinTone}, ${material}
Hair style: ${hairStyle}
Hair color: ${hairColor}
Eyes: ${eyes}
Outfit: ${outfit}
Unique traits: ${trait}
Core expression style: ${expressionStyle}`;

  const dnaSummary = `Character ID ${sessionId}, a ${archetype}, ${bodyType}, ${skinTone}, ${material}, ${hairStyle}, ${hairColor}, ${eyes}, wearing ${outfit}, with ${trait}.`;

  const dnaBlock = `🧬 CHARACTER DNA BLOCK (Used in every prompt)
Character Profile: ${dnaSummary}

Consistency Lock: same character, identical face structure, same hairstyle, same hair color, same outfit, same body proportions, same facial features, same natural material behavior, same color logic, no variation, fixed identity, do not redesign, do not reinterpret, this is the exact same character across all scenes.

Face Rule: facial features remain identical, only expression changes.

World Lock: same universe, same visual world, same art direction, same rendering quality, same color logic, same environmental storytelling style, same lighting family across all scenes unless story progression explicitly changes it.

Style Lock: same photorealistic live-action cinematic style across every scene, no 3D, no cartoon, no chibi, no mascot styling, no CGI stylization, no age shift, no style drift.

Scale Lock: character scale must remain consistent relative to surrounding environment and props across all scenes unless the story explicitly changes scale.

Motion Continuity Rule: this is the exact same character continuing from scene to scene, with the same identity, body proportions, outfit, and face.`;

  const lockBlock = `MULTI-SCENE CHARACTER LOCK RULE:
Because sceneCount is greater than 1, every scene must use the exact same locked main character with Character ID ${sessionId}. You must carry the same character identity, face, costume, colors, materials, and proportions through every scene. Only pose, expression, camera angle, environment progression, and action can change. The character must remain photorealistic human live-action, never 3D or animated.`;

  return {
    enabled: true,
    seed: seedSource,
    profileBlock,
    dnaBlock,
    lockBlock,
    summary: dnaSummary,
    shortName: sessionId,
    characterId: sessionId
  };
}
