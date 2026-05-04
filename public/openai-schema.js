export function buildPromptBundleSchema(){
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      image_prompt: { type: 'string', description: 'Single final image generation prompt ready to use.' },
      video_prompt: { type: 'string', description: 'Single final video generation prompt containing all scenes in one block.' },
      caption_hashtags: { type: 'string', description: 'One caption line followed by exactly 5 hashtags: 3 product-related and 2 trending hashtags.' }
    },
    required: ['image_prompt','video_prompt','caption_hashtags']
  };
}
