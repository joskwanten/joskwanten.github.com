import { TMS9918 } from './TMS9918.js';
import { IO } from './IO.js';
import { Logger, Registers } from './Logger.js';
import { Z80, C, E, DE, PC, SP, A } from './z80_generated.js';
import { Ram } from './Ram';


function wait(ms: number) {
    return new Promise<void>((res, rej) => setTimeout(() => res(), ms));
}

let z80: Z80 | null = null;
let vdp = new TMS9918(() => z80?.interrupt(), (n) => { });

async function reset() {
    let response = await fetch('testfiles/z80doc.bin');
    let buffer = await response.arrayBuffer();
    let zexdoc = new Uint8Array(buffer);

    // This position is read by Zexall to set the stack pointer (SP)    
    let mem = new Ram();
    let romMemory = new Uint8Array(0x10000);
    zexdoc.forEach((b, i) => mem.uwrite8(i + 0x8000, b));

    // let response = await fetch('testfiles/zexdoc.com');
    // let buffer = await response.arrayBuffer();
    // let zexdoc = new Uint8Array(buffer);

    // // This position is read by Zexall to set the stack pointer (SP)    
    // let mem = new Ram();
    // let romMemory = new Uint8Array(0x10000);
    // zexdoc.forEach((b, i) => mem.uwrite8(i + 0x0100, b));
    // mem.uwrite8(0x006, 0x00);
    // mem.uwrite8(0x007, 0xf3);

    class ScreenLogger implements Logger {
        debug(str: string, registers: Registers): void {
            let div = document.createElement('div');
            div.classList.add('log-line');

            let logtext = document.createElement('div');
            logtext.classList.add('mnemonic');
            logtext.innerText = str;
            div.appendChild(logtext);

            let indexes = ['AF', 'BC', 'DE', 'HL', 'SP', '_BC', '_DE', '_HL'];
            indexes.forEach(i => {
                let d = document.createElement('div');
                d.classList.add('register');
                d.innerText = `${i}=${('0000' + registers[i].toString(16)).slice(-4)}`;
                div.appendChild(d);
            });

            let logger = document.querySelector('#logger');
            if (logger) {
                let maxLines = 1000;
                let numOfRowsTooMany = logger.children.length - maxLines;
                for (let i = 0; i < numOfRowsTooMany; i++) {
                    logger.removeChild(logger.children[i]);
                }
                logger.appendChild(div);
                logger.scrollTop = logger.scrollHeight;
            }
        }
    }

    class IoBus implements IO {
        read8(address: number): number {
            switch (address) {
                case 0x98:
                    return vdp.read(false);
                case 0x99:
                    return vdp.read(true);
                default:
                    console.log(`Port read not implemented ${address.toString(16)}`);
                    return 0xff;
            }
        }
        write8(address: number, value: number): void {
            switch (address) {
                case 0x98:
                    vdp.write(false, value);
                    //console.count("vdp write");
                    break;
                case 0x99:
                    vdp.write(true, value);
                    break;
                case 0x7d:
                    console.debug("Check program counter");
                    break;
                case 0x20:
                    throw new Error('Invalid')
                case 0x2e:
                case 0x2f:
                    console.log(`Debug info ${address.toString(16)}, ${value}, ${String.fromCharCode(value)}`)
                default:
                    //console.log(`Port write not implemented ${address.toString(16)}`);
                    break;
            }
        }
    }

    let io = new IoBus();



    let logger = new ScreenLogger();

    z80 = new Z80(mem, io, logger);

    z80.registerSystemCall(0x0005, (cpu: Z80) => {
        if (cpu.r8[C] == 2) {
            console.log(cpu.r8[E]);
        } else if (cpu.r8[C] == 9) {
            let str = "";
            let i = 0, c;
            let mem = cpu.memory.uread8(i);
            for (i = cpu.r16[DE], c = 0; mem != '$'.charCodeAt(0); i++) {
                mem = cpu.memory.uread8(i & 0xffff);
                str += String.fromCharCode(mem);
                if (c++ > 256) {
                    console.error("String to print is too long!\n");
                    break;
                }
            }

            console.log(str);
        }
    });

    let printedChars = '';
    z80.registerSystemCall(0x0010, (cpu: Z80) => {
        if (cpu.r8[A] != 13) {
            printedChars += String.fromCharCode(cpu.r8[A]);
        } else {
            console.log(printedChars);
            printedChars = '';
        }
    });

    z80.r16[PC] = 0x8000;
    z80.r16[SP] = 0xf300;
    // Put a RET on 0x1601 which will be called for ROM_CHAN_OPEN (ZX Spectrum)
    z80.memory.uwrite8(0x1601, 0xc9);
    //while(1) {
    //}
}

reset().then(() => {
    console.log(z80);
});

window.onload = () => {
    async function run() {
        setInterval(() => {
            if (z80) {
                let lastCycles = z80.cycles;
                while ((z80.cycles - lastCycles) < 6000000) {
                    z80.executeSingleInstruction();
                }

                vdp.checkAndGenerateInterrupt(Date.now());
            }
        }, 16.67);
    }

    reset().then(() => {
        run();
    });
}
