import { Memory } from './Memory';

export class EmptySlot implements Memory {
    uread8(address: number): number {
        return 0x0;
    }
    read8(address: number): number {
        return 0x0;
    }
    uread16(address: number): number {
        return 0x0;
    }
    
    uwrite8(address: number, value: number): void {
        
    }

    uwrite16(address: number, value: number): void {        
           
    }
}
