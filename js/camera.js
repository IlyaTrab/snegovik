export class CameraManager {
  constructor() {
    this.videoEl = document.getElementById('camera');
    this.stream  = null;
  }

  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async requestCamera() {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.videoEl.srcObject = this.stream;

    await new Promise((resolve, reject) => {
      this.videoEl.onloadedmetadata = resolve;
      this.videoEl.onerror = reject;
      setTimeout(() => reject(new Error('Camera timeout')), 10_000);
    });

    this.videoEl.style.display = 'block';
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.videoEl.style.display = 'none';
  }
}
