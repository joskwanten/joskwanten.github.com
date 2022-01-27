export interface IO {
    read8(address: number): number;
    write8(address: number, value: number): void;
}