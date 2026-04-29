import { GEM_MODES as BASE_GEM_MODES, pickRandomFrom, getGemModeOptions as baseGetGemModeOptions, autoDetectGemMode as baseAutoDetectGemMode } from './gem-modes.js';

const UNIVERSAL_HYBRID_MASTER_SYSTEM_PROMPT = `
You are a world-class Prompt Engineer and TikTok conversion creative director.
You specialize in creating FINAL READY IMAGE PROMPTS and VIDEO + AUDIO PROMPTS for Gemini, Veo3, Google Flow, Sora, Kling, Runway, and TikTok Shop ads.

MISSION:
- Convert product/category inputs into MASTER PROMPT level outputs.
- Make the result visually cinematic, product-first, conversion-focused, Thai-market native, and ready to paste into AI image/video tools.
- Never output vague outlines, placeholders, or instruction-only structures.

STRICT OUTPUT BEHAVIOR:
- Return final prompts, not strategy notes.
- Every image_prompt must be a complete visual generation prompt.
- Every video_prompt must describe visible motion, product interaction, camera movement, and scene continuity.
- Thai dialogue must sound natural and spoken, not corporate.
- Keep product visible early and often.
- Use vertical 9:16 composition by default.
- Use realistic Thai people, authentic Thai lifestyle, and natural UGC trust unless the selected category DNA says otherwise.

HYBRID FORMULA:
1. Stop-scroll visual hook in the first second.
2. Product reveal fast.
3. Real usage / demo / transformation / texture payoff.
4. Strong emotional or practical benefit.
5. Clear reason to tap the basket.

SAFETY + COMPLIANCE:
- Avoid guaranteed claims, medical cure claims, unrealistic results, extreme before/after promises, and prohibited legal/health claims.
- For supplement, skincare, cosmetics, baby, and health-adjacent products, use soft compliant wording: supports, helps care, routine, feeling, appearance, comfort, confidence.
- No background text, watermark, UI, random logos, unreadable fake signs, or subtitles inside image prompts unless the category explicitly requires a sale sign.
`;

