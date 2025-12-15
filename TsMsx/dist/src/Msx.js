import { TMS9918 } from "./TMS9918.js";
import { SubSlotSelector } from "./SubSlotSelector.js";
import { Rom } from "./Rom.js";
import * as Z80 from "./Z80.js";
import { Slots } from "./Slots.js";
import { EmptySlot } from "./EmptySlot.js";
import { Ram } from "./Ram.js";
import { PPI } from "./PPI.js";
import { KonamiMegaRomSCC } from "./KonamiMegaRomSCC.js";
import { Renderer } from "./Renderer.js";
function changeBackground(c) {
    let element = document.querySelector(".backdrop");
    if (element) {
        let color = ("#000000" + (c >>> 8).toString(16)).slice(-6);
        element.style.backgroundColor = color;
    }
}
const Hz = 60;
const MHz = 3.579545;
const CyclesPerInterrupt = (MHz * 1000000) / Hz;
const loopTime = 1000 / Hz;
let z80 = null;
let vdp = new TMS9918(() => z80?.interrupt(), changeBackground);
let ppi = new PPI();
let ay3Node = null;
let sccNode = null;
async function reset() {
    // let response = await fetch('cbios_main_msx1.rom');
    let response = await fetch("system/MSX1.ROM");
    let buffer = await response.arrayBuffer();
    let bios = new Uint8Array(buffer);
    let biosMemory = new Uint8Array(0x10000);
    bios.forEach((b, i) => (biosMemory[i] = b));
    response = await fetch("system/cbios_logo_msx1.rom");
    buffer = await response.arrayBuffer();
    let logo = new Uint8Array(buffer);
    logo.forEach((b, i) => (biosMemory[i + 0x8000] = b));
    const queryString = window.location.search.replace(/\?/, "");
    let slot1;
    if (queryString) {
        console.log(queryString);
        response = await fetch(queryString);
        buffer = await response.arrayBuffer();
        let game = new Uint8Array(buffer);
        if (buffer.byteLength > 0x8000) {
            slot1 = new KonamiMegaRomSCC(game, (reg, val) => sccNode?.port.postMessage([reg, val]));
        }
        else {
            let gameMemory = new Uint8Array(0x10000);
            gameMemory.forEach((b, i) => (gameMemory[i] = 0));
            game.forEach((g, i) => (gameMemory[i + 0x4000] = g));
            slot1 = new Rom(gameMemory);
        }
    }
    // Define the MSX slots and sub-slots (slot 3)
    let slot0 = new Rom(biosMemory);
    slot1 = slot1 ? slot1 : new EmptySlot();
    let slot2 = new EmptySlot();
    let slot3 = new SubSlotSelector([
        new EmptySlot(),
        new EmptySlot(),
        new Ram(),
        new EmptySlot(),
    ]);
    let slots = new Slots([slot0, slot1, slot2, slot3]);
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
                    return this.psgRegisters[this.psgRegister];
                case 0xa8:
                    return slots.getSlotSelector();
                case 0xa9:
                    return ppi.readA9();
                default:
                    return 0xff;
            }
        }
        write8(address, value) {
            switch (address) {
                case 0x98:
                    vdp.write(false, value);
                    break;
                case 0x99:
                    vdp.write(true, value);
                    break;
                case 0xa0:
                    this.psgRegister = value;
                    break;
                case 0xa1:
                    this.psgRegisters[this.psgRegister] = value;
                    ay3Node?.port.postMessage({ psgRegisters: this.psgRegisters });
                    break;
                case 0xa8:
                    slots.setSlotSelector(value);
                    break;
                case 0xa9:
                    break;
                case 0xaa:
                    ppi.writeAA(value);
                    break;
                default:
                    break;
            }
        }
    }
    let io = new IoBus();
    // Wrapper object to use Z80.js
    let core = {
        mem_read: (address) => slots.uread8(address),
        mem_write: (address, value) => slots.uwrite8(address, value),
        io_read: (address) => io.read8(address & 0xff),
        io_write: (address, value) => io.write8(address & 0xff, value),
    };
    z80 = Z80.Z80(core);
    z80.reset();
}
async function run() {
    setInterval(() => {
        let cycles = 0;
        while (cycles < CyclesPerInterrupt) {
            cycles += z80.run_instruction();
        }
        vdp.checkAndGenerateInterrupt(Date.now());
    }, loopTime);
}
reset().then(() => {
    run();
});
window.onpopstate = function (event) {
    alert("location: " + document.location + ", state: " + JSON.stringify(event.state));
};
function createChorus(audioContext, input, output) {
    // 2. Creëer DelayNodes voor links en rechts
    const leftDelay = audioContext.createDelay();
    leftDelay.delayTime.value = 0.015; // 15ms basisvertraging
    const rightDelay = audioContext.createDelay();
    rightDelay.delayTime.value = 0.020; // 20ms basisvertraging
    // 3. Creëer LFO's voor modulatie
    const leftLFO = audioContext.createOscillator();
    leftLFO.type = 'sine';
    leftLFO.frequency.value = 0.6; // 0.6 Hz modulatiesnelheid
    const rightLFO = audioContext.createOscillator();
    rightLFO.type = 'sine';
    rightLFO.frequency.value = 0.5; // 0.5 Hz modulatiesnelheid
    // 4. Voeg GainNodes toe voor modulatie diepte
    const leftLFOGain = audioContext.createGain();
    leftLFOGain.gain.value = 0.001; // Modulatie van ±5ms
    const rightLFOGain = audioContext.createGain();
    rightLFOGain.gain.value = 0.001; // Modulatie van ±5ms
    // 5. Verbind de modulatie aan de DelayNodes
    leftLFO.connect(leftLFOGain);
    leftLFOGain.connect(leftDelay.delayTime);
    rightLFO.connect(rightLFOGain);
    rightLFOGain.connect(rightDelay.delayTime);
    // 6. Gebruik StereoPanners voor ruimtelijk effect
    const leftPanner = audioContext.createStereoPanner();
    leftPanner.pan.value = -1; // Pan volledig naar links
    const rightPanner = audioContext.createStereoPanner();
    rightPanner.pan.value = 1; // Pan volledig naar rechts
    leftDelay.connect(leftPanner);
    rightDelay.connect(rightPanner);
    leftPanner.connect(output);
    rightPanner.connect(output);
    // 7. Mix droog en nat signaal
    const dryGain = audioContext.createGain();
    dryGain.gain.value = 0.7; // Droge mix op 70%
    input.connect(dryGain);
    dryGain.connect(audioContext.destination);
    input.connect(leftDelay);
    input.connect(rightDelay);
    // 8. Start de oscillators
    leftLFO.start();
    rightLFO.start();
}
window.onload = () => {
    const canvas = document.getElementById("screen");
    const renderer = new Renderer(canvas);
    if (renderer) {
        document.onkeydown = (event) => {
            ppi.onKeydown(event.key);
        };
        document.onkeyup = (event) => {
            ppi.onKeyup(event.key);
        };
        let screenUpdateRoutine = () => {
            let vdpOutout = vdp.getImage();
            const rgbaData = new Uint8Array(256 * 192 * 4);
            for (let i = 0; i < vdpOutout.length; i++) {
                rgbaData[4 * i + 0] = 0xff & (vdpOutout[i] >>> 24);
                rgbaData[4 * i + 1] = 0xff & (vdpOutout[i] >>> 16);
                rgbaData[4 * i + 2] = 0xff & (vdpOutout[i] >>> 8);
                rgbaData[4 * i + 3] = 0xff & vdpOutout[i];
            }
            renderer.render(rgbaData, 256, 192);
            requestAnimationFrame(screenUpdateRoutine);
        };
        window.requestAnimationFrame(screenUpdateRoutine);
        let soundButton = document.querySelector("#sound");
        soundButton?.addEventListener("click", async (e) => {
            var AudioContext = window.AudioContext;
            var audioContext = new AudioContext();
            // Add the worklet module
            await audioContext.audioWorklet.addModule("./dist/src/AY-3-8910-processor.js");
            await audioContext.audioWorklet.addModule("./dist/src/SCC-processor.js");
            // Create the worklet node
            ay3Node = new AudioWorkletNode(audioContext, "AY-3-8910-processor", {
                outputChannelCount: [2],
            });
            sccNode = new AudioWorkletNode(audioContext, "SCC-processor", {
                outputChannelCount: [2],
            });
            const gainNodePSG = audioContext.createGain();
            gainNodePSG.gain.setValueAtTime(0.15, audioContext.currentTime);
            const gainNodeSCC = audioContext.createGain();
            gainNodeSCC.gain.setValueAtTime(.15, audioContext.currentTime);
            ;
            // Connect the node to the audio context
            ay3Node.connect(gainNodePSG);
            sccNode.connect(gainNodeSCC);
            ;
            gainNodePSG.connect(audioContext.destination);
            createChorus(audioContext, gainNodeSCC, audioContext.destination);
            gainNodeSCC.connect(audioContext.destination);
            soundButton?.setAttribute("style", "display:none;");
        });
        let fullscreenButton = document.querySelector("#fullscreen");
        fullscreenButton?.addEventListener("click", async (e) => {
            let body = document.querySelector("body");
            body?.requestFullscreen();
        });
        let scale2xButton = document.querySelector("#scale2x");
        scale2xButton?.addEventListener("click", async (e) => {
            canvas?.setAttribute("style", "transform: scale(2);");
        });
        let scale3xButton = document.querySelector("#scale3x");
        scale3xButton?.addEventListener("click", async (e) => {
            canvas?.setAttribute("style", "transform: scale(3);");
        });
        let scale4xButton = document.querySelector("#scale4x");
        scale4xButton?.addEventListener("click", async (e) => {
            canvas?.setAttribute("style", "transform: scale(4);");
        });
    }
};
document.addEventListener("fullscreenchange", (event) => {
    let fullscreenButton = document.querySelector("#fullscreen");
    if (document.fullscreenElement) {
        fullscreenButton?.setAttribute("style", "display:none;");
    }
    else {
        fullscreenButton?.setAttribute("style", "display:unset;");
    }
});
