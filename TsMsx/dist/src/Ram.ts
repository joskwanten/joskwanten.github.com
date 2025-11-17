import { Memory } from './Memory.js';

export class Ram implements Memory {
    memory = new Uint8Array(0x10000).fill(0x00);
    memorys = new Int8Array(this.memory.buffer);
  
    uread8(address: number): number {
        return this.memory[address & 0xFFFF];
    }
    
    uwrite8(address: number, value: number): void {
        this.memory[address & 0xFFFF] = value;
    }
}
