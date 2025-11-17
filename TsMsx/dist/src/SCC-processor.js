class SCC_Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.scc = new Int8Array(0xff);
    this.scc_u = new Uint8Array(this.scc.buffer);
    this.time = 0; // Counts 44100 per second
    this.port.onmessage = (event) => {
        if (event.data && Array.isArray(event.data) && event.data.length === 2) {
          this.scc[event.data[0]] = event.data[1];
        }
      };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    // Generate sine wave for each output channel
    if (output.length > 0) {
      const outputChannel0 = output[0];
      for (let i = 0; i < outputChannel0.length; i++) {
        
        // Compute one sample
        let val = 0;
        for (let chan = 0; chan < 5; chan++) {
            let f = this.getFrequency(chan);
            let step = (32 * f) / sampleRate;
            let pos = Math.floor(step * this.time) % 32;
            val += this.getWave(chan > 3 ? 3 : chan, pos) * this.getVolume(chan);
        }

        this.time++;
        val = val / 9600;

        outputChannel0[i] = val;
        if (output.length > 1) {
          output[1][i] = val;
        }
      }
    }

    return true; // Keep the processor alive
  }

  getTempo(chan) {
    return (
      this.scc_u[0x80 + 2 * chan] +
      ((this.scc_u[0x80 + 2 * chan + 1] & 0xf) << 8)
    );
  }

  getFrequency(chan) {
    return 3579545 / (32 * (this.getTempo(chan) + 1));
  }

  getVolume(chan) {
    if (this.scc_u[0x8f] & (1 << chan)) {
      return this.scc[0x8a + chan] & 0xf;
    }
    return 0;
  }

  getWave(chan, pos) {
    return this.scc[0x20 * chan + (pos % 32)];
  }
}

// Register the processor
registerProcessor("SCC-processor", SCC_Processor);
