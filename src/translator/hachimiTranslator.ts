import { pipeline, env, TranslationPipeline } from '@huggingface/transformers';

// 1. Tắt tự động tải từ Hugging Face
env.allowRemoteModels = false;
env.localModelPath = chrome.runtime.getURL('models/');

let translatorInstance: TranslationPipeline | null = null;

// Khởi tạo model (chỉ load 1 lần duy nhất)
async function getTranslator() {
    if (!translatorInstance) {
        translatorInstance = await pipeline('translation', 'hachimi-30-onnx', {
            dtype: 'q8',
        });
    }
    return translatorInstance;
}

/**
 * Translate Chinese text to Vietnamese using the QuickTranslator engine.
 * Make sure to call initQuickTranslator() first.
 */
export async function translateToVietnamese(
    text: string
): Promise<string> {
    const translator = await getTranslator();
    const output = await translator(text);
    return output[0].translation_text;
}