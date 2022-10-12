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
    uwrite8(address, value) {
        // ROM is not writable
    }
}
