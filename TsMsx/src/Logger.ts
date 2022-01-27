export interface Registers {
    [key: string]: number;
}

export interface Logger {
    debug(str: string, registers: Registers ): void;
}