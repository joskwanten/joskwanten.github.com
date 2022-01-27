var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { TMS9918 } from './TMS9918.js';
import { SubSlotSelector } from './SubSlotSelector.js';
import { Rom } from './Rom.js';
import { Z80 } from './z80_generated.js';
import { Slots } from './Slots.js';
import { EmptySlot } from './EmptySlot.js';
import { Ram } from './Ram.js';
import { PPI } from './PPI.js';
import { KonamiMegaRomSCC } from './KonamiMegaRomSCC.js';
import { AY_3_8910 } from './AY-3-8910.js';
function changeBackground(c) {
    let element = document.querySelector('.backdrop');
    if (element) {
        let color = ('#000000' + (c >>> 8).toString(16)).slice(-6);
        element.style.backgroundColor = color;
    }
}
let z80 = null;
let vdp = new TMS9918(() => z80 === null || z80 === void 0 ? void 0 : z80.interrupt(), changeBackground);
let ppi = new PPI();
let ay3 = new AY_3_8910();
ay3.configure(false, 1789772, 44100);
ay3.setPan(0, 0.5, false);
ay3.setPan(1, 0.5, false);
ay3.setPan(2, 0.5, false);
//let psg = new AY_3_8910();
let scc;
let fillBuffer = function (e) {
    var left = e.outputBuffer.getChannelData(0);
    var right = e.outputBuffer.getChannelData(1);
    for (var i = 0; i < left.length; i++) {
        //left[i] = right[i] = psg.process();
        ay3.process();
        ay3.removeDC();
        left[i] = ay3.left / 2;
        right[i] = ay3.right / 2;
        if (scc) {
            let val = scc.process();
            left[i] += val;
            right[i] += val;
            left[i] /= 2;
            right[i] /= 2;
        }
    }
    return true;
};
let debugBuffer = '';
function wait(ms) {
    return new Promise((res, rej) => setTimeout(() => res(), ms));
}
function reset() {
    return __awaiter(this, void 0, void 0, function* () {
        // let response = await fetch('cbios_main_msx1.rom');
        let response = yield fetch('MSX1.ROM');
        let buffer = yield response.arrayBuffer();
        let bios = new Uint8Array(buffer);
        let biosMemory = new Uint8Array(0x10000);
        bios.forEach((b, i) => biosMemory[i] = b);
        // response = await fetch('games/QBERT.ROM');
        // buffer = await response.arrayBuffer();
        // let game = new Uint8Array(buffer);
        // let gameMemory = new Uint8Array(0x10000);
        // gameMemory.forEach((b, i) => gameMemory[i] = 0);
        // game.forEach((g, i) => gameMemory[i + 0x4000] = g);
        // let slot1 = new Rom(gameMemory);
        response = yield fetch('games/SALAMAND.ROM');
        buffer = yield response.arrayBuffer();
        let game = new Uint8Array(buffer);
        let slot1 = new KonamiMegaRomSCC(game, 44100);
        scc = slot1;
        let slot0 = new Rom(biosMemory);
        //let slot1 = new EmptySlot();
        let slot2 = new EmptySlot();
        let slot3 = new SubSlotSelector([new EmptySlot(), new EmptySlot(), new Ram(), new EmptySlot()]);
        let slots = new Slots([slot0, slot1, slot2, slot3]);
        let buf = "";
        class IoBus {
            constructor() {
                this.psgRegister = 0;
                this.psgRegisters = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            }
            read8(address) {
                switch (address) {
                    case 0x98:
                        return vdp.read(false);
                    case 0x99:
                        return vdp.read(true);
                    case 0xa02:
                        //return psg.read();
                        return this.psgRegisters[this.psgRegister];
                    case 0xa8:
                        return slots.getSlotSelector();
                    case 0xa9:
                        return ppi.readA9();
                    default:
                        //console.log(`Port read not implemented ${address.toString(16)}`);
                        return 0xff;
                }
            }
            write8(address, value) {
                switch (address) {
                    case 0x98:
                        vdp.write(false, value);
                        break;
                    case 0x99:
                        //console.log(`vdp write 0x${value.toString(16)}`);
                        vdp.write(true, value);
                        break;
                    case 0xa0:
                        this.psgRegister = value;
                        break;
                    case 0xa1:
                        //psg.write(value);
                        this.psgRegisters[this.psgRegister] = value;
                        ay3.updateState(this.psgRegisters);
                        break;
                    case 0xa8:
                        slots.setSlotSelector(value);
                        break;
                    case 0xa9:
                        break;
                    case 0xaa:
                        ppi.writeAA(value);
                        break;
                    case 0x7d:
                        console.debug("Check program counter");
                        break;
                    case 0x20:
                        throw new Error('Invalid');
                    case 0x2e:
                    case 0x2f:
                        //console.log(`Debug info ${address.toString(16)}, ${value}, ${String.fromCharCode(value)}`)
                        if (value == 0) {
                            console.log(debugBuffer);
                        }
                        else {
                            debugBuffer += String.fromCharCode(value);
                        }
                    default:
                        //console.log(`Port write not implemented ${address.toString(16)}`);
                        break;
                }
            }
        }
        class ConsoleLogger {
            debug(str, registers) {
                console.log(str);
            }
        }
        let io = new IoBus();
        z80 = new Z80(slots, io, new ConsoleLogger());
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        setInterval(() => {
            if (z80) {
                let lastCycles = z80.cycles;
                while ((z80.cycles - lastCycles) < 60000) {
                    z80.executeSingleInstruction();
                }
                vdp.checkAndGenerateInterrupt(Date.now());
            }
        }, 16.67);
    });
}
reset().then(() => {
    run();
});
window.onload = () => {
    const canvas = document.getElementById('screen');
    const ctx = canvas.getContext('2d');
    const imageData = ctx === null || ctx === void 0 ? void 0 : ctx.createImageData(256, 192);
    if (imageData) {
        //const view = new DataView(imageData.data.buffer);
        document.onkeydown = (event) => {
            ppi.onKeydown(event.key);
        };
        document.onkeyup = (event) => {
            ppi.onKeyup(event.key);
        };
        let screenUpdateRoutine = () => {
            // Do rendering
            let vdpOutout = vdp.getImage();
            for (let i = 0; i < vdpOutout.length; i++) {
                imageData.data[4 * i + 0] = 0xff & (vdpOutout[i] >>> 24);
                imageData.data[4 * i + 1] = 0xff & (vdpOutout[i] >>> 16);
                imageData.data[4 * i + 2] = 0xff & (vdpOutout[i] >>> 8);
                imageData.data[4 * i + 3] = 0xff & vdpOutout[i];
                //view.setUint32(i, vdpOutout[i]); // light blue (#80d7ff)
            }
            //view.setUint32(1500, 0xff00ffff);
            ctx === null || ctx === void 0 ? void 0 : ctx.putImageData(imageData, 0, 0);
            requestAnimationFrame(screenUpdateRoutine);
        };
        //setInterval(screenUpdateRoutine, 20);
        window.requestAnimationFrame(screenUpdateRoutine);
        let soundButton = document.querySelector('#sound');
        soundButton === null || soundButton === void 0 ? void 0 : soundButton.addEventListener('click', (e) => __awaiter(void 0, void 0, void 0, function* () {
            var AudioContext = window.AudioContext;
            var audioContext = new AudioContext();
            var audioNode = audioContext.createScriptProcessor(512, 0, 2);
            audioNode.onaudioprocess = fillBuffer;
            audioNode.connect(audioContext.destination);
            soundButton === null || soundButton === void 0 ? void 0 : soundButton.setAttribute("style", "display:none;");
        }));
    }
};
