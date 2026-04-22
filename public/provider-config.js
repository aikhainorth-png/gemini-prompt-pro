export const PROVIDERS = {
  gemini: { id: 'gemini', label: 'Gemini', model: 'gemini-2.5-flash' },
  openai: { id: 'openai', label: 'OpenAI', model: 'gpt-4.1' }
};

export function getProviderConfig(providerId){
  return PROVIDERS[providerId] || PROVIDERS.gemini;
}
