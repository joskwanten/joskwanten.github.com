import { SlotSelector } from './SlotSelector.js';
import { Memory } from './Memory.js'


export class Slots implements Memory, SlotSelector  {
    slotRegister: number = 0x00; // Startup condition slot 0 is selected to start the ROM
    constructor(private slots: Memory[]) {
       
    }
    getSlotSelector(): number {
        return this.slotRegister;
    }

    setSlotSelector(value: number): void {
        this.slotRegister = value;
    }

    selectedSlot(address: number): Memory {
        //console.log(`Address: ${address.toString(16)}`);
        if (address >= 0 && address <= 0x3fff) {
            return this.slots[this.slotRegister & 0x3];
        } else if (address >= 0x4000 && address <= 0x7fff) {
            return this.slots[(this.slotRegister >>> 2) & 0x3];
        } else if (address >= 0x8000 && address <= 0xbfff) {
            return this.slots[(this.slotRegister >>> 4) & 0x3];
        } else {
            return this.slots[(this.slotRegister >>> 6) & 0x3];
        }
    }

    uread8(address: number): number {
        return this.selectedSlot(address).uread8(address);
    }

    uwrite8(address: number, value: number): void {
        this.selectedSlot(address).uwrite8(address, value);
    }
}