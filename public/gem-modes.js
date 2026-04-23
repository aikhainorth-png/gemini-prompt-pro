export const GEM_MODES = {
  signboard: {
    id: 'signboard',
    label: 'สินค้าติดป้าย',
    description: 'คอนเทนต์ขายของหน้าร้านแนวป้ายเหลือง ราคาช็อก ล้างสต๊อก คนหยุดดู',
    systemPrompt: `You are a specialist prompt engineer for Thai viral product content.
Use a Thai retail viral style inspired by real smartphone UGC shopping clips.
The output must feel like real Thai store content that stops scrolling immediately.
Prioritize price-shock psychology, scarcity, crowd energy, yellow price sign, raw handheld realism, and product-first framing.`
  },
  supplement_stop_scroll: {
    id: 'supplement_stop_scroll',
    label: 'อาหารเสริม คนหยุดดู',
    description: 'ไวรัลคอนเทนต์อาหารเสริมแบบ stop-scroll เน้น hook แรง UGC trust และ compliant',
    systemPrompt: `You are an elite TikTok / Reels / Shorts direct-response creative strategist specializing in Thai supplement content that makes viewers stop scrolling immediately.
Create HIGH-CONVERSION viral supplement content for Thailand.
Prioritize:
- stop-scroll hooks in the first second
- relatable pain points
- curiosity gaps
- UGC trust style
- soft sell but high conversion
- Thai buying psychology
- affiliate basket click behavior
Compliance rules:
- NEVER claim cure, treatment, guaranteed results, 100% effectiveness, or replacing medicine
- Use safer wording such as: a self-care helper, many people use this in their routine, suitable for people who care about themselves
Content must feel native TikTok Thailand, emotional, interesting, and highly watchable.`
  }
};

export function getGemModeConfig(mode){
  return GEM_MODES[mode] || GEM_MODES.signboard;
}

export function getGemModeOptions(){
  return Object.values(GEM_MODES).map(({id,label}) => ({id,label}));
}


