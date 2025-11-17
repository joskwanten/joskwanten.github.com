export class PPI {
// The PPI handles also the slot seletion, but in this emulator this is directly handled by the 
// Slot selector.
// Thi PPI handles keyboard handling and TBD.
    
    keyboardMatrix: string[][];
    keyboardState: boolean[][];
    keyboardRow: number;

    constructor() {
        this.keyboardRow = 0;
        this.keyboardState = new Array(16).fill(false).map(() => new Array(8).fill(false));
        this.keyboardMatrix = [
            ['7','6','5','4','3','2','1','0'],
            [';','(','@','$','^','-','9','8'],
            ['b','a','*','/','.',',',')',':'],
            ['j','i','h','g','f','e','d','c'],
            ['r','q','p','o','n','m','l','k'],
            ['z','y','x','w','v','u','t','s'],
            ['F3','F2','F1','?Kan','CapsLock','Alt','Control','Shift'],
            ['Enter','Select','Backspace','?Stop','Tab','Escape','F5','F4'],
            ['ArrowRight','ArrowDown','ArrowUp','ArrowLeft','Delete','?Insert','?Home',' '],
            ['','','','','','','',''],
            ['','','','','','','',''],
            ['','','','','','','',''],
            ['','','','','','','',''],
            ['','','','','','','',''],
            ['','','','','','','',''],
            ['','','','','','','',''],
        ]
    }

    // Read keyboard matrix
    readA9() {
        let result = 0;
        this.keyboardState[this.keyboardRow].forEach((k, i) => {
            result |= !k ? 1 << (7 - i) : 0;
        });
        
        return result;
    }

    writeAA(val: number) {
        this.keyboardRow = (val & 0xf);
    }

    writeAB(val: number) {

    }

    onKeydown(keyName: string) {
        this.keyboardMatrix.forEach((r, i) => {
            r.forEach((k, j) => {
                if (k === keyName) {
                    this.keyboardState[i][j] = true;
                }
            })
        });
    }

    onKeyup(keyName: string) {
        this.keyboardMatrix.forEach((r, i) => {
            r.forEach((k, j) => {
                if (k === keyName) {
                    this.keyboardState[i][j] = false;
                }
            })
        });
    }
}