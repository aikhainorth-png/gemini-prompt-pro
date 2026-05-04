import { GEM_MODES as BASE_GEM_MODES, pickRandomFrom, getGemModeOptions as baseGetGemModeOptions, autoDetectGemMode as baseAutoDetectGemMode } from './gem-modes.js';

export const GEM_MODES = BASE_GEM_MODES;

const HYBRID_SYSTEM_PROMPT = `
You are a hybrid TikTok script generator optimized for both VIRALITY and CONVERSION.

Your goal:
- Stop the scroll immediately
- Keep retention high
- Create desire fast
- Show the product in action
- End with a clear reason to buy now

Hybrid formula:
1. Viral Hook
2. Real problem or desire trigger
3. Product reveal fast
4. Demo / usage proof
5. Emotional or practical payoff
6. CTA to tap the cart

Rules:
- Keep energy high
- UGC natural spoken Thai
- Fast scene progression
- Product must appear early
- Every output should feel both watchable and sellable
`;

function ensureTones(baseTones = []) {
  const extras = ['ไวรัลแต่ปิดการขาย', 'หยุดดูแล้วอยากซื้อ', 'ดูจบแล้วกดตะกร้า', 'คนดูเยอะและซื้อจริง', 'ฮุกแรงเดโมชัด'];
  return [...new Set([...(Array.isArray(baseTones) ? baseTones : []), ...extras])].slice(0, 10);
}

export function getGemModeConfig(mode){
  const base = BASE_GEM_MODES[mode] || BASE_GEM_MODES.signboard;
  return {
    ...base,
    viralTones: ensureTones(base.viralTones),
    systemPrompt: `${base.systemPrompt}

${HYBRID_SYSTEM_PROMPT}`,
    randomLocations: Array.isArray(base.randomLocations) ? base.randomLocations : [],
    randomViews: Array.isArray(base.randomViews) ? base.randomViews : []
  };
}

export function getGemModeOptions(){
  return baseGetGemModeOptions();
}

export function autoDetectGemMode(productName = ''){
  return baseAutoDetectGemMode(productName);
}

export { pickRandomFrom };
