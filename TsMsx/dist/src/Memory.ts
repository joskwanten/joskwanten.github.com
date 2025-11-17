export interface Memory {
    uread8(address: number): number;
    uwrite8(address: number, value: number): void;
}