export const TEXT_STYLE_LIBRARY = {
  's01_rainbow_bubble': { id:'s01_rainbow_bubble', code:'S-01', label:'Rainbow Bubble', prompt:'"[HOOK TEXT]" in large rounded bubble Thai font, each character different pastel color cycling pink, sky blue, soft yellow, mint green, lavender — thick white outline on every letter, soft grey drop shadow 2px. Sparkle 4-pointed stars scattered, purple and pink hearts floating beside text.' },
  's02_neon_candy_glow': { id:'s02_neon_candy_glow', code:'S-02', label:'Neon Candy Glow', prompt:'"[HOOK TEXT]" in bold rounded Thai font, hot pink fill with cyan neon outer glow, subtle purple inner glow, glossy finish. Floating sparkles and candy stars around text.' },
  's03_gold_luxury_shine': { id:'s03_gold_luxury_shine', code:'S-03', label:'Gold Luxury Shine', prompt:'"[HOOK TEXT]" in premium Thai serif font, metallic gold foil texture, soft bevel shine, elegant shadow beneath. Tiny golden sparkles around letters.' },
  's04_soft_cream_pop': { id:'s04_soft_cream_pop', code:'S-04', label:'Soft Cream Pop', prompt:'"[HOOK TEXT]" in cute rounded Thai font, vanilla cream fill, caramel outline, soft drop shadow. Cookie crumbs and tiny hearts around text.' },
  's05_fire_sale_red': { id:'s05_fire_sale_red', code:'S-05', label:'Fire Sale Red', prompt:'"[HOOK TEXT]" in extra bold Thai font, vivid red fill, bright yellow outline, black shadow impact style. Motion burst lines behind text.' },
  's06_aqua_fresh_splash': { id:'s06_aqua_fresh_splash', code:'S-06', label:'Aqua Fresh Splash', prompt:'"[HOOK TEXT]" in rounded Thai font, turquoise water gradient fill, white glossy highlights, splash droplets around letters.' },
  's07_cotton_candy_dream': { id:'s07_cotton_candy_dream', code:'S-07', label:'Cotton Candy Dream', prompt:'"[HOOK TEXT]" in fluffy rounded Thai font, pink to baby blue soft gradient, white outline, dreamy cloud sparkles.' },
  's08_emerald_luxe_glow': { id:'s08_emerald_luxe_glow', code:'S-08', label:'Emerald Luxe Glow', prompt:'"[HOOK TEXT]" in bold Thai font, emerald green metallic fill, subtle gold edges, luxury shimmer effect.' },
  's09_ice_crystal_shine': { id:'s09_ice_crystal_shine', code:'S-09', label:'Ice Crystal Shine', prompt:'"[HOOK TEXT]" in bold Thai font, frosted ice blue fill, crystal transparency highlights, snow sparkle particles.' },
  's10_comic_boom_pop': { id:'s10_comic_boom_pop', code:'S-10', label:'Comic Boom Pop', prompt:'"[HOOK TEXT]" in comic style Thai font, yellow fill, red outline, black thick shadow, cartoon burst background.' },
  's11_rose_gold_chic': { id:'s11_rose_gold_chic', code:'S-11', label:'Rose Gold Chic', prompt:'"[HOOK TEXT]" in modern Thai font, rose gold metallic fill, glossy reflection, subtle pink sparkle dust.' },
  's12_midnight_neon': { id:'s12_midnight_neon', code:'S-12', label:'Midnight Neon', prompt:'"[HOOK TEXT]" in bold Thai font, electric purple fill with blue neon glow, dark nightclub energy.' },
  's13_lemon_fresh_promo': { id:'s13_lemon_fresh_promo', code:'S-13', label:'Lemon Fresh Promo', prompt:'"[HOOK TEXT]" in rounded Thai font, lemon yellow fill, white outline, fresh citrus sparkle icons.' },
  's14_tri_color_gradient': { id:'s14_tri_color_gradient', code:'S-14', label:'Tri-Color Gradient', prompt:'"[HOOK TEXT]" in bold rounded Thai font, horizontal gradient fill flowing pink (#FF6B9D) to purple (#A855F7) to sky blue (#60A5FA) across entire text. No outline. Sparkle stars in matching colors scattered around. High-end aesthetic gradient finish.' },
  's15_matte_black_luxury': { id:'s15_matte_black_luxury', code:'S-15', label:'Matte Black Luxury', prompt:'"[HOOK TEXT]" in bold Thai font, matte black fill, subtle silver edge, elegant shadow, premium minimalist feel.' },
  's16_orange_energy_blast': { id:'s16_orange_energy_blast', code:'S-16', label:'Orange Energy Blast', prompt:'"[HOOK TEXT]" in bold Thai font, orange gradient fill, yellow glow, motion streaks behind text.' },
  's17_lavender_cute_pop': { id:'s17_lavender_cute_pop', code:'S-17', label:'Lavender Cute Pop', prompt:'"[HOOK TEXT]" in rounded Thai font, lavender fill, white outline, tiny stars and bows around text.' },
  's18_ruby_premium_sale': { id:'s18_ruby_premium_sale', code:'S-18', label:'Ruby Premium Sale', prompt:'"[HOOK TEXT]" in elegant Thai font, ruby red gemstone texture, subtle shine, gold dust particles.' },
  's19_mint_clean_modern': { id:'s19_mint_clean_modern', code:'S-19', label:'Mint Clean Modern', prompt:'"[HOOK TEXT]" in clean Thai sans font, mint green fill, no outline, soft shadow, modern skincare style.' },
  's20_blue_tech_pulse': { id:'s20_blue_tech_pulse', code:'S-20', label:'Blue Tech Pulse', prompt:'"[HOOK TEXT]" in futuristic Thai font, blue gradient fill, glowing circuitry accents around letters.' },
  's21_peach_soft_glow': { id:'s21_peach_soft_glow', code:'S-21', label:'Peach Soft Glow', prompt:'"[HOOK TEXT]" in rounded Thai font, peach gradient fill, white shine, subtle warm glow.' },
  's22_platinum_premium': { id:'s22_platinum_premium', code:'S-22', label:'Platinum Premium', prompt:'"[HOOK TEXT]" in luxury Thai font, platinum metallic fill, reflective highlights, premium sparkle.' },
  's23_hot_pink_viral': { id:'s23_hot_pink_viral', code:'S-23', label:'Hot Pink Viral', prompt:'"[HOOK TEXT]" in bold Thai font, hot pink fill, white outline, flashy sparkles, TikTok viral style.' },
  's24_sky_clean_shine': { id:'s24_sky_clean_shine', code:'S-24', label:'Sky Clean Shine', prompt:'"[HOOK TEXT]" in bold Thai font, sky blue fill, glossy white highlight, fresh clean commercial vibe.' },
  's25_jungle_fresh_bold': { id:'s25_jungle_fresh_bold', code:'S-25', label:'Jungle Fresh Bold', prompt:'"[HOOK TEXT]" in bold Thai font, leaf green fill, earthy glow, tiny leaf particles around text.' },
  's26_sunset_gradient_glow': { id:'s26_sunset_gradient_glow', code:'S-26', label:'Sunset Gradient Glow', prompt:'"[HOOK TEXT]" in bold rounded Thai font, sunset gradient orange to pink to purple, warm cinematic glow.' },
  's27_candy_chrome': { id:'s27_candy_chrome', code:'S-27', label:'Candy Chrome', prompt:'"[HOOK TEXT]" in bubble Thai font, reflective candy chrome texture, rainbow shine, playful highlights.' },
  's28_white_angel_glow': { id:'s28_white_angel_glow', code:'S-28', label:'White Angel Glow', prompt:'"[HOOK TEXT]" in elegant Thai font, pure white fill, soft blue halo glow, dreamy sparkle particles.' },
  's29_black_yellow_urgency': { id:'s29_black_yellow_urgency', code:'S-29', label:'Black Yellow Urgency', prompt:'"[HOOK TEXT]" in bold Thai font, yellow fill, black outline, emergency sale sign style.' },
  's30_ultra_viral_premium_mix': { id:'s30_ultra_viral_premium_mix', code:'S-30', label:'Ultra Viral Premium Mix', prompt:'"[HOOK TEXT]" in bold rounded Thai font, premium pink-purple-blue gradient fill, glossy finish, white micro highlight lines, subtle sparkle stars, luxury viral aesthetic for stop-scroll thumbnails.' }
};

