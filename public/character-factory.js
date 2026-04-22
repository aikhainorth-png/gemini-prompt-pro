
const TYPE_BY_MODE = {
  signboard: ['friendly store mascot', 'chibi seller', 'cute promo mascot'],
  supplement_stop_scroll: ['healthy helper mascot', 'vitamin guardian', 'wellness friend'],
  food: ['cute foodie mascot', 'mini chef character', 'happy food mascot'],
  snacks: ['playful snack mascot', 'crispy buddy', 'bite-size mascot'],
  mom_baby: ['gentle caregiver mascot', 'cute baby helper', 'soft family mascot'],
  fashion: ['stylish mini model', 'fashion mascot', 'street-style chibi'],
  shoes: ['sporty runner mascot', 'shoe spirit', 'speedy footwear mascot'],
  underwear: ['soft comfort mascot', 'confidence helper', 'cozy lifestyle mascot'],
  skincare: ['glow fairy mascot', 'skin angel', 'beauty helper'],
  cosmetics: ['glam beauty mascot', 'makeup muse chibi', 'sparkle cosmetic mascot'],
  home: ['home helper mascot', 'clean house spirit', 'cozy room mascot'],
  bedding: ['sleepy dream mascot', 'cloudy pillow friend', 'bedtime helper'],
  kitchen: ['little kitchen chef', 'cook buddy mascot', 'smart kitchen helper'],
  bathroom: ['fresh clean mascot', 'bathroom helper', 'bubble spirit'],
  laundry: ['cleaning buddy mascot', 'foam helper', 'fresh scent spirit'],
  appliances: ['smart appliance mascot', 'tech helper', 'home gadget spirit'],
  garden: ['garden sprite', 'plant buddy mascot', 'nature helper'],
  produce: ['farm friend mascot', 'fruit spirit', 'veggie buddy'],
  tools: ['tiny tool mechanic', 'builder mascot', 'fix-it helper'],
  stationery: ['study buddy mascot', 'note fairy', 'desk helper'],
  books: ['book spirit mascot', 'reading buddy', 'knowledge helper']
};

const BODY_TYPES = ['small rounded body', 'soft pear-shaped body', 'compact chibi proportions', 'mini stylized body', 'slightly oversized head with tiny body'];
const SKIN_TONES = ['warm cream skin', 'soft pastel skin', 'golden tan skin', 'light rosy skin', 'gentle neutral skin'];
const MATERIALS = ['soft semi-gloss finish', 'subtle velvet-like shading', 'clean polished 3D material', 'gentle bioluminescent glow accents', 'soft cinematic rim glow'];
const HAIR_STYLES = ['short fluffy hair', 'single playful curl', 'round bob haircut', 'side-parted soft hair', 'wavy short hairstyle'];
const HAIR_COLORS = ['deep brown', 'chestnut brown', 'dark black', 'warm caramel', 'soft ash brown', 'teal blue', 'honey blonde'];
const EYE_STYLES = ['large expressive teal eyes', 'big warm brown eyes', 'sparkling dark eyes', 'friendly rounded eyes', 'bright lively eyes'];
const OUTFIT_BASE = {
  signboard: ['yellow promo vest with red price tag patch', 'shop apron with sale badge', 'bright seller jacket with promo pin'],
  supplement_stop_scroll: ['clean wellness hoodie with capsule icon', 'health routine jacket with vitamin badge', 'minimal sporty cardigan with wellness symbol'],
  food: ['tiny chef apron with spoon badge', 'foodie hoodie with bowl logo', 'cute cook outfit with utensil patch'],
  snacks: ['playful snack hoodie with crunchy badge', 'street snack jacket with bite icon', 'casual hoodie with snack logo'],
  mom_baby: ['soft pastel cardigan with baby cloud logo', 'gentle family apron with heart patch', 'cozy caretaker outfit with nursery icon'],
  fashion: ['stylish street jacket with fashion pin', 'mini runway outfit with clean silhouette', 'trendy layered clothing with metallic charm'],
  shoes: ['sport jacket with lace icon', 'runner hoodie with speed stripe', 'streetwear outfit with shoe emblem'],
  underwear: ['soft cozy loungewear with comfort icon', 'minimal homewear set with cloud patch', 'clean relaxed outfit with soft fabric look'],
  skincare: ['clean spa robe with droplet logo', 'skincare uniform with glow patch', 'minimal beauty cardigan with serum icon'],
  cosmetics: ['glam mini jacket with lipstick logo', 'beauty outfit with sparkle emblem', 'makeup artist coat with blush icon'],
  home: ['house helper overalls with home icon', 'cozy sweater with room badge', 'soft cleaning apron with tiny house patch'],
  bedding: ['sleepy pajama outfit with moon logo', 'cloudy night robe with star patch', 'soft bedtime hoodie with pillow emblem'],
  kitchen: ['chef apron with pan logo', 'kitchen helper uniform with utensil icon', 'cooking jacket with spoon emblem'],
  bathroom: ['fresh robe with bubble logo', 'clean bath outfit with droplet patch', 'spa towel cape with fresh badge'],
  laundry: ['cleaning overalls with foam logo', 'laundry helper outfit with fresh badge', 'work apron with sparkle-clean icon'],
  appliances: ['tech jacket with power icon', 'smart home outfit with electric badge', 'gadget helper suit with tiny LED emblem'],
  garden: ['garden overalls with leaf logo', 'nature helper hoodie with flower patch', 'outdoor apron with sprout emblem'],
  produce: ['farm apron with fruit badge', 'fresh market outfit with leaf patch', 'garden vest with harvest logo'],
  tools: ['mechanic vest with wrench icon', 'builder apron with hammer patch', 'fix-it jacket with tool logo'],
  stationery: ['study cardigan with pen icon', 'desk helper hoodie with notebook patch', 'cute school outfit with stationery badge'],
  books: ['reading cardigan with book emblem', 'scholar capelet with page logo', 'cozy study outfit with bookmark patch']
};
const UNIQUE_TRAITS = ['wears oversized boots', 'leaves tiny glowing footprints when walking', 'has a floating charm accessory', 'always carries a small matching item', 'creates a subtle sparkle trail when moving'];
const EXPRESSIONS = ['friendly and curious', 'confident and playful', 'soft and trustworthy', 'energetic and expressive'];

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

