export class Ram {
    constructor() {
        this.memory = new Uint8Array(0x10000).fill(0x00);
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
        this.memory[address & 0xFFFF] = value;
    }
    uwrite16(address, value) {
        address = address & 0xFFFF;
        this.memory[address] = value;
        this.memory[address + 1] = (value >> 8);
    }
}
