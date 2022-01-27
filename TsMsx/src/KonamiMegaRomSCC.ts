import { Memory } from './Memory.js';

export class KonamiMegaRomSCC implements Memory, SoundDevice {

    memorys = new Int8Array(this.memory.buffer);
    memory16 = new Uint16Array(this.memory.buffer);
    scc = new Int8Array(0xff);
    scc_u = new Uint8Array(this.scc.buffer);
    time = 0; // Counts 44100 per second

    selectedPages = [0, 0, 0, 0, 0, 1, 2, 4];
    pageSize = 0x2000;

    getTempo(chan: number) {
        return this.scc_u[0x80 + (2 * chan)] + ((this.scc_u[0x80 + (2 * chan) + 1] & 0xf) << 8);
    }

    getFrequency(chan: number): number {
        return 3579545 / (32 * (this.getTempo(chan) + 1));
        //3579545 / (799 * 32) = 140 Hz
    }

    getVolume(chan: number) {
        if (this.scc_u[0x8f] & (1 << chan)) {
            return this.scc[0x8A + chan] & 0xf;
        }
        return 0;
    }

    getWave(chan: number, pos: number) {
        return this.scc[(0x20 * chan) + (pos % 32)];
    }


    constructor(private memory: Uint8Array, private sampleRate: number) {

    }

    process(): number {
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

    getLeft(): number {
        return 0;
    }

    getRight(): number {
        return 0;
    }

    uread8(address: number): number {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memory[(page * this.pageSize) + (address % this.pageSize)];
    }

    read8(address: number): number {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memorys[(page * this.pageSize) + (address % this.pageSize)];
    }

    uread16(address: number): number {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memory[(page * this.pageSize) + (address % this.pageSize)]
            + (this.memory[(page * this.pageSize) + (address % this.pageSize) + 1] << 8);
    }

    uwrite8(address: number, value: number): void {
        if (address % 0x2000 >= 0x1800) {
            if (this.selectedPages[(address >>> 13) % 8] == 0x3f) {
                let reg = (address % 0x2000) - 0x1800;
                if (reg <= 255) {
                    this.scc[reg] = value;
                }
            }

            return;
        } else {
            this.selectedPages[(address >>> 13) % 8] = value;
        }
    }

    uwrite16(address: number, value: number): void {
        // Not implemented
    }
}
