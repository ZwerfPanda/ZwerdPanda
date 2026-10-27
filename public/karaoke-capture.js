/*
 * Karaoke: records the microphone sample by sample, with the exact frame on
 * the audio clock where each piece starts, so a voice lines up with the music.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 4096;
    this.buffer = new Float32Array(this.size);
    this.filled = 0;
    this.first = -1;
    this.port.onmessage = (e) => {
      if (e.data === 'flush') this.flush();
    };
  }
  flush() {
    if (this.filled) {
      this.port.postMessage({ frame: this.first, data: this.buffer.slice(0, this.filled) });
    }
    this.filled = 0;
    this.first = -1;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      if (this.first < 0) this.first = currentFrame;
      let i = 0;
      while (i < channel.length) {
        const n = Math.min(channel.length - i, this.size - this.filled);
        this.buffer.set(channel.subarray(i, i + n), this.filled);
        this.filled += n;
        i += n;
        if (this.filled === this.size) {
          this.port.postMessage({ frame: this.first, data: this.buffer.slice() });
          this.filled = 0;
          this.first = currentFrame + i;
        }
      }
    }
    return true;
  }
}
registerProcessor('karaoke-capture', CaptureProcessor);
