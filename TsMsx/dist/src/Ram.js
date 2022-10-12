export class Ram {
    constructor() {
        this.memory = new Uint8Array(0x10000).fill(0x00);
        this.memorys = new Int8Array(this.memory.buffer);
    }
    uread8(address) {
        return this.memory[address & 0xFFFF];
    }
    uwrite8(address, value) {
        this.memory[address & 0xFFFF] = value;
    }
}
