---
language:
  - zh
  - vi
library_name: transformers.js
pipeline_tag: translation
tags:
  - marian
  - onnx
  - quantized
  - translation
  - chinese
  - vietnamese
  - web
base_model: ngocdang83/HachimiMT-30-zh-vi
---

# HachimiMT-30 zh→vi — ONNX cho trình duyệt (transformers.js)

Bản ONNX của [ngocdang83/HachimiMT-30-zh-vi](https://huggingface.co/ngocdang83/HachimiMT-30-zh-vi)
(MarianMT ~31M tham số, 6 encoder / 2 decoder, dịch tiếng Trung → tiếng Việt, tối ưu cho truyện
mạng/tiên hiệp), đóng gói để chạy trực tiếp trong trình duyệt bằng
[🤗 Transformers.js](https://huggingface.co/docs/transformers.js).

> Lưu ý: đừng nhầm với [DanVP/MoxhiMT-30](https://huggingface.co/DanVP/MoxhiMT-30) — một model
> khác (8 encoder / 2 decoder, ~37M) dùng vocab khác, không tương thích với bộ ONNX/tokenizer này.

🖥️ **Demo:** [DanVP/moxhimt](https://huggingface.co/spaces/DanVP/moxhimt) — dịch hoàn toàn trên thiết bị, không gửi văn bản lên máy chủ.

## File

| File | Kích thước | Ghi chú |
|---|---|---|
| `onnx/encoder_model_quantized.onnx` | ~26 MB | int8 động (QUInt8, per-channel) — mặc định cho WASM |
| `onnx/decoder_model_merged_quantized.onnx` | ~29 MB | int8 động, quantize **cả subgraph** của node `If` |
| `onnx/encoder_model_fp16.onnx` / `decoder_model_merged_fp16.onnx` | ~51 / 57 MB | cho WebGPU |
| `onnx/encoder_model.onnx` / `decoder_model_merged.onnx` | ~102 / 113 MB | fp32 gốc |

Chất lượng q8 đã đối chiếu với PyTorch fp32: bản dịch giống hệt trên bộ câu thử.

## Tokenizer

`source.spm` của model gốc là SentencePiece **BPE** (`byte_fallback=true`), vì vậy `tokenizer.json`
ở đây được dựng bằng `tokenizers.models.BPE` với merges trích từ spm (không dùng Unigram như
script chuyển đổi Marian thông thường — Unigram sẽ tách sai với spm kiểu BPE). Encode/decode đã
được kiểm tra khớp 100% với `MarianTokenizer` gốc.

## Dùng với Transformers.js

```js
import { pipeline } from '@huggingface/transformers';

const translator = await pipeline('translation', 'DanVP/HachimiMT-30-zh-vi-onnx', {
  dtype: 'q8', // hoặc { encoder_model: 'q8', decoder_model_merged: 'q8' }
});
const out = await translator('他抬起头，看见月光下的剑冢。', { max_new_tokens: 128 });
// → "Hắn ngẩng đầu, nhìn thấy Kiếm Trủng dưới ánh trăng."
```

Gợi ý khi chạy trên mobile (tránh OOM trên iOS Safari): tách văn bản theo câu thành chunk ≤ ~192
token, pad về vài bucket cố định, dịch tuần tự `num_beams: 1`, và đặt
`env.backends.onnx.wasm.numThreads = 1` trên iOS. Xem source của Space demo để tham khảo.

## Ghi công

- Trọng số gốc: [ngocdang83/HachimiMT-30-zh-vi](https://huggingface.co/ngocdang83/HachimiMT-30-zh-vi)
- Export bằng 🤗 Optimum (`text2text-generation-with-past`), quantize bằng ONNX Runtime
  (`quantize_dynamic`, `EnableSubgraph=True`).
