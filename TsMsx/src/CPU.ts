export interface CPU {
    execute(numOfInstructions: number, showLog: boolean): void;
    halt(): void;
    interrupt(): void;
}