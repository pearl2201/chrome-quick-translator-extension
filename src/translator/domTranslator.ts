let chromiumTranslatorInstance: any = null;

async function getChromiumTranslator() {
    if (chromiumTranslatorInstance) return chromiumTranslatorInstance;

    // Hỗ trợ đồng thời cả API Translator độc lập (Chrome 141+) và namespace ai.translator cũ
    const translatorApi = (self as any).Translator || (self as any).ai?.translator;

    if (!translatorApi) {
        throw new Error("Chromium Translation API không khả dụng. Vui lòng bật Flags trong chrome://flags");
    }

    const capabilities = await translatorApi.availability({
        sourceLanguage: 'zh',
        targetLanguage: 'vi',
    });

    if (capabilities === 'no') {
        throw new Error("Cặp ngôn ngữ zh -> vi không khả dụng trên thiết bị này.");
    }

    chromiumTranslatorInstance = await translatorApi.create({
        sourceLanguage: 'zh',
        targetLanguage: 'vi',
    });

    return chromiumTranslatorInstance;
}

/**
 * Dịch văn bản tiếng Trung sang tiếng Việt sử dụng engine dịch có sẵn của trình duyệt.
 */
export async function translateToVietnamese(text: string): Promise<string> {
    const translator = await getChromiumTranslator();
    return await translator.translate(text);
}