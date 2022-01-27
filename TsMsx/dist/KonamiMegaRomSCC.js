export class KonamiMegaRomSCC {
    constructor(memory, sampleRate) {
        this.memory = memory;
        this.sampleRate = sampleRate;
        this.memorys = new Int8Array(this.memory.buffer);
        this.memory16 = new Uint16Array(this.memory.buffer);
        this.scc = new Int8Array(0xff);
        this.scc_u = new Uint8Array(this.scc.buffer);
        this.time = 0; // Counts 44100 per second
        this.selectedPages = [0, 0, 0, 0, 0, 1, 2, 4];
        this.pageSize = 0x2000;
    }
    getTempo(chan) {
        return this.scc_u[0x80 + (2 * chan)] + ((this.scc_u[0x80 + (2 * chan) + 1] & 0xf) << 8);
    }
    getFrequency(chan) {
        return 3579545 / (32 * (this.getTempo(chan) + 1));
        //3579545 / (799 * 32) = 140 Hz
    }
    getVolume(chan) {
        if (this.scc_u[0x8f] & (1 << chan)) {
            return this.scc[0x8A + chan] & 0xf;
        }
        return 0;
    }
    getWave(chan, pos) {
        return this.scc[(0x20 * chan) + (pos % 32)];
    }
    process() {
        // Compute one sample
        let val = 0;
        for (let chan = 0; chan < 5; chan++) {
            let f = this.getFrequency(chan);
            let step = (32 * f) / 44100;
            let pos = (Math.floor(step * this.time)) % 32;
            val += this.getWave(chan > 3 ? 3 : chan, pos) * this.getVolume(chan);
        }
        this.time++;
        return val / 9600;
    }
    getLeft() {
        return 0;
    }
    getRight() {
        return 0;
    }
    uread8(address) {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memory[(page * this.pageSize) + (address % this.pageSize)];
    }
    read8(address) {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memorys[(page * this.pageSize) + (address % this.pageSize)];
    }
    uread16(address) {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memory[(page * this.pageSize) + (address % this.pageSize)]
            + (this.memory[(page * this.pageSize) + (address % this.pageSize) + 1] << 8);
    }
    uwrite8(address, value) {
        if (address % 0x2000 >= 0x1800) {
            if (this.selectedPages[(address >>> 13) % 8] == 0x3f) {
                let reg = (address % 0x2000) - 0x1800;
                if (reg <= 255) {
                    this.scc[reg] = value;
                }
            }
            return;
        }
        else {
            this.selectedPages[(address >>> 13) % 8] = value;
        }
    }
    uwrite16(address, value) {
        // Not implemented
    }
}
