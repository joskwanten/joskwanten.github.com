export class Rom {
    /**
     *
     */
    constructor(memory) {
        this.memory = memory;
        this.memorys = new Int8Array(this.memory.buffer);
    }
    uread8(address) {
        return this.memory[address & 0xFFFF];
    }
    read8(address) {
        return this.memorys[address & 0xFFFF];
    }
    uread16(address) {
        address = address & 0xFFFF;
        return this.memory[address] + (this.memory[address + 1] << 8);
    }
    uwrite8(address, value) {
        // ROM is not writable
    }
    uwrite16(address, value) {
        // ROM is not writable    
    }
}
