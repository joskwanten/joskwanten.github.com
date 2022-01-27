export interface Memory {
    uread8(address: number): number;
    read8(address: number): number;
    uread16(address: number): number;
    uwrite8(address: number, value: number): void;
    uwrite16(address: number, value: number): void;
}
