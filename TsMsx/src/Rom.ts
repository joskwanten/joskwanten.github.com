import { Memory } from './Memory.js';

export class Rom implements Memory {
    //memory = new Uint8Array(0x10000);
    memorys = new Int8Array(this.memory.buffer);
    memory16 = new Uint16Array(this.memory.buffer);
    /**
     *
     */
    constructor(private memory: Uint8Array) {
    
    }

    uread8(address: number): number {
        return this.memory[address & 0xFFFF];
    }
    read8(address: number): number {
        return this.memorys[address & 0xFFFF];
    }
    uread16(address: number): number {
        address = address & 0xFFFF;
        return this.memory[address] + (this.memory[address + 1] << 8);
    }
    
    uwrite8(address: number, value: number): void {
        // ROM is not writable
    }

    uwrite16(address: number, value: number): void {        
        // ROM is not writable    
    }
}
