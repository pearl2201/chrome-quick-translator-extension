import { create } from 'zustand';

// Workspace steps: 'CAPTURE' -> 'CROP' -> 'OCR_TRANSLATE'
type ActiveStep = 'CAPTURE' | 'CROP' | 'OCR_TRANSLATE';

interface CaptureState {
  isCapturing: boolean;
  progress: number;
  error: string | null;
  stitchedImageUri: string | null;
  extractedText: string;
  translatedText: string;
  activeStep: ActiveStep;
  startCapture: (tabId: number) => Promise<void>;
  setExtractedText: (text: string) => void;
  setTranslatedText: (text: string) => void;
  setActiveStep: (step: ActiveStep) => void;
  resetCapture: () => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  isCapturing: false,
  progress: 0,
  error: null,
  stitchedImageUri: null,
  extractedText: '',
  translatedText: '',
  activeStep: 'CAPTURE',
  
  startCapture: async (tabId: number) => {
    set({ isCapturing: true, progress: 0, error: null, stitchedImageUri: null, activeStep: 'CAPTURE' });
    
    try {
      // Send capture request to content script in the target tab
      chrome.tabs.sendMessage(tabId, { action: "START_CAPTURE" }, (response) => {
        if (chrome.runtime.lastError) {
          set({ isCapturing: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (response?.status === "error") {
          set({ isCapturing: false, error: response.message });
        }
      });

      const progressListener = (message: any) => {
        if (message.action === "CAPTURE_PROGRESS") {
          set({ progress: message.percent });
        }
        if (message.action === "CAPTURE_ERROR") {
          set({ isCapturing: false, error: message.message });
          chrome.runtime.onMessage.removeListener(progressListener);
        }
        if (message.action === "CAPTURE_COMPLETE") {
          set({ isCapturing: false, progress: 100, stitchedImageUri: message.dataUrl });
          chrome.runtime.onMessage.removeListener(progressListener);
          // Store image and open the crop page in a new tab
          chrome.storage.local.set({ capturedImage: message.dataUrl }, () => {
            chrome.tabs.create({ url: 'crop.html' });
          });
        }
      };
      
      chrome.runtime.onMessage.addListener(progressListener);
    } catch (err: any) {
      set({ isCapturing: false, error: err.message || "Failed to initiate capture." });
    }
  },

  setExtractedText: (text) => set({ extractedText: text }),
  setTranslatedText: (text) => set({ translatedText: text }),
  setActiveStep: (step) => set({ activeStep: step }),
  
  resetCapture: () => set({ 
    isCapturing: false, 
    progress: 0, 
    error: null, 
    stitchedImageUri: null, 
    extractedText: '', 
    translatedText: '', 
    activeStep: 'CAPTURE' 
  })
}));
