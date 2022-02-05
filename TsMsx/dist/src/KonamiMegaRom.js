export class KonamiMegaRom {
    /**
     *
     */
    constructor(memory) {
        this.memory = memory;
        //memory = new Uint8Array(0x10000);
        this.memorys = new Int8Array(this.memory.buffer);
        this.memory16 = new Uint16Array(this.memory.buffer);
        this.selectedPages = [0, 0, 0, 0, 0, 1, 2, 4];
        this.pageSize = 0x2000;
    }
    uread8(address) {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memory[(page * this.pageSize) + (address % this.pageSize)];
    }
    read8(address) {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memorys[(page * this.pageSize) + (address % this.pageSize)];
    }
    uread16(address) {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memory[(page * this.pageSize) + (address % this.pageSize)]
            + (this.memory[(page * this.pageSize) + (address % this.pageSize) + 1] << 8);
    }
    uwrite8(address, value) {
        this.selectedPages[(address >>> 13) % 8] = value;
    }
    uwrite16(address, value) {
        // Not implemented
    }
}
