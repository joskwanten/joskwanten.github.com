import { Memory } from './Memory.js'

export class SubSlotSelector implements Memory  {
    subSlotRegister = 0;
    
    constructor(private subSlots: Memory[]) {
        //console.log(subSlots.length);
    }

    selectedSlot(address: number): Memory {
        //console.log(`Address: ${address.toString(16)}`);
        if (address >= 0 && address <= 0x3fff) {
            return this.subSlots[this.subSlotRegister & 0x3];
        } else if (address >= 0x4000 && address <= 0x7fff) {
            return this.subSlots[(this.subSlotRegister >>> 2) & 0x3];
        } else if (address >= 0x8000 && address <= 0xbfff) {
            return this.subSlots[(this.subSlotRegister >>> 4) & 0x3];
        } else {
            return this.subSlots[(this.subSlotRegister >>> 6) & 0x3];
        }
    }

    uread8(address: number): number {
        if (address == 0xffff) {
            //console.log(`Reading Subslot register ${address.toString(16)}`);
            return (~this.subSlotRegister) & 0xff;
        }        
        return this.selectedSlot(address).uread8(address);
    }

    uwrite8(address: number, value: number): void {
        if (address == 0xffff) {
            //console.log(`Writing sub slot register : ${value}`);
            this.subSlotRegister = value & 0xff;            
        } else {
            this.selectedSlot(address).uwrite8(address, value);
        }
    }
}