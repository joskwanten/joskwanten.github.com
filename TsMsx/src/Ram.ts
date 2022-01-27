import { Memory } from './Memory.js';

export class Ram implements Memory {
    memory = new Uint8Array(0x10000);
    memorys = new Int8Array(this.memory.buffer);
    memory16 = new Uint16Array(this.memory.buffer);
  
    uread8(address: number): number {



        let value = this.memory[address & 0xFFFF];

        // if (address === 0x8815 && value == 0x44) {
        //     // Neg written
        //     console.log(`Read 0x8815: ${value.toString(16)}`);
        // }

        // if (address === 0x8815 && value == 0x7c ) {
        //     console.log(`Read wrong 0x8815: ${value.toString(16)}`);
        // }

        return value;
    }

    read8(address: number): number {
        return this.memorys[address & 0xFFFF];
    }
    
    uread16(address: number): number {
        address = address & 0xFFFF;
        return this.memory[address] + (this.memory[address + 1] << 8);
    }
    
    uwrite8(address: number, value: number): void {
        // if (address === 0x832f ) {
        //     console.log(`Written 0x832f: ${value.toString(16)}`);
        // }
        // if (address === 0x8330 && value == 0x7c ) {
        //     console.log(`Written 0x8330: ${value.toString(16)}`);
        // }

        // if (address === 0x8815 && value == 0x44) {
        //     // Neg written
        //     console.log(`Written 0x8815: ${value.toString(16)}`);
        // }

        // if (address === 0x8815 && value == 0x7c) {
        //     // Neg written
        //     console.log(`Written 0x8815: ${value.toString(16)}`);
        // }

        this.memory[address & 0xFFFF] = value;
    }

    uwrite16(address: number, value: number): void {   
        if (address === 0x832e) {
            console.log('Break2');
        }     
        this.memory[address] = value & 0xFF;   
        this.memory[address + 1] = (value >> 8) & 0xFF;     
    }
}
