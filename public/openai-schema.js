export function buildPromptBundleSchema(){
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      image_prompt: {
        type: 'string',
        description: 'Final image generation prompt ready to use. If multiple scenes are requested, use SCENE_1_IMAGE_PROMPT:, SCENE_2_IMAGE_PROMPT:, etc.'
      },
      video_prompt: {
        type: 'string',
        description: 'STRICT SCENE FORMAT REQUIRED. Always start with SCENE_1_VIDEO_PROMPT:. If more than one scene is requested, continue with SCENE_2_VIDEO_PROMPT:, SCENE_3_VIDEO_PROMPT:, etc. Each scene must contain complete visual direction, motion, camera movement, product interaction, and Thai dialogue. Do not return a paragraph-only video prompt. Do not leave any scene header empty.'
      },
      caption_hashtags: {
        type: 'string',
        description: 'One Thai caption line followed by exactly 5 hashtags: 3 product-related and 2 trending hashtags.'
      }
    },
    required: ['image_prompt','video_prompt','caption_hashtags']
  };
}
