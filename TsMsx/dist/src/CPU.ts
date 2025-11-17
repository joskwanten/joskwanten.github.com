export interface CPU {
    executeSingleInstruction(): void;
    halt(): void;
    interrupt(): void;
}