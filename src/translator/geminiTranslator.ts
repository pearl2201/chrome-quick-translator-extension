import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { getEngineSettings } from './engineSettings';

export async function translateToVietnamese(text: string): Promise<string> {


    // Retrieve your API key safely from local Manifest V3 extension storage
    const credentials = await getEngineSettings();
    const apiKey = credentials.geminiApiKey;
    const thoughts = credentials.thinkingLevel;

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
                thinkingConfig: thoughts !== 'NONE' ? {
                    thinkingLevel: ThinkingLevel[thoughts as keyof typeof ThinkingLevel] ?? ThinkingLevel.LOW,
                } : undefined
            }
        });

        return response.text?.trim() || '';
    } catch (error) {
        console.error('Translation workflow failed:', error);
        throw error;
    }
}
