import { Memory } from './Memory.js';

export class Rom implements Memory {
    memorys = new Int8Array(this.memory.buffer);
    /**
     *
     */
    constructor(private memory: Uint8Array) {
    
    }

    uread8(address: number): number {
        return this.memory[address & 0xFFFF];
    }
    
    uwrite8(address: number, value: number): void {
        // ROM is not writable
    }
}
