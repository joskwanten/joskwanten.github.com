export class EmptySlot {
    uread8(address) {
        return 0xff;
    }
    read8(address) {
        return 0xff;
    }
    uread16(address) {
        return 0xffff;
    }
    uwrite8(address, value) {
    }
    uwrite16(address, value) {
    }
}