export function getTextStyleOptions(){
  return Object.values(TEXT_STYLE_LIBRARY).map(({id, code, label}) => ({ id, label: `${code} — ${label}` }));
}

const MODE_TEXT_STYLE_MAP = {
  signboard: ['s05_fire_sale_red','s29_black_yellow_urgency','s10_comic_boom_pop'],
  supplement_stop_scroll: ['s14_tri_color_gradient','s19_mint_clean_modern','s20_blue_tech_pulse'],
  food: ['s13_lemon_fresh_promo','s26_sunset_gradient_glow','s06_aqua_fresh_splash'],
  snack: ['s10_comic_boom_pop','s27_candy_chrome','s16_orange_energy_blast'],
  mom_baby: ['s17_lavender_cute_pop','s07_cotton_candy_dream','s21_peach_soft_glow'],
  fashion: ['s11_rose_gold_chic','s22_platinum_premium','s30_ultra_viral_premium_mix'],
  shoes: ['s22_platinum_premium','s15_matte_black_luxury','s11_rose_gold_chic'],
  lingerie: ['s11_rose_gold_chic','s17_lavender_cute_pop','s28_white_angel_glow'],
  skincare: ['s14_tri_color_gradient','s19_mint_clean_modern','s24_sky_clean_shine'],
  home: ['s24_sky_clean_shine','s08_emerald_luxe_glow','s29_black_yellow_urgency'],
  bedding: ['s07_cotton_candy_dream','s21_peach_soft_glow','s28_white_angel_glow'],
  kitchen: ['s06_aqua_fresh_splash','s13_lemon_fresh_promo','s24_sky_clean_shine'],
  bathroom: ['s24_sky_clean_shine','s06_aqua_fresh_splash','s19_mint_clean_modern'],
  cleaning: ['s24_sky_clean_shine','s29_black_yellow_urgency','s16_orange_energy_blast'],
  electronics: ['s20_blue_tech_pulse','s22_platinum_premium','s12_midnight_neon'],
  gardening: ['s25_jungle_fresh_bold','s08_emerald_luxe_glow','s13_lemon_fresh_promo'],
  produce: ['s25_jungle_fresh_bold','s13_lemon_fresh_promo','s26_sunset_gradient_glow'],
  tools: ['s15_matte_black_luxury','s29_black_yellow_urgency','s20_blue_tech_pulse'],
  stationery: ['s01_rainbow_bubble','s17_lavender_cute_pop','s27_candy_chrome'],
  books: ['s03_gold_luxury_shine','s15_matte_black_luxury','s22_platinum_premium'],
  cosmetics: ['s14_tri_color_gradient','s11_rose_gold_chic','s22_platinum_premium']
};

export function getRecommendedTextStyleIdsForMode(mode='signboard'){
  return MODE_TEXT_STYLE_MAP[mode] || MODE_TEXT_STYLE_MAP.signboard;
}

export function getDefaultTextStyleForMode(mode='signboard'){
  const first = getRecommendedTextStyleIdsForMode(mode)[0];
  return TEXT_STYLE_LIBRARY[first] || Object.values(TEXT_STYLE_LIBRARY)[0];
}

export function getTextStylePrompt(styleId='s01_rainbow_bubble'){
  return TEXT_STYLE_LIBRARY[styleId] || getDefaultTextStyleForMode('signboard');
}
