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

Continue exactly until the requested scene count. If scene count is 1, still return SCENE_1_VIDEO_PROMPT only and make it complete within that one scene. Do not leave any scene header empty.`
      },
      caption_hashtags: {
        type: 'string',
        description: 'One Thai caption line followed by exactly 5 hashtags: 3 product-related and 2 trending hashtags.'
      }
    },
    required: ['image_prompt','video_prompt','caption_hashtags']
  };
}
