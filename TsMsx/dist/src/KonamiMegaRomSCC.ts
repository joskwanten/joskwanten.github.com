import { Memory } from './Memory.js';

type AudioWorkerProcessorCallback = (reg: number, val: number) => void;

export class KonamiMegaRomSCC implements Memory {

    memorys = new Int8Array(this.memory.buffer);
    memory16 = new Uint16Array(this.memory.buffer);    


    selectedPages = [0, 0, 0, 0, 0, 1, 2, 4];
    pageSize = 0x2000;


    constructor(private memory: Uint8Array, private callback: AudioWorkerProcessorCallback) {

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
        return this.uread8(address) + (this.uread8(address + 1) << 8);
    }

    uwrite8(address: number, value: number): void {
        if (address % 0x2000 >= 0x1800) {
            if (this.selectedPages[(address >>> 13) % 8] == 0x3f) {
                let reg = (address % 0x2000) - 0x1800;
                if (reg <= 255) {                    
                    this.callback(reg, value);
                }
            }
        } else {
            this.selectedPages[(address >>> 13) % 8] = value & 0x3f;
        }
    }

    uwrite16(address: number, value: number): void {
        this.uwrite8(address, value);
        this.uwrite8(address + 1, (value >>> 8));
    }
}