export const CATEGORY_MASTER_DNA = {
  tiktok_live: {
    visualIdentity: 'TikTok Live Commerce Screenshot + Live Selling Video — real phone screen capture feeling, Thai live host, UI comments, hearts, gift notification, viewer count, basket CTA, urgent live-commerce trust.',
    characterStyle: 'Thai / Asian live host, natural seller energy, friendly expressive face, realistic hands holding or demonstrating the product, live speaking expression.',
    environmentStyle: 'Real Thai live room, bedroom, vanity desk, shop corner, warehouse pack station, home counter, beauty table, food table, or product-specific live setup.',
    lightingStyle: 'Realistic phone screen capture lighting, ring light or warm indoor light, clear product visibility, natural skin texture, readable Thai UI overlays.',
    cameraStyle: 'Smartphone vertical 9:16 screen-capture composition, host centered, product close to camera, live comments stacked left, hearts floating right, cart and gift UI bottom area.',
    psychologyTriggers: ['คนดูทะลุแสน', 'คอมเมนต์ถามรัว', 'โปรเฉพาะไลฟ์', 'Gift เด้งไม่หยุด', 'กดตะกร้าด่วน', 'ของใกล้หมด'],
    masterPrompt: `Ultra realistic TikTok Live smartphone screenshot style scene, Thai live host presenting [PRODUCT] naturally to the camera, real TikTok Live UI overlay with username, follow button, viewer count, comment bubbles in Thai, floating hearts, share button, gift notification, bottom comment bar, shopping cart CTA, product clearly visible, live commerce urgency, photographic real phone screen capture look, vertical 9:16, no watermark, no broken Thai text, no fake-looking UI.`,
    sceneFormula: ['HOOK: live host opens with urgent product reveal and viewer/comment surge', 'DEMO: host holds or uses product close to camera while comments ask questions', 'PROOF: comments, viewer count, gift animation, repeated demand/social proof', 'CTA: host points to basket/cart and announces live-only promo'],
    negativePrompt: 'no cartoon, no 3D, no illustration, no broken Thai text, no fake app UI, no watermark, no distorted hands, no extra limbs, no prohibited claims'
  },

  signboard: {
    visualIdentity: 'Yellow Sign Shock Sale Chaos Store — Thai retail clearance, urgent crowd energy, product stacks, bold sale sign feeling, fast UGC discovery.',
    characterStyle: 'Thai shop staff or Thai shopper, natural UGC style, expressive shock/interest, realistic hands touching product.',
    environmentStyle: 'Busy Thai storefront, department store aisle, market booth, warehouse sale zone, packed shelves, real shoppers blurred behind.',
    lightingStyle: 'Bright retail lighting, high clarity, energetic contrast, product and yellow sign readable as hero objects.',
    cameraStyle: 'Fast push-in to yellow sign, handheld POV discovery, rack focus from sign to product, product stack hero close-up.',
    psychologyTriggers: ['ราคาช็อก', 'ล้างสต๊อก', 'ของใกล้หมด', 'คนรุมซื้อ', 'หมดแล้วหมดเลย'],
    masterPrompt: `Ultra realistic Thai retail clearance sale scene, [PRODUCT] displayed in large stacks with a striking yellow sale sign nearby, Thai shoppers walking and stopping in the background, Thai shop staff pointing at the product, urgent stop-scroll retail energy, busy store atmosphere, product-first composition, handheld TikTok UGC realism, bright commercial lighting, sharp product details, vertical 9:16, no watermark, no random background text except the intended sale sign.`,
    sceneFormula: ['HOOK: fast zoom to yellow sale sign and product stack', 'DEMO: hand picks up product and shows size/value', 'PROOF: shoppers crowd or shelves look almost sold out', 'CTA: product held toward camera with urgent basket reason'],
    negativePrompt: 'no fake brand logos, no messy unreadable signs, no medical claims, no exaggerated guarantee, no watermark'
  },
  supplement_stop_scroll: {
    visualIdentity: 'Premium UGC Health Trust — calm Thai lifestyle, routine-based wellness, trustworthy product reveal, compliant soft benefit language.',
    characterStyle: 'Thai adult presenter age 25-45, clean healthy look, warm believable expression, no doctor impersonation unless provided.',
    environmentStyle: 'Clean bedroom, work desk, kitchen counter, morning routine area, family living room, soft health lifestyle setting.',
    lightingStyle: 'Soft morning light, clean natural highlights, trustworthy wellness palette, no clinical fear-mongering.',
    cameraStyle: 'UGC close-up product reveal, routine demonstration, hand-to-camera bottle shot, calm push-in, lifestyle insert shots.',
    psychologyTriggers: ['ดูแลตัวเองตอนนี้ยังทัน', 'รูทีนสุขภาพ', 'คนวัยทำงานต้องดู', 'ใช้เป็นตัวช่วย', 'น่าเชื่อถือ'],
    masterPrompt: `Ultra realistic Thai wellness UGC scene, Thai presenter showing [PRODUCT] as part of a daily self-care routine, clean trustworthy home environment, soft morning light, product label facing camera, natural hand interaction, gentle health lifestyle mood, premium but believable TikTok review style, no medical cure claims, no extreme before-after, vertical 9:16, no watermark, no background text.`,
    sceneFormula: ['HOOK: relatable lifestyle pain or routine moment', 'REVEAL: product appears within first 3 seconds', 'DEMO: show how it fits into daily routine', 'PAYOFF: calmer, more confident self-care feeling', 'CTA: soft basket click reason'],
    negativePrompt: 'no cure claims, no guaranteed results, no hospital fear visuals, no fake doctor, no disease diagnosis, no watermark'
  },
  food: {
    visualIdentity: 'Cinematic Thai Food Commercial — steam, texture, craving, close-up bite, authentic Thai food host and kitchen/table setting.',
    characterStyle: 'Thai food host or home cook, warm expressive face, natural appetite reaction, realistic hands and eating motion.',
    environmentStyle: 'Thai kitchen, street food table, dining table, restaurant counter, warm home food atmosphere.',
    lightingStyle: 'Warm appetizing food lighting, glossy highlights, steam backlight, cinematic depth of field.',
    cameraStyle: 'Macro texture close-up, spoon lift, steam reveal, cutting/breaking shot, top-view plating, slow push-in.',
    psychologyTriggers: ['เห็นแล้วหิว', 'น้ำลายไหล', 'กลิ่นเหมือนถึงจอ', 'กินซ้ำง่าย', 'เมนูนี้ห้ามเลื่อน'],
    masterPrompt: `Ultra realistic cinematic Thai food commercial, [PRODUCT] served hot and appetizing, visible steam rising, glossy sauce and detailed texture, Thai presenter naturally presenting or tasting, authentic Thai kitchen or dining table, macro food close-up, spoon lift, warm cinematic lighting, delicious craving mood, vertical 9:16, no watermark, no background text.`,
    sceneFormula: ['HOOK: steam/bite/cheese-pull/spoon-lift close-up', 'DEMO: open pack or prepare food', 'TEXTURE: sauce, crunch, steam, freshness', 'PAYOFF: presenter reaction and serving shot', 'CTA: basket reason for hunger moment'],
    negativePrompt: 'no rotten food, no dirty kitchen, no fake text, no distorted hands, no watermark'
  },
  snack: {
    visualIdentity: 'Crunch ASMR Viral Snack — crispy sound imagination, bright pack reveal, addictive snack texture, fun Thai UGC energy.',
    characterStyle: 'Thai teen/adult snack reviewer, playful expression, natural hand-to-mouth motion, casual friendly style.',
    environmentStyle: 'Desk snack time, sofa, car snack moment, picnic table, colorful lifestyle setup.',
    lightingStyle: 'Bright fun lighting, crisp highlights on snack surface, vibrant packaging clarity.',
    cameraStyle: 'Pack tear-open, hand grabs snack, macro crunch break, pour into bowl, reaction close-up.',
    psychologyTriggers: ['กรอบจนต้องเปิดเสียง', 'กินเพลิน', 'ถุงเดียวไม่พอ', 'สายกินเล่นต้องดู', 'ซื้อซ้ำง่าย'],
    masterPrompt: `Ultra realistic viral Thai snack UGC scene, [PRODUCT] pack opened toward camera, crispy snack pieces shown in macro detail, Thai reviewer holding and tasting with fun expression, bright colorful snack-time setup, crunch ASMR visual feeling, product packaging clear and centered, vertical 9:16, no watermark, no random background text.`,
    sceneFormula: ['HOOK: tear open pack + close-up texture', 'CRUNCH: break/snack bite macro shot', 'TASTE: Thai reviewer reaction', 'VALUE: show amount/pack size/flavor', 'CTA: casual basket click'],
    negativePrompt: 'no messy crumbs covering product, no fake logos, no watermark, no unappetizing colors'
  },
  mom_baby: {
    visualIdentity: 'Warm Safe Family Lifestyle — gentle, soft, clean, parent trust, baby comfort, practical motherhood solution.',
    characterStyle: 'Thai mother or parent figure, warm caring expression, gentle hand movement, baby/toddler shown safely and respectfully if needed.',
    environmentStyle: 'Clean nursery, family bedroom, baby changing station, warm living room, soft safe home setting.',
    lightingStyle: 'Soft warm daylight, pastel tones, clean safe atmosphere, low contrast, comforting highlights.',
    cameraStyle: 'Gentle product close-up, parent hand demo, soft push-in, before/after organization, baby-safe distance.',
    psychologyTriggers: ['แม่ ๆ ต้องดู', 'ลูกสบายแม่แฮปปี้', 'ชีวิตแม่ง่ายขึ้น', 'อ่อนโยน', 'ใช้จริงในบ้าน'],
    masterPrompt: `Ultra realistic warm Thai mom and baby lifestyle scene, Thai mother gently demonstrating [PRODUCT] in a clean safe nursery or family home, soft pastel environment, caring expression, product clearly visible, practical parent-friendly usage, gentle trustworthy mood, vertical 9:16, no watermark, no unsafe baby handling, no background text.`,
    sceneFormula: ['HOOK: common parent problem shown gently', 'REVEAL: product enters frame clearly', 'DEMO: safe practical use by parent', 'PAYOFF: baby/parent comfort and easier routine', 'CTA: soft recommendation for parents'],
    negativePrompt: 'no unsafe baby pose, no fear claims, no medical claims, no messy unsafe room, no watermark'
  },
  fashion: {
    visualIdentity: 'Luxury Thai Fashion Campaign — premium outfit styling, fabric movement, confidence, editorial + TikTok OOTD hybrid.',
    characterStyle: 'Attractive Thai model age 20-30, authentic Thai features, confident expression, natural body movement, stylish hair and makeup.',
    environmentStyle: 'Luxury mall, clean studio, rooftop, Bangkok condo, Korean cafe, mirror fitting room, modern street.',
    lightingStyle: 'Premium fashion lighting, soft shadows, luxury color grading, glowing skin tones, crisp fabric highlights.',
    cameraStyle: 'Full-body walk, spin, mirror reveal, close-up fabric, waist/detail shot, slow push-in, runway-style movement.',
    psychologyTriggers: ['ใส่แล้วดูแพง', 'ลุคนี้คนทัก', 'แมตช์ง่าย', 'มั่นใจขึ้น', 'หมดไวทุกไซซ์'],
    masterPrompt: `Ultra realistic fashion commercial photoshoot, attractive Thai model wearing [PRODUCT], confident walking pose, fabric flowing naturally, premium outfit styling, luxury modern environment, full-body composition plus close-up clothing texture, cinematic fashion advertisement lighting, realistic skin and hands, high-end TikTok OOTD mood, vertical 9:16, no watermark, no logo, no background text.`,
    sceneFormula: ['HOOK: model entrance or mirror reveal', 'SHOWCASE: walk/spin to show silhouette', 'DETAIL: fabric, stitching, fit, movement close-up', 'STYLE: match with accessories or second look', 'CTA: confidence/value reason'],
    negativePrompt: 'no distorted body, no extra limbs, no wardrobe malfunction, no random brand logos, no watermark'
  },
  shoes: {
    visualIdentity: 'Footwear Hero Ad — comfort, sole flexibility, walking confidence, outfit matching, clean product close-ups.',
    characterStyle: 'Thai model or everyday user, natural walking, confident feet/leg movement, casual lifestyle style.',
    environmentStyle: 'City walkway, mall floor, office corridor, bedroom, streetwear corner, clean product display surface.',
    lightingStyle: 'Crisp commercial lighting, reflective floor highlights, clear material texture, lifestyle realism.',
    cameraStyle: 'Low-angle walking shot, foot step close-up, sole bend demo, outfit match pan, product hero rotation.',
    psychologyTriggers: ['เดินสบาย', 'คู่นี้ต้องมี', 'ใส่ได้ทุกวัน', 'แมตช์ง่าย', 'คุ้ม'],
    masterPrompt: `Ultra realistic Thai footwear commercial, [PRODUCT] worn by Thai model walking naturally, low-angle close-up of shoes, clear sole and material details, stylish outfit match, clean lifestyle environment, comfortable walking mood, premium product hero lighting, vertical 9:16, no watermark, no random text.`,
    sceneFormula: ['HOOK: stylish first step into frame', 'DEMO: walking and sole flexibility', 'DETAIL: material, stitching, cushion, grip close-up', 'STYLE: match with outfit', 'CTA: daily comfort reason'],
    negativePrompt: 'no distorted feet, no extra toes, no dirty product, no fake logos, no watermark'
  },
  lingerie: {
    visualIdentity: 'Elegant Soft Comfort Fashion — tasteful, comfort-focused, fabric detail, confidence without sexualization.',
    characterStyle: 'Thai female model or presenter, tasteful confident styling, modest framing, natural comfort expression.',
    environmentStyle: 'Clean dressing room, vanity table, soft bedroom flat lay, premium fabric display, mirror corner with respectful angles.',
    lightingStyle: 'Soft elegant light, smooth fabric highlights, pastel/luxury tones, gentle shadows.',
    cameraStyle: 'Product flat lay, fabric stretch demo, strap/hook detail, under-clothing smoothness demo using outerwear/mannequin.',
    psychologyTriggers: ['ใส่สบาย', 'มั่นใจ', 'เนียนใต้ชุด', 'ไม่อึดอัด', 'ของดีบอกต่อ'],
    masterPrompt: `Ultra realistic tasteful lingerie product commercial, [PRODUCT] shown elegantly on clean premium display or worn in modest fashion styling, Thai presenter demonstrating soft fabric stretch and smooth fit respectfully, comfort-first mood, clean dressing room or vanity environment, premium soft lighting, vertical 9:16, no sexualized pose, no nudity, no watermark, no background text.`,
    sceneFormula: ['HOOK: fabric softness or smooth-fit reveal', 'DEMO: stretch/support/detail close-up', 'STYLE: show under outerwear or flat lay set', 'PAYOFF: confident comfortable movement', 'CTA: comfort reason'],
    negativePrompt: 'no nudity, no explicit pose, no sexualization, no body distortion, no watermark'
  },
  skincare: {
    visualIdentity: 'Glow Skin Luxury Beauty — texture payoff, routine ritual, glass-skin visual, premium clean beauty shelf.',
    characterStyle: 'Thai beauty presenter, clean face, natural glow, calm confident expression, realistic skin texture.',
    environmentStyle: 'Vanity table, clean bathroom, beauty shelf, morning window light, Watsons/Eveandboy-style beauty aisle if store context.',
    lightingStyle: 'Soft dewy beauty lighting, glossy highlights, natural reflections, luxury skincare palette.',
    cameraStyle: 'Dropper/cream macro, texture smear on hand, face application, product rotation, glow close-up.',
    psychologyTriggers: ['ผิวดูฉ่ำ', 'รูทีนผิวสวย', 'เนื้อดี', 'สาวรักผิวต้องดู', 'ใช้ทุกวัน'],
    masterPrompt: `Ultra realistic luxury skincare UGC scene, Thai beauty presenter applying [PRODUCT] as part of a daily skincare routine, macro close-up of cream or serum texture, dewy glow on skin, clean vanity or bathroom environment, product packaging clear and centered, soft premium beauty lighting, realistic skin texture, compliant beauty language, vertical 9:16, no watermark, no background text.`,
    sceneFormula: ['HOOK: texture/glow macro close-up', 'REVEAL: product bottle/jar facing camera', 'DEMO: apply on hand or face', 'PAYOFF: skin appears hydrated/glowy', 'CTA: daily routine reason'],
    negativePrompt: 'no medical cure claims, no impossible whitening, no fake before-after, no plastic skin, no watermark'
  },
  home: {
    visualIdentity: 'Clean Organized Smart Home — before/after home hack, practical Thai household solution, satisfying organization.',
    characterStyle: 'Thai homeowner or creator, practical friendly style, hands demonstrating product clearly.',
    environmentStyle: 'Thai living room, storage corner, condo, closet, entryway, clean modern home.',
    lightingStyle: 'Bright clean home lighting, natural daylight, organized satisfying look.',
    cameraStyle: 'Before/after reveal, installation close-up, hand demo, pan across organized space, top-down usage shot.',
    psychologyTriggers: ['บ้านเป็นระเบียบ', 'ชีวิตง่ายขึ้น', 'ของมันต้องมี', 'ประหยัดพื้นที่', 'ใช้จริงทุกวัน'],
    masterPrompt: `Ultra realistic Thai smart home product scene, [PRODUCT] used in a clean modern Thai home to organize or solve a daily problem, clear before-after feeling, Thai creator demonstrating practical usage with hands, satisfying neat result, bright natural home lighting, product-first composition, vertical 9:16, no watermark, no random background text.`,
    sceneFormula: ['HOOK: messy/problem corner', 'REVEAL: product enters frame', 'DEMO: install/use step clearly', 'PAYOFF: clean organized after shot', 'CTA: home must-have reason'],
    negativePrompt: 'no clutter blocking product, no unsafe installation, no fake text, no watermark'
  },
  bedding: {
    visualIdentity: 'Cozy Luxury Bedroom — soft fabric, hotel mood, comfort, sleep desire, room transformation.',
    characterStyle: 'Thai lifestyle presenter or soft hand demo, relaxed comfortable expression, no overacting.',
    environmentStyle: 'Modern bedroom, hotel-style bed, warm morning light, cozy condo room, premium bedding setup.',
    lightingStyle: 'Soft warm bedroom light, morning glow, gentle shadows, fabric texture highlights.',
    cameraStyle: 'Bed-making reveal, fabric rub close-up, pillow fluff, blanket toss, slow push-in to cozy bed.',
    psychologyTriggers: ['นุ่มน่านอน', 'ห้องดูแพง', 'แต่งห้องง่าย', 'ฟีลโรงแรม', 'หลับสบายขึ้น'],
    masterPrompt: `Ultra realistic cozy luxury bedroom commercial, [PRODUCT] displayed on a beautifully made bed, Thai lifestyle presenter or hands smoothing soft fabric, pillow fluff and blanket texture visible, warm morning light, hotel-like premium room transformation, inviting sleep mood, vertical 9:16, no watermark, no background text.`,
    sceneFormula: ['HOOK: blanket toss or bed transformation', 'DEMO: touch/rub/fold fabric', 'DETAIL: texture and color close-up', 'PAYOFF: cozy hotel-like bedroom shot', 'CTA: room upgrade reason'],
    negativePrompt: 'no dirty bed, no messy room, no distorted fabric, no watermark'
  },
  kitchen: {
    visualIdentity: 'Smart Cooking Utility — kitchen hack, food prep efficiency, clean useful demo, Thai home cooking context.',
    characterStyle: 'Thai home cook or presenter, practical energetic style, realistic hand usage, cooking confidence.',
    environmentStyle: 'Modern Thai kitchen, sink counter, stove area, food prep table, organized kitchen drawer.',
    lightingStyle: 'Clean bright kitchen lighting, natural highlights, stainless/wood reflections, food-safe clarity.',
    cameraStyle: 'Top-down prep demo, hand close-up, one-motion use, before/after kitchen organization, product hero on counter.',
    psychologyTriggers: ['เข้าครัวง่ายขึ้น', 'ประหยัดเวลา', 'แม่บ้านต้องมี', 'ใช้ง่าย', 'ครัวเป็นระเบียบ'],
    masterPrompt: `Ultra realistic Thai kitchen utility commercial, Thai home cook demonstrating [PRODUCT] on a clean kitchen counter, practical cooking or food-prep action, clear hand interaction, organized modern kitchen background, product-first demo, bright food-safe lighting, satisfying time-saving mood, vertical 9:16, no watermark, no background text.`,
    sceneFormula: ['HOOK: annoying kitchen problem', 'REVEAL: product solution on counter', 'DEMO: real use in one clear action', 'PAYOFF: faster/cleaner prep result', 'CTA: kitchen must-have reason'],
    negativePrompt: 'no dirty kitchen, no unsafe knife action, no fake text, no watermark'
  },
  bathroom: {
    visualIdentity: 'Clean Bathroom Premium — freshness, hygiene, organization, water-resistant practical daily use.',
    characterStyle: 'Thai homeowner hands/demo, clean practical style, no unnecessary face close-up unless useful.',
    environmentStyle: 'Modern bathroom, sink area, shower corner, vanity shelf, clean tile wall, compact condo bathroom.',
    lightingStyle: 'Bright clean bathroom light, fresh reflections, white/neutral tones, water sparkle highlights.',
    cameraStyle: 'Install/use close-up, water test, before/after shelf organization, sink counter hero shot.',
    psychologyTriggers: ['ห้องน้ำดูดีขึ้น', 'สะอาดเป็นระเบียบ', 'ใช้ทุกวัน', 'ติดตั้งง่าย', 'ของมันต้องมี'],
    masterPrompt: `Ultra realistic clean Thai bathroom product scene, [PRODUCT] installed or used in a modern bathroom, clear practical demonstration, fresh water and tile reflections, organized sink or shower area, bright clean lighting, satisfying hygiene and convenience mood, vertical 9:16, no watermark, no random background text.`,
    sceneFormula: ['HOOK: messy bathroom problem', 'REVEAL: product placement', 'DEMO: install/use/water test', 'PAYOFF: clean organized after shot', 'CTA: bathroom upgrade reason'],
    negativePrompt: 'no dirty toilet focus, no mold exaggeration, no unsafe installation, no watermark'
  },
  laundry: {
    visualIdentity: 'Before After Cleaning Viral — stain/laundry/cleaning demo, satisfying transformation, practical Thai household proof.',
    characterStyle: 'Thai homemaker or creator hands, practical energetic, credible demo style.',
    environmentStyle: 'Laundry room, washing machine corner, bathroom floor, sink, cleaning station, Thai home area.',
    lightingStyle: 'Bright clarity lighting, clean highlights, visible texture and foam/water movement.',
    cameraStyle: 'Pour/spray/scrub close-up, before/after split feeling, foam macro, clean result reveal.',
    psychologyTriggers: ['งานบ้านง่ายขึ้น', 'เห็นผลลัพธ์ชัด', 'ประหยัดแรง', 'แม่บ้านต้องดู', 'สะอาดขึ้น'],
    masterPrompt: `Ultra realistic Thai cleaning and laundry demo scene, [PRODUCT] used on clothes, floor, stain, or household surface, visible foam/water/action, Thai creator demonstrating with hands, satisfying before-after cleaning result, bright practical home lighting, product label visible, vertical 9:16, no watermark, no fake text.`,
    sceneFormula: ['HOOK: stain/mess/problem close-up', 'REVEAL: product applied', 'DEMO: scrub/wash/pour action', 'PAYOFF: visibly cleaner result', 'CTA: save effort reason'],
    negativePrompt: 'no dangerous chemical misuse, no extreme impossible cleaning guarantee, no fake text, no watermark'
  },
  appliance: {
    visualIdentity: 'Gadget Product Hero — function demo, smart convenience, modern Thai home tech, clear cause-effect.',
    characterStyle: 'Thai creator or household user, practical excited expression, hands operating device.',
    environmentStyle: 'Modern home, kitchen, desk, living room, bedroom, compact condo, clean product demo area.',
    lightingStyle: 'Clean tech commercial lighting, crisp reflections, LED/product detail highlights.',
    cameraStyle: 'Button press close-up, product operation demo, before/after effect, hero rotation, POV usage shot.',
    psychologyTriggers: ['ชีวิตง่ายขึ้น', 'ฟังก์ชันดี', 'คุ้ม', 'ของมันต้องมี', 'ใช้ง่าย'],
    masterPrompt: `Ultra realistic Thai gadget and appliance commercial, [PRODUCT] operating in a modern Thai home, Thai creator pressing buttons and demonstrating real function, clear cause-and-effect result, product hero close-up with crisp material details, clean tech lifestyle lighting, vertical 9:16, no watermark, no random text.`,
    sceneFormula: ['HOOK: daily inconvenience', 'REVEAL: appliance/gadget hero shot', 'DEMO: turn on and show function', 'PAYOFF: easier/faster result', 'CTA: value reason'],
    negativePrompt: 'no sparks/fire unless safe cooking context, no broken device, no fake UI text, no watermark'
  },
  garden: {
    visualIdentity: 'Fresh Green Garden Life — plants, soil, water, satisfying gardening action, outdoor calm productivity.',
    characterStyle: 'Thai gardener or plant lover, natural hands-on style, relaxed happy expression.',
    environmentStyle: 'Thai home garden, balcony garden, plant shelf, backyard, nursery, green outdoor area.',
    lightingStyle: 'Fresh natural daylight, green highlights, water sparkle, earthy warm tones.',
    cameraStyle: 'Watering close-up, pruning action, soil handling, plant before/after, garden pan reveal.',
    psychologyTriggers: ['สวนดูดีขึ้น', 'สายปลูกต้องดู', 'ใช้ง่าย', 'คนรักต้นไม้ต้องมี', 'ปลูกสนุก'],
    masterPrompt: `Ultra realistic Thai gardening lifestyle scene, Thai plant lover using [PRODUCT] in a fresh green garden or balcony, close-up of plants, soil, water droplets, practical gardening action, calm satisfying outdoor mood, natural daylight, product clearly visible, vertical 9:16, no watermark, no background text.`,
    sceneFormula: ['HOOK: plant/garden problem', 'REVEAL: tool/product in hand', 'DEMO: watering/pruning/planting action', 'PAYOFF: garden looks healthier/neater', 'CTA: garden must-have reason'],
    negativePrompt: 'no dead plants as final shot, no unsafe tool use, no fake text, no watermark'
  },
  produce: {
    visualIdentity: 'Fresh Market Premium — juicy, colorful, crisp, healthy, market-to-table freshness.',
    characterStyle: 'Thai vendor, Thai shopper, or home cook, natural hand picking/slicing fruit/vegetable.',
    environmentStyle: 'Fresh market stall, kitchen counter, fruit basket, farm table, clean grocery display.',
    lightingStyle: 'Fresh natural light, juicy highlights, vibrant color, crisp texture clarity.',
    cameraStyle: 'Slice/open reveal, water rinse, basket close-up, hand pick, macro juice/freshness shot.',
    psychologyTriggers: ['สดมาก', 'เห็นแล้วอยากกิน', 'สายสุขภาพ', 'คุ้มค่า', 'ของสดวันนี้'],
    masterPrompt: `Ultra realistic fresh Thai produce commercial, [PRODUCT] displayed beautifully with vibrant natural colors, Thai shopper or vendor holding and presenting freshness, close-up slice or rinse shot showing juicy/crisp texture, clean market or kitchen setting, fresh daylight, healthy appetizing mood, vertical 9:16, no watermark, no background text.`,
    sceneFormula: ['HOOK: slice/open/rinse freshness reveal', 'DETAIL: color, juice, crisp texture', 'USAGE: plate/salad/cooking prep', 'PAYOFF: fresh healthy table shot', 'CTA: fresh deal reason'],
    negativePrompt: 'no rotten produce, no dirty market focus, no fake labels, no watermark'
  },
  tools: {
    visualIdentity: 'Power Tool Strong Action — durable, practical, DIY proof, close-up real work, Thai home repair context.',
    characterStyle: 'Thai handyman, DIY creator, or homeowner, safety-conscious, confident hands-on demonstration.',
    environmentStyle: 'Workshop bench, garage, home repair corner, construction material table, organized tool area.',
    lightingStyle: 'Strong crisp workshop lighting, metallic highlights, clear material texture, practical realism.',
    cameraStyle: 'Drill/screw/cut close-up, grip detail, tool kit reveal, action proof, low-angle power hero shot.',
    psychologyTriggers: ['สายช่างต้องดู', 'จบงานไว', 'แข็งแรง', 'ของต้องมีติดบ้าน', 'คุ้ม'],
    masterPrompt: `Ultra realistic Thai DIY tool commercial, Thai handyman safely using [PRODUCT] on a workshop bench or home repair task, close-up of tool action, strong material details, practical proof of use, organized tool environment, crisp workshop lighting, product-first hero shot, vertical 9:16, no watermark, no random text.`,
    sceneFormula: ['HOOK: repair problem or action close-up', 'REVEAL: tool in hand', 'DEMO: real drilling/screwing/fixing action safely', 'PAYOFF: completed task', 'CTA: tool must-have reason'],
    negativePrompt: 'no unsafe injury, no sparks near face, no weapon framing, no fake text, no watermark'
  },
  stationery: {
    visualIdentity: 'Cute Desk Setup — aesthetic study/work desk, satisfying writing, pastel organization, collectible appeal.',
    characterStyle: 'Thai student/office creator hands, cute calm style, neat writing and organizing motion.',
    environmentStyle: 'Study desk, office desk, planner setup, school supplies flat lay, pastel workspace.',
    lightingStyle: 'Soft bright desk lighting, pastel color harmony, clean paper texture, cozy productivity mood.',
    cameraStyle: 'Top-down writing demo, pen stroke close-up, color swatch, organizer before/after, flat lay hero.',
    psychologyTriggers: ['สายเรียนต้องดู', 'โต๊ะดูดีขึ้น', 'น่ารักจนต้องกด', 'เขียนลื่น', 'ซื้อซ้ำง่าย'],
    masterPrompt: `Ultra realistic cute Thai stationery desk setup, [PRODUCT] arranged on a clean aesthetic study desk, Thai creator hands writing, highlighting, or organizing, close-up of paper texture and product detail, pastel cozy productivity mood, soft bright lighting, vertical 9:16, no watermark, no random background text.`,
    sceneFormula: ['HOOK: satisfying pen stroke/color swatch', 'REVEAL: product set flat lay', 'DEMO: writing/organizing action', 'PAYOFF: beautiful desk setup', 'CTA: study/work must-have reason'],
    negativePrompt: 'no illegible random text, no messy desk blocking product, no watermark'
  },
  books: {
    visualIdentity: 'Cozy Intellectual Lifestyle — page flip, practical learning, BookTok trust, calm aspirational reading.',
    characterStyle: 'Thai reader, student, parent, or creator, thoughtful friendly expression, hands flipping pages.',
    environmentStyle: 'Warm reading desk, bookshelf corner, cafe table, bedroom reading nook, study room.',
    lightingStyle: 'Warm cozy reading light, paper texture highlights, calm premium shadows.',
    cameraStyle: 'Book cover reveal, page flip close-up, highlight/note-taking, shelf placement, over-shoulder reading.',
    psychologyTriggers: ['อ่านง่าย', 'เล่มนี้คนพูดถึง', 'ใช้ได้จริง', 'เริ่มต้นได้เลย', 'เก็บเข้าชั้น'],
    masterPrompt: `Ultra realistic Thai BookTok lifestyle scene, [PRODUCT] book shown clearly on a cozy reading desk, Thai reader flipping pages and highlighting useful sections, warm lamp light, calm intellectual mood, cover and page texture visible without copying copyrighted text, vertical 9:16, no watermark, no random background text.`,
    sceneFormula: ['HOOK: book cover/page flip reveal', 'VALUE: show chapter/page layout generally', 'USAGE: highlight/note/read moment', 'PAYOFF: reader inspired or confident', 'CTA: why this book is worth adding'],
    negativePrompt: 'no readable copyrighted page reproduction, no fake author claims, no watermark, no random text'
  },
  cosmetics: {
    visualIdentity: 'Luxury Beauty God Mode — texture payoff, makeup transformation, beauty counter, Thai/K-beauty luxury UGC hybrid.',
    characterStyle: 'Thai beauty model or presenter, polished but natural, expressive eyes, soft glam or clean-girl look.',
    environmentStyle: 'Beauty counter, Watsons/Eveandboy/Sephora-style aisle, vanity mirror, ring light review setup, luxury beauty shelf.',
    lightingStyle: 'Premium beauty lighting, glossy highlights, soft skin glow, reflective packaging, luxury color grading.',
    cameraStyle: 'Swatch macro, one-swipe application, mirror reveal, product rotation, before/after half-face respectfully, close-up finish.',
    psychologyTriggers: ['แต่งแล้วดูแพง', 'สีนี้ไวรัล', 'เท็กซ์เจอร์สวย', 'ตัวนี้คนถาม', 'ของมันต้องมีสายบิวตี้'],
    masterPrompt: `Ultra realistic luxury Thai beauty cosmetics commercial, Thai beauty presenter applying [PRODUCT], macro texture payoff, swatch on hand or lips/cheek/eye, product packaging facing camera, premium beauty counter or vanity setup, glossy reflections, soft glam finish, TikTok beauty review energy, vertical 9:16, no watermark, no random background text.`,
    sceneFormula: ['HOOK: texture/swatch/one-swipe close-up', 'REVEAL: packaging hero shot', 'DEMO: apply product on face/hand', 'PAYOFF: polished beauty finish', 'CTA: beauty must-have reason'],
    negativePrompt: 'no impossible skin claims, no medical claims, no distorted face, no messy makeup, no watermark'
  }
};

