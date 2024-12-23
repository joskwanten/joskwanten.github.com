export class KonamiMegaRomSCC {
    constructor(memory, callback) {
        this.memory = memory;
        this.callback = callback;
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
        return this.uread8(address) + (this.uread8(address + 1) << 8);
    }
    uwrite8(address, value) {
        if (address % 0x2000 >= 0x1800) {
            if (this.selectedPages[(address >>> 13) % 8] == 0x3f) {
                let reg = (address % 0x2000) - 0x1800;
                if (reg <= 255) {
                    this.callback(reg, value);
                }
            }
        }
        else {
            this.selectedPages[(address >>> 13) % 8] = value & 0x3f;
        }
    }
    uwrite16(address, value) {
        this.uwrite8(address, value);
        this.uwrite8(address + 1, (value >>> 8));
    }
}