function titleCaseName(productName='') {
  const cleaned = String(productName).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean).slice(0,2);
  if (!parts.length) return 'Nova';
  return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1,4)).join('');
}

export function buildCharacterFactoryProfile({ productName='', gemMode='signboard', sceneCount=1 }) {
  if (Number(sceneCount || 1) <= 1) {
    return { enabled: false, profileBlock: '', dnaBlock: '', lockBlock: '', summary: '', seed: '' };
  }

  const seedSource = `${gemMode}::${String(productName).trim().toLowerCase()}`;
  const seed = hashString(seedSource);
  const modeTypes = TYPE_BY_MODE[gemMode] || TYPE_BY_MODE.signboard;
  const outfitPool = OUTFIT_BASE[gemMode] || OUTFIT_BASE.signboard;

  const name = titleCaseName(productName);
  const gender = pick(seed + 1, ['Male', 'Female']);
  const age = pick(seed + 2, ['7 years old appearance', '10 years old appearance', 'young teen appearance', 'young adult chibi appearance']);
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
Name: ${name}
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

  const dnaSummary = `${name}, a ${archetype}, ${bodyType}, ${skinTone}, ${material}, ${hairStyle}, ${hairColor}, ${eyes}, wearing ${outfit}, with ${trait}.`;

  const dnaBlock = `🧬 CHARACTER DNA BLOCK (Used in every prompt)
Character Profile: ${dnaSummary}

Consistency Lock: same character, identical face structure, same hairstyle, same hair color, same outfit, same body proportions, same facial features, same material behavior, same color logic, no variation, fixed identity, character model sheet consistency, do not redesign, do not reinterpret, this is the exact same character across all scenes.

Face Rule: facial features remain identical, only expression changes.

World Lock: same universe, same visual world, same art direction, same rendering quality, same color logic, same environmental storytelling style, same lighting family across all scenes unless story progression explicitly changes it.

Style Lock: same 3D animated cinematic style across every scene, no redesign, no alternate costume, no age shift, no style drift.

Scale Lock: character scale must remain consistent relative to surrounding environment and props across all scenes unless the story explicitly changes scale.

Motion Continuity Rule: this is the exact same character continuing from scene to scene, with the same identity, body proportions, outfit, and face.`;

  const lockBlock = `MULTI-SCENE CHARACTER LOCK RULE:
Because sceneCount is greater than 1, every scene must use the exact same locked main character. You must carry the same character identity, face, costume, colors, materials, and proportions through every scene. Only pose, expression, camera angle, environment progression, and action can change.`;

  return {
    enabled: true,
    seed: seedSource,
    profileBlock,
    dnaBlock,
    lockBlock,
    summary: dnaSummary,
    shortName: name
  };
}