function buildCategorySystemPrompt(mode, base, dna){
  return `${UNIVERSAL_HYBRID_MASTER_SYSTEM_PROMPT}

SELECTED CATEGORY: ${base.label || mode}
CATEGORY DESCRIPTION: ${base.description || ''}

CATEGORY MASTER DNA:
- Visual identity: ${dna.visualIdentity}
- Character style: ${dna.characterStyle}
- Environment style: ${dna.environmentStyle}
- Lighting style: ${dna.lightingStyle}
- Camera style: ${dna.cameraStyle}
- Psychology triggers: ${(dna.psychologyTriggers || []).join(', ')}

MASTER IMAGE PROMPT TEMPLATE:
${dna.masterPrompt}

SCENE FORMULA:
${(dna.sceneFormula || []).map((x, i) => `${i + 1}. ${x}`).join('\n')}

NEGATIVE PROMPT / AVOID:
${dna.negativePrompt}

OUTPUT REQUIREMENTS:
- Use the selected category DNA strongly.
- Keep product lock strict when image/product reference is available.
- Generate image_prompt and video_prompt as final polished prompts.
- Keep captions/hashtags separate from image prompts unless requested.
- Final image prompts should be single complete prompt blocks, not JSON schema explanations.
- Final video prompts should include visible action, camera movement, and continuity.
`;
}

