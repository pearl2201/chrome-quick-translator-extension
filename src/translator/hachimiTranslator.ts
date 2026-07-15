import { pipeline, env, TranslationPipeline } from '@huggingface/transformers';

// Disable remote CDN — use local files only
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = chrome.runtime.getURL('models/');

// Point onnxruntime to local wasm files instead of CDN
const e = env as any;
e.backends ??= {};
e.backends.onnx ??= {};
e.backends.onnx.wasm ??= {};
e.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');
e.backends.onnx.wasm.numThreads = 1;

let translatorInstance: TranslationPipeline | null = null;

// Khởi tạo model (chỉ load 1 lần duy nhất)
async function getTranslator() {
    if (!translatorInstance) {
        translatorInstance = await pipeline('translation', 'DanVP/HachimiMT-30-zh-vi-onnx', {
            dtype: 'q8',
        });
    }
    return translatorInstance;
}

/**
 * Tách văn bản thành các câu nhỏ dựa trên dấu câu tiếng Trung.
 * Đảm bảo mỗi đoạn (chunk) ngắn hơn giới hạn ~192 tokens (~120-150 chữ Hán).
 */
function splitIntoChunks(text: string): string[] {
    // Tách theo các dấu câu tiếng Trung đặc trưng và dấu xuống dòng
    const rawSentences = text.split(/([。\n!?！！？？」』])/g);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const part of rawSentences) {
        if (!part) continue;

        // Nếu là ký tự xuống dòng, đẩy chunk hiện tại đi và giữ nguyên hàng trống
        if (part === "\n" || part === "\r\n") {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }
            chunks.push("\n");
            continue;
        }

        // Khống chế độ dài của mỗi chunk trong khoảng an toàn
        if (currentChunk.length + part.length > 130) {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = part;
        } else {
            currentChunk += part;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Dịch văn bản Trung-Việt tối ưu hóa và gộp dòng thông minh cho dễ đọc.
 */
export async function translateToVietnamese(text: string): Promise<string> {
    const translator = await getTranslator();
    
    // Tách văn bản thành các chunk nhỏ tối ưu
    const chunks = splitIntoChunks(text);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
        // Nếu là dòng trống thì giữ nguyên cấu trúc xuống dòng tạm thời
        if (chunk === "\n") {
            translatedChunks.push("\n");
            continue;
        }

        try {
            // Chạy dịch với cấu hình tối ưu của tác giả: num_beams = 1
            const output = await translator(chunk, {
                num_beams: 1, 
                max_new_tokens: 256, 
            });
            
            translatedChunks.push(output[0].translation_text);
        } catch (err) {
            console.error(`[Hachimi] Lỗi dịch chunk: "${chunk}"`, err);
            translatedChunks.push(chunk); // Trả lại chữ gốc nếu lỗi phân đoạn
        }
    }

    // --- XỬ LÝ GỘP DÒNG THÔNG MINH (JOIN LINES) ---
    const finalLines: string[] = [];
    let paragraphBuffer: string[] = [];

    for (const chunk of translatedChunks) {
        if (chunk === "\n") {
            // Nếu gặp dòng trống (khoảng ngắt đoạn thực sự), gộp những câu đang chờ trong buffer thành 1 đoạn văn
            if (paragraphBuffer.length > 0) {
                finalLines.push(paragraphBuffer.join(" "));
                paragraphBuffer = [];
            }
            // Thêm dòng trống thực sự để giãn cách các đoạn lớn
            finalLines.push(""); 
        } else {
            // Chuẩn hóa khoảng trắng và đẩy câu đã dịch vào buffer của đoạn hiện tại
            const cleaned = chunk.trim().replace(/\s+/g, " ");
            if (cleaned) {
                paragraphBuffer.push(cleaned);
            }
        }
    }

    // Đẩy nốt phần văn bản còn lại trong buffer nếu có
    if (paragraphBuffer.length > 0) {
        finalLines.push(paragraphBuffer.join(" "));
    }

    // Ghép các đoạn lớn lại bằng 1 dấu xuống dòng duy nhất và lọc các dòng trống trùng lặp
    return finalLines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n") // Đảm bảo tối đa chỉ có 1 dòng trống giãn cách giữa các đoạn
        .trim();
}