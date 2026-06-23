export function buildPromptBundleSchema(){
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      image_prompt: {
        type: 'string',
        description: `Final image generation prompt ready to use.

Strict image scene rules:
- Every requested image scene must use exact scene headers inside this string: SCENE_1_IMAGE_PROMPT:, SCENE_2_IMAGE_PROMPT:, ... until the requested scene count.
- Every SCENE_n_IMAGE_PROMPT must include VISUAL: with main subject, product, character/hand interaction, environment/background, lighting, and camera composition.
- AUTO PRODUCT INSERT + AUTO HOOK VISUAL SCENE 1: SCENE_1_IMAGE_PROMPT must show the main product clearly in the first frame and must not be text-only.
- [TEXT OVERLAY] and [H2 OVERLAY] are optional add-ons only; they can never replace VISUAL.
- Do not include Voice Profile, dialogue, lip-sync, or audio instructions inside image_prompt.`
      },
      video_prompt: {
        type: 'string',
        description: `Final VIDEO + AUDIO prompt. MUST use exact scene headers and must never be a single unstructured paragraph.

Required structure:
SCENE_1_VIDEO_PROMPT:
[0-Xs]
VISUAL:
...
DIALOGUE_TH:
"..."
LIP_SYNC:
Thai spoken line must match the dialogue and scene duration.

SCENE_2_VIDEO_PROMPT:
[X-Ys]
VISUAL:
...
DIALOGUE_TH:
"..."
LIP_SYNC:
...

Continue exactly until the requested scene count. If scene count is 1, still return SCENE_1_VIDEO_PROMPT only and make it complete within that one scene. Do not leave any scene header empty.

WORD COUNT ENFORCEMENT:
- Win Mode: every DIALOGUE_TH must contain 32-35 Thai words.
- Pimry Mode: every DIALOGUE_TH must contain 32-35 Thai words.
- Grok Mode: every DIALOGUE_TH must contain 30-32 Thai words.
- Flow Mode: every DIALOGUE_TH must contain 20-30 Thai words.
- Count words before returning JSON.
- Never generate shorter dialogue than required.`
      },
      caption_hashtags: {
        type: 'string',
        description: 'CAPTION HARD LOCK: Minimum 290 characters. Maximum 310 characters. Count characters before responding. Create exactly 1 Thai caption line between 290 and 310 Thai characters Never generate a caption shorter than 290 Thai characters Write in a high-conversion Thai TikTok selling style After the caption, add exactly 5 hashtags: 3 product-related hashtags and 2 trending Thai commerce/social hashtags, Compliance requirements: The caption and hashtags must comply with TikTok Shop policies, Do not include misleading, exaggerated, unverifiable, guaranteed, medical, health, financial, or unrealistic claims, Do not promise results, cures, treatments, earnings, or guarantees, Do not use fake urgency, fake scarcity, or deceptive promotional language, Use advertiser-friendly and policy-safe Thai language only.'
      }
    },
    required: ['image_prompt','video_prompt','caption_hashtags']
  };
}