function mergeMode(mode, base){
  const dna = CATEGORY_MASTER_DNA[mode];
  if (!dna) return base;
  return {
    ...base,
    ...dna,
    masterPromptVersion: 'MASTER_PROMPT_PRO_MAX_HYBRID_C_V1',
    engineType: 'Gemini + Veo3 + TikTok Hybrid Master Prompt Engine',
    systemPrompt: buildCategorySystemPrompt(mode, base, dna)
  };
}

export const GEM_MODES = Object.fromEntries(
  Object.entries(BASE_GEM_MODES).map(([mode, base]) => [mode, mergeMode(mode, base)])
);

// Keep compatibility for projects that added cosmetics after object creation.
if (BASE_GEM_MODES.cosmetics && !GEM_MODES.cosmetics) {
  GEM_MODES.cosmetics = mergeMode('cosmetics', BASE_GEM_MODES.cosmetics);
}

export function getGemModeConfig(mode){
  return GEM_MODES[mode] || GEM_MODES.signboard;
}

export function getGemModeOptions(){
  return baseGetGemModeOptions();
}

export function autoDetectGemMode(productName = ''){
  return baseAutoDetectGemMode(productName);
}

export { pickRandomFrom };
export { getTextStyleOptions, getH2StyleOptions, getTextStyleConfig, getH2StyleConfig, getRecommendedTextStyles } from './gem-modes.js';
