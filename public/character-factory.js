
const TYPE_BY_MODE = {
  product_only: ['product-only display', 'off-screen product narrator'],
  factory_conveyor: ['factory worker', 'industrial inspector', 'production line operator'],
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

const BODY_TYPES = ['authentic human proportions', 'ordinary adult proportions', 'balanced real-world proportions', 'natural everyday body proportions', 'believable human anatomy'];
const SKIN_TONES = ['warm cream skin', 'golden tan skin', 'light rosy skin', 'gentle neutral skin', 'medium warm skin'];
const MATERIALS = ['visible skin pores and natural skin texture', 'realistic skin texture with subtle imperfections', 'real human skin finish with natural variation', 'live-action skin with authentic detail', 'natural skin surface with realistic shine'];
const HAIR_STYLES = ['straight shoulder-length hair', 'soft side-parted hair', 'long smooth hair', 'neat tied-back hair', 'soft wavy hairstyle'];
const HAIR_COLORS = ['deep brown', 'chestnut brown', 'dark black', 'warm caramel', 'soft ash brown'];
const EYE_STYLES = ['warm brown eyes', 'friendly rounded eyes', 'bright lively eyes', 'soft expressive eyes', 'natural dark eyes'];
const OUTFIT_BASE = {
  factory_conveyor: ['industrial factory uniform', 'clean production line outfit', 'warehouse worker clothing', 'cleanroom suit depending on factory type'],
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
const UNIQUE_TRAITS = ['has naturally expressive facial features', 'keeps a recognizable everyday hairstyle', 'has a consistent approachable smile', 'uses authentic human hand gestures', 'has subtle real-world imperfections'];
const EXPRESSIONS = ['genuine and approachable', 'naturally confident', 'trustworthy and relaxed', 'believable excitement', 'authentic product presentation', 'friendly without overacting'];

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
  if (raw.length >= 16) return raw.slice(0, 16);
  const base = `${Date.now()}${Math.floor(Math.random()*1000000000)}`.replace(/\D/g,'');
  return (raw + base + String(hashString(input)).padStart(16, '0')).slice(0, 16);
}

function getThaiVoiceProfile(voiceType='thai_female') {
  const normalized = {
    'หญิง':'thai_female','ชาย':'thai_male','วัยรุ่นหญิงเกาหลี':'korean_teen_female',
  'วัยรุ่นชายเกาหลี':'korean_teen_male','ผู้หญิง':'thai_female','ผู้ชาย':'thai_male',
    'หญิงชรา':'elder_female','ชายชรา':'elder_male','เด็กผู้หญิง':'thai_girl','เด็กผู้ชาย':'thai_boy','พี่วิน(ชาย)':'win_seller_male','พิมรี่(หญิง)':'pimry_female'
  }[voiceType] || voiceType || 'thai_female';
  const map = {
    thai_female: { gender:'Female', age:'real young adult Thai woman appearance', role:'Thai female product presenter, ordinary everyday Thai woman, trustworthy appearance, non-model appearance, authentic human identity', voice:'Thai female natural speaking voice', hair:'natural dark hair with realistic texture', eyes:'natural dark expressive eyes' },
    thai_male: { gender:'Male', age:'real adult Thai man appearance', role:'Thai male product presenter, ordinary everyday Thai man, trustworthy appearance, non-model appearance, authentic human identity', voice:'Thai male natural speaking voice', hair:'short natural dark hair', eyes:'natural dark confident eyes' },
    win_seller_male: { gender:'Male', age:'real adult Thai livestream seller appearance', role:`real Thai male livestream seller, ordinary Thai man appearance, trustworthy market seller look, non-model appearance, authentic human identity, genuine product presentation, documentary realism`, voice:`natural energetic Thai male livestream voice, authentic selling rhythm, confident product presentation, not overacting`, randomizeAppearance:true, persistentCharacter:false },
    pimry_female: { gender:'Female', age:'real adult Thai female livestream seller appearance', role:`real Thai female livestream seller, ordinary Thai woman appearance, trustworthy seller look, non-model appearance, authentic human identity, genuine excitement, documentary realism`, voice:`natural energetic Thai female livestream voice, authentic selling rhythm, confident product presentation, not overacting`, randomizeAppearance:true, persistentCharacter:false },
    korean_teen_female:{ gender:'Female', age:'real young Korean woman appearance', role:'ordinary everyday Korean woman, non-model appearance, authentic human identity', voice:'natural young female speaking voice', hair:'natural Korean hairstyle with realistic flyaway strands', eyes:'natural Korean eyes with authentic expression' },
    korean_teen_male:{ gender:'Male', age:'real young Korean man appearance', role:'ordinary everyday Korean man, non-model appearance, authentic human identity', voice:'natural young male speaking voice', hair:'natural Korean hairstyle with realistic imperfections', eyes:'natural Korean eyes with authentic expression' },
    elder_female: { gender:'Female', age:'real elderly Thai woman appearance', role:'trusted elderly Thai woman, authentic human identity, ordinary everyday appearance', voice:'warm Thai elderly female voice', hair:'grey or silver naturally styled hair', eyes:'kind elder dark eyes' },
    elder_male: { gender:'Male', age:'real elderly Thai man appearance', role:'trusted elderly Thai man, authentic human identity, ordinary everyday appearance', voice:'calm Thai elderly male voice', hair:'silver naturally styled hair', eyes:'wise elder dark eyes' },
    thai_girl: { gender:'Female', age:'Thai little girl child appearance', role:'Thai child presenter with authentic everyday appearance', voice:'Thai little girl cheerful voice', hair:'natural dark child hairstyle', eyes:'bright childlike dark eyes' },
    thai_boy: { gender:'Male', age:'Thai little boy child appearance', role:'Thai child presenter with authentic everyday appearance', voice:'Thai little boy energetic voice', hair:'natural dark child hairstyle', eyes:'bright childlike dark eyes' }
  };
  return map[normalized] || map.thai_female;
}

export function buildCharacterFactoryProfile({ productName='', gemMode='signboard', sceneCount=1, characterSessionId='', voiceType='thai_female' }) {
  if (String(voiceType || '').toLowerCase() === 'product_only' || String(gemMode || '').toLowerCase() === 'infographic_ai') {
    return { enabled: false, profileBlock: '', dnaBlock: '', lockBlock: '', summary: '', seed: '', productOnly: true };
  }
  if (Number(sceneCount || 1) <= 1) {
    return { enabled: false, profileBlock: '', dnaBlock: '', lockBlock: '', summary: '', seed: '' };
  }

  const sessionId = getCharacterId(characterSessionId || `${Date.now()}${Math.random()}`);
  const seedSource = `${gemMode}::${String(productName).trim().toLowerCase()}::${sessionId}`;
  const seed = hashString(seedSource);
  const voiceProfile = getThaiVoiceProfile(voiceType);
  const modeTypes = TYPE_BY_MODE[gemMode] || TYPE_BY_MODE.signboard;
  const outfitPool = OUTFIT_BASE[gemMode] || OUTFIT_BASE.signboard;

  const gender = voiceProfile.gender;
  const age = voiceProfile.age;
  const archetype = voiceProfile.role || pick(seed + 3, modeTypes);
  const bodyType = pick(seed + 4, BODY_TYPES);
  const skinTone = pick(seed + 5, SKIN_TONES);
  const material = pick(seed + 6, MATERIALS);
  
  const randomAppearance = voiceProfile.randomizeAppearance;

const hairStyle = randomAppearance
  ? pick(seed + 7, HAIR_STYLES)
  : (voiceProfile.hair || pick(seed + 7, HAIR_STYLES));

const hairColor = pick(seed + 8, HAIR_COLORS);

const eyes = randomAppearance
  ? pick(seed + 9, EYE_STYLES)
  : (voiceProfile.eyes || pick(seed + 9, EYE_STYLES));
  
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
Core expression style: ${expressionStyle}\nVoice profile: ${voiceProfile.voice}\nEthnicity lock: Thai / Asian only`;

  const dnaSummary = `Character ID ${sessionId}, a ${archetype}, ${bodyType}, ${skinTone}, ${material}, ${hairStyle}, ${hairColor}, ${eyes}, wearing ${outfit}, with ${trait}, Thai / Asian only, voice profile ${voiceProfile.voice}.`;
  
  const consistencyRule = voiceProfile.persistentCharacter === false
  ? `Character variation allowed between generations while maintaining the same Thai livestream seller archetype, energy, and overall style.`
  : `Consistency Lock: same character, identical face structure, same hairstyle, same hair color, same outfit, same body proportions, same facial features, same natural material behavior, same color logic, no variation, fixed identity, do not redesign, do not reinterpret, this is the exact same character across all scenes.`;

  const dnaBlock = `🧬 CHARACTER DNA BLOCK (Used in every prompt)
Character Profile: ${dnaSummary}

${consistencyRule}

Face Rule: facial features remain identical, only expression changes.

World Lock: same universe, same visual world, same art direction, same rendering quality, same color logic, same environmental storytelling style, same lighting family across all scenes unless story progression explicitly changes it.

Style Lock: same photorealistic live-action documentary style across every scene, same social-media realism, same smartphone camera realism, no 3D, no cartoon, no chibi, no mascot styling, no CGI stylization, no age shift, no style drift.

Scale Lock: character scale must remain consistent relative to surrounding environment and props across all scenes unless the story explicitly changes scale.

Motion Continuity Rule: this is the exact same character continuing from scene to scene, with the same identity, body proportions, outfit, face, Thai / Asian ethnicity, and voice profile.`;

  const lockBlock = `MULTI-SCENE CHARACTER LOCK RULE:
Because sceneCount is greater than 1, every scene must use the exact same locked main character with Character ID ${sessionId}. You must carry the same character identity, face, costume, colors, materials, and proportions through every scene. Only pose, expression, camera angle, environment progression, and action can change. The character must remain photorealistic Thai / Asian human live-action, documentary realism, smartphone camera realism, natural human imperfections, non-model appearance, never 3D, cartoon, chibi, mascot, CGI, animation, or Pixar-like.`;

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
