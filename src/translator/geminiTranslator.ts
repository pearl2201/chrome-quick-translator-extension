import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export async function translateToVietnamese(text: string): Promise<string> {


    // Retrieve your API key safely from local Manifest V3 extension storage
    const credentials = await chrome.storage.local.get('gemini_api_key') as { gemini_api_key?: string };
    const apiKey = credentials.gemini_api_key;

    if (!apiKey) {
        throw new Error('API Key missing. Please set your key in the extension options.');
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: `You are an expert Chinese-to-Vietnamese translator. 
Translate the following Chinese text into natural, fluent Vietnamese. 
Preserve the tone and convert idioms accurately. 
Return ONLY the translated Vietnamese text without quotes, commentary, or pinyin.

Chinese: ${text}`,
            config: {
                // FIXED: Wrap it inside the thinkingConfig object with camelCase properties
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.MEDIUM // 'low', 'medium', or 'high' are valid strings here
                }
            }
        });

        return response.text?.trim() || '';
    } catch (error) {
        console.error('Translation workflow failed:', error);
        throw error;
    }
}
