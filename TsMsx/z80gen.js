// Z80 opcode code generator

const csv = require('csv-parser')
const fs = require('fs');
const { emit } = require('process');
const results = [];
const generateLoggingCode = false;

let mnemonic = /(?<opcode>\w+)( )?(?<operand>(\()?\w+(\+o)?(\))?)?(,?)(?<operand2>(\()?\w+(\+o)?([\),'])?)?$/
let indirect = /\((?<reg>(\w+)(\+o)?)\)/

function emitCode(code) {
    console.log(code);
}

function emitLog(code) {
    if (generateLoggingCode) {
        console.log(code);
    }
}

function emitComment(comment) {
    emitCode(`// ${comment}`);
}

let nn_read = `let val = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;`;

let nn_read_ind = `let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
let val = this.memory.uread8(nn);`;

let nn_read_ind16 = `let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
let val = this.memory.uread16(nn);`;

let nn_write_ind8 = `let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
this.memory.uwrite8(nn, val);`;

let nn_write_ind16 = `let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
this.memory.uwrite16(nn, val);`;

let n_fetch = `let n = this.memory.uread8(this.r16[PC]++);`;

let stack_pc = `this.r16[SP] -= 2;\nthis.memory.uwrite16(this.r16[SP], this.r16[PC]);`

let pop_pc = `this.r16[PC] = this.memory.uread16(this.r16[SP]);\nthis.r16[SP] += 2;`

const conditions = {
    C: '(this.r8[F] & Flags.C)',
    NC: '!(this.r8[F] & Flags.C)',
    Z: '(this.r8[F] & Flags.Z)',
    NZ: '!(this.r8[F] & Flags.Z)',
    M: '(this.r8[F] & Flags.S)',
    P: '!(this.r8[F] & Flags.S)',
    PE: '(this.r8[F] & Flags.PV)',
    PO: '!(this.r8[F] & Flags.PV)',
}

const flagChecks = {
    Z: 'if (val == 0) { this.r8[F] |= Flags.Z } else { this.r8[F] &= ~Flags.Z }',
    PV: 'if (this.evenParity[val]) { this.r8[F] |= Flags.PV } else { this.r8[F] &= ~Flags.PV }',
    C: 'if ([val] & 0x100) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }',
    H: '// TODO: Implement Half carry behaviour',
    S: 'if (val == 0x80) { this.r8[F] |= Flags.Z } else { this.r8[F] &= ~Flags.Z }',
    S16: 'if (val == 0x8000) { this.r8[F] |= Flags.Z } else { this.r8[F] &= ~Flags.Z }',
}

const flagReset = {
    S: 'this.r8[F] &= ~Flags.S;',
    Z: 'this.r8[F] &= ~Flags.Z;',
    F5: 'this.r8[F] &= ~Flags.F5;',
    H: 'this.r8[F] &= ~Flags.H;',
    F3: 'this.r8[F] &= ~Flags.F3;',
    PV: 'this.r8[F] &= ~Flags.PV;',
    N: 'this.r8[F] &= ~Flags.N;',
    C: 'this.r8[F] &= ~Flags.C;',
}

const flagSet = {
    S: 'this.r8[F] |= Flags.S;',
    Z: 'this.r8[F] |= Flags.Z;',
    F5: 'this.r8[F] |= Flags.F5;',
    H: 'this.r8[F] |= Flags.H;',
    F3: 'this.r8[F] |= Flags.F3;',
    PV: 'this.r8[F] |= Flags.PV;',
    N: 'this.r8[F] |= Flags.N;',
    C: 'this.r8[F] |= Flags.C;',
}

const registersLD = {
    'A': { type: 8, src: 'let val = this.r8[A];', dst: 'this.r8[A] = val;', direct: 'this.r8[A]' },
    'AF\'': { type: 8, src: 'let val = this.r16s[AF];', dst: 'this.r16s[AF] = val;', direct: 'this.r16s[AF]' },
    'F': { type: 8, src: 'let val = this.r8[F];', dst: 'this.r8[F] = val;', direct: 'this.r8[F]' },
    'B': { type: 8, src: 'let val = this.r8[B];', dst: 'this.r8[B] = val;', direct: 'this.r8[B]' },
    'C': { type: 8, src: 'let val = this.r8[C];', dst: 'this.r8[C] = val;', direct: 'this.r8[C]' },
    '(C)': { type: 8, src: 'let val = this.IO.read8(this.r8[C]);', dst: 'this.IO.write8(this.r8[C], val);' },
    'D': { type: 8, src: 'let val = this.r8[D];', dst: 'this.r8[D] = val;', direct: 'this.r8[D]' },
    'E': { type: 8, src: 'let val = this.r8[E];', dst: 'this.r8[E] = val;', direct: 'this.r8[E]' },
    'H': { type: 8, src: 'let val = this.r8[H];', dst: 'this.r8[H] = val;', direct: 'this.r8[H]' },
    'L': { type: 8, src: 'let val = this.r8[L];', dst: 'this.r8[L] = val;', direct: 'this.r8[L]' },
    'I': { type: 8, src: 'let val = this.r8[I];', dst: 'this.r8[I] = val;', direct: 'this.r8[I]' },
    'R': { type: 8, src: 'let val = this.r8[R];', dst: 'this.r8[R] = val;', direct: 'this.r8[R]' },
    'AF': { type: 16, src: 'let val = this.r16[AF];', dst: 'this.r16[AF] = val;', direct: 'this.r16[AF]' },
    'BC': { type: 16, src: 'let val = this.r16[BC];', dst: 'this.r16[BC] = val;', direct: 'this.r16[BC]' },
    'DE': { type: 16, src: 'let val = this.r16[DE];', dst: 'this.r16[DE] = val;', direct: 'this.r16[DE]' },
    'HL': { type: 16, src: 'let val = this.r16[HL];', dst: 'this.r16[HL] = val;', direct: 'this.r16[HL]' },
    'SP': { type: 16, src: 'let val = this.r16[SP];', dst: 'this.r16[SP] = val;', direct: 'this.r16[SP]' },
    '(BC)': { type: 8, src: 'let val = this.memory.uread8(this.r16[BC]);', dst: 'this.memory.uwrite8(this.r16[BC], val);' },
    '(DE)': { type: 8, src: 'let val = this.memory.uread8(this.r16[DE]);', dst: 'this.memory.uwrite8(this.r16[DE], val);' },
    '(HL)': { type: 8, src: 'let val = this.memory.uread8(this.r16[HL]);', dst: 'this.memory.uwrite8(this.r16[HL], val);' },
    '(IX)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IX]);', dst: 'this.memory.uwrite8(this.r16[IX], val);' },
    '(IY)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IY]);', dst: 'this.memory.uwrite8(this.r16[IY], val);' },
    '(SP)': { type: 16, src: 'let val = this.memory.uread16(this.r16[SP]);', dst: 'this.memory.uwrite16(this.r16[SP], val);' },
    'HL\'': { type: 16, src: 'let val = this.r16s[HL];', dst: 'this.r16s[HL] = val;', direct: 'this.r16s[HL]' },
    'IXh': { type: 8, src: 'let val = this.r8[IXh];', dst: 'this.r8[IXh] = val;', direct: 'this.r8[IXh]' },
    'IXl': { type: 8, src: 'let val = this.r8[IXl];', dst: 'this.r8[IXl] = val;', direct: 'this.r8[IXl]' },
    'IYh': { type: 8, src: 'let val = this.r8[IYh];', dst: 'this.r8[IYh] = val;', direct: 'this.r8[IYh]' },
    'IYl': { type: 8, src: 'let val = this.r8[IYl];', dst: 'this.r8[IYl] = val;', direct: 'this.r8[IYl]' },
    'IX': { type: 16, src: 'let val = this.r16[IX];', dst: 'this.r16[IX] = val;', direct: 'this.r16[IX]' },
    'IY': { type: 16, src: 'let val = this.r16[IY];', dst: 'this.r16[IY] = val;', direct: 'this.r16[IY]' },
    '(IX+o)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IX] + o);', dst: 'this.memory.uwrite8(this.r16[IX] + o, val);' },
    '(IY+o)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IY] + o)', dst: 'this.memory.uwrite8(this.r16[IY] + o, val);' },
    'nn': { type: 24, src: nn_read, dst: undefined },
    'n': { type: 8, src: 'let val = this.memory.uread8(this.r16[PC]++);', dst: undefined },
    '(n)': { type: 8, src: 'let n = this.memory.uread8(this.r16[PC]++);', dst: 'this.IO.write8(n, val);' },
    '(nn)': { type: 8, src: nn_read_ind, src16: nn_read_ind16, dst: nn_write_ind8, dst16: nn_write_ind16 }
};

const rLookup = { 0: 'B', 1: 'C', 2: 'D', 3: 'E', 4: 'H', 5: 'L', 7: 'A' };
const pLookup = {/* 0: 'B', 1: 'C', 2: 'D', 3: 'E',*/ 4: 'IXh', 5: 'IXl'/*, 7: 'A'*/ };
const qLookup = {/*0: 'B', 1: 'C', 2: 'D', 3: 'E', */ 4: 'IYh', 5: 'IYl' /*, 7: 'A' */ };

function generateLambda(r, opcode) {
    if (opcode[0] === 'ED') {
        emitCode(`this.addInstructionED(0x${opcode[1]}, (addr: number) => {`);
        emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    } else if (opcode[0] === 'CB') {
        emitCode(`this.addInstructionCB(0x${opcode[1]}, (addr: number) => {`);
        emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    } else if (opcode[0] === 'DD') {
        if (opcode[1] === 'CB') {
            emitCode(`this.addInstructionDDCB(0x${opcode[3]}, (addr: number, o: number) => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
        } else {
            emitCode(`this.addInstructionDD(0x${opcode[1]}, (addr: number) => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
            if (opcode[2] == 'o') {
                emitCode(`let o = this.memory.uread8(this.r16[PC]++);`);
            }
        }
    } else if (opcode[0] === 'FD') {
        if (opcode[1] === 'CB') {
            emitCode(`this.addInstructionFDCB(0x${opcode[3]}, (addr: number, o: number) => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
        } else {
            emitCode(`this.addInstructionFD(0x${opcode[1]}, (addr: number) => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
            if (opcode[2] == 'o') {
                emitCode(`let o = this.memory.uread8(this.r16[PC]++);`);
            }
        }
    } else {
        emitCode(`this.addInstruction(0x${opcode[0]}, (addr: number) => {`);
        emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    }
}

function generateLDOpcode(r, dst, src, opcode) {
    generateLambda(r, opcode);

    if (registersLD[src].direct && registersLD[dst].direct) {
        emitCode(`${registersLD[dst].direct} = ${registersLD[src].direct}`);
    } else {
        if (registersLD[dst].type == 16 && registersLD[src].src16) {
            emitCode(registersLD[src].src16);
        } else {
            emitCode(registersLD[src].src);
        }
        if (src == '(n)') {
            emitCode('let val = this.IO.read8(n);');
        }
        if (dst == '(n)') {
            emitCode(n_fetch);
        }
        if (registersLD[src].type == 16 && registersLD[dst].type == 8) {
            emitCode(registersLD[dst].dst16);
        } else {
            emitCode(registersLD[dst].dst);
        }
    }

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o.toString(16)}')
        .replace(/,nn/, ',${val.toString(16)}')
        .replace(/\(nn\),/, '(${nn.toString(16)}),')
        .replace(/,\(nn\)/, ',(${nn.toString(16)})')
        .replace(/\(n\)/, '(${n.toString(16)})')
        .replace(/,n/, ',${val.toString(16)}');

    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}

function generateBitAndSetOpcode(r, dst, src, opcode) {
    generateLambda(r, opcode);
    emitCode(registersLD[src].src);

    if (r.Instruction.indexOf('BIT') == 0) {
        emitCode(`this.bit(${dst}, val)`);
    } else if (r.Instruction.indexOf('SET') == 0) {
        emitCode(`val = this.set(${dst}, val)`);
        emitCode(registersLD[src].dst);
    } else {
        emitCode(`val = this.res(${dst}, val)`);
        emitCode(registersLD[src].dst);
    }

    let instr = r.Instruction.replace(/b/, dst).replace(/r/, src);

    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}


function generateAddSubCpOpcode(r, dst, src, opcode) {
    generateLambda(r, opcode);

    emitCode(registersLD[src].src);
    let sbc = r.Instruction.indexOf('SBC ') >= 0;
    let adc = r.Instruction.indexOf('ADC ') >= 0;
    let add = r.Instruction.indexOf('ADD ') >= 0;
    let cp = r.Instruction.indexOf('CP ') >= 0;
    let carry = sbc || adc;
    let sub = !(add || adc);

    let store = cp ? '' : `${registersLD[dst].direct} = `
    if (registersLD[src].type == 16) {
        emitCode(`${store}this.addSub16(${registersLD[dst].direct}, val, ${sub}, ${carry})`);
    } else {
        emitCode(`${store}this.addSub8(${registersLD[dst].direct}, val, ${sub}, ${carry})`);
    }

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o.toString(16)}')
        .replace(/,nn/, ',${val.toString(16)}')
        .replace(/,\(nn\)/, ',(${nn.toString(16)})')
        .replace(/n$/, '${val.toString(16)}');

    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}

function generateShiftRotateOpcode(r, dst, src, opcode) {
    generateLambda(r, opcode);

    let operation = r.Instruction.indexOf('RL ') == 0 || r.Instruction == 'RLA' ? 'rotateLeft' :
        r.Instruction.indexOf('RR ') == 0 || r.Instruction == 'RRA' ? 'rotateRight' :
            r.Instruction.indexOf('RLC ') == 0 ? 'rotateLeftCarry' :
                r.Instruction.indexOf('RRC ') == 0 ? 'rotateRightCarry' :
                    r.Instruction.indexOf('SLA ') == 0 ? 'shiftLeft' :
                        r.Instruction.indexOf('SLL ') == 0 ? 'shiftLeftLogical' :
                            r.Instruction.indexOf('SRA ') == 0 ? 'shiftRightArithmetic' :
                                r.Instruction.indexOf('SRL ') == 0 ? 'shiftRightLogic' : 'unknown';

    if (registersLD[src].direct) {
        emitCode(`${registersLD[dst].direct} = this.${operation}(${registersLD[src].direct});`);
    } else {
        emitCode(registersLD[src].src);
        emitCode(`val = this.${operation}(val);`);
        emitCode(registersLD[src].dst)
    }

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o}')
        .replace(/,nn/, ',${val}')
        .replace(/,\(nn\)/, ',(${val})')
        .replace(/,n/, ',${val}');

    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`${instr}\`);`);
    emitCode(`});\n`);
}


function generateJPOpcode(r, condition, src, opcode) {
    generateLambda(r, opcode);
    if (src != '(HL)' && src != '(IX)' && src != '(IY)') {
        emitCode(registersLD[src].src);
    }

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o.toString(16)}')
        .replace(/nn/, '${val.toString(16)}');

    if (src != '(HL)' && src != '(IX)' && src != '(IY)') {
        if (condition) {
            emitCode(`if (${conditions[condition]}) {`);;
            emitCode(`this.r16[PC] = val;`)
            emitCode(`}`);
        } else {
            emitCode(`this.r16[PC] = val;`)
        }
    }
    else {
        src = src.replace(/\(/, "").replace(/\)/, "");
        emitCode(`this.r16[PC] = this.r16[${src}];`)
    }
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}

function generateJRAndCallOpcode(r, condition, src, opcode) {

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o.toString(16)}')
        .replace(/nn/, '${nn.toString(16)}');

    let timings = r.TimingZ80.split('/');

    generateLambda(r, opcode);

    let call = instr.indexOf('CALL') >= 0;

    if (call) {
        emitCode(`let nn = this.memory.uread16(this.r16[PC]);`);
        emitCode(`this.r16[PC] += 2;`);
    } else {
        emitCode(`let o = this.memory.read8(this.r16[PC]++);`);
    }

    let varName = call ? 'nn' : 'o';

    if (condition) {
        emitCode(`if (${conditions[condition]}) {`);;
        if (call) {
            emitCode(stack_pc); // Call puts program counter on the stack
            emitCode(`this.r16[PC] = ${varName};`);
        } else {
            emitCode(`this.r16[PC] += ${varName};`);
        }
        emitCode(`this.cycles += ${timings[0]};`);
        emitCode(`} else {`);
        emitCode(`this.cycles += ${timings[1]};`);
        emitCode(`}`);
    } else {
        if (call) {
            emitCode(stack_pc); // Call puts program counter on the stack
            emitCode(`this.r16[PC] = ${varName};`);
        } else {
            emitCode(`this.r16[PC] += ${varName};`);
        }
        emitCode(`this.cycles += ${r.TimingZ80};`);
    }

    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}

function generateRetOpcode(r, condition, opcode) {

    let instr = r.Instruction;
    let timings = r.TimingZ80.split('/');
    generateLambda(r, opcode);

    if (condition) { emitCode(`if (${conditions[condition]}) {`); }
    emitCode(pop_pc); // Call puts program counter on the stack
    emitCode(`this.cycles += ${timings[0]};`);
    if (condition) { emitCode(`} else {`); }
    if (condition) { emitCode(`this.cycles += ${timings[1]};`); }
    if (condition) { emitCode(`}`); }
    emitLog(`this.log(addr, \`${instr}\`);`);
    emitCode(`});\n`);
}

function generatePushPopOpcode(r, operand, opcode) {

    let instr = r.Instruction;
    let timings = r.TimingZ80;
    generateLambda(r, opcode);

    let push = r.Instruction.indexOf('PUSH ') >= 0;

    if (push) {
        emitCode(`this.r16[SP] -= 2;`);
        emitCode(`this.memory.uwrite16(this.r16[SP], ${registersLD[operand].direct});`);
    } else {
        emitCode(`${registersLD[operand].direct} = this.memory.uread16(this.r16[SP]);`);
        emitCode(`this.r16[SP] += 2;`);
    }
    emitCode(`this.cycles += ${timings};`);
    emitLog(`this.log(addr, \`${instr}\`);`);
    emitCode(`});\n`);
}

function generateExOpcode(r, dst, src, opcode) {

    let instr = r.Instruction;
    let timings = r.TimingZ80;
    generateLambda(r, opcode);
    if (dst) {
        emitCode(registersLD[src].src);
        emitCode(registersLD[dst].src.replace(/val/, 'val2'));
        emitCode(registersLD[dst].dst);
        emitCode(registersLD[src].dst.replace(/val/, 'val2'));
    } else {
        emitCode('let bc = this.r16[BC];');
        emitCode('let de = this.r16[DE];');
        emitCode('let hl = this.r16[HL];');
        emitCode('this.r16[BC] = this.r16s[BC];');
        emitCode('this.r16[DE] = this.r16s[DE];');
        emitCode('this.r16[HL] = this.r16s[HL];');
        emitCode('this.r16s[BC] = bc;');
        emitCode('this.r16s[DE] = de;');
        emitCode('this.r16s[HL] = hl;');
    }
    emitCode(`this.cycles += ${timings};`);
    emitLog(`this.log(addr, \`${instr}\`);`);
    emitCode(`});\n`);
}

function generateRstOpcode(r, operand, opcode) {

    let instr = r.Instruction;
    let timings = r.TimingZ80;
    generateLambda(r, opcode);



    emitCode(`this.r16[SP] -= 2;
    this.memory.uwrite16(this.r16[SP], this.r16[PC]);
    this.r16[PC] = 0x${operand.replace(/H/, '')};`)

    emitCode(`this.cycles += ${timings};`);
    emitLog(`this.log(addr, \`${instr}\`);`);
    emitCode(`});\n`);
}

function generateInOutOpcode(r, opcode) {

    let instr = r.Instruction;
    let timings = r.TimingZ80.split('/');
    let inop = instr.indexOf('IN') == 0;
    let inc = !(instr.indexOf('D') >= 0);
    let repeat = instr.indexOf('R') >= 0;

    generateLambda(r, opcode);

    if (repeat) {
        emitCode(`if(this.r8[B] > 0) {`);
        emitCode(`while(this.r8[B] > 0) {`);
    }

    emitCode(`this.ini_inid_outi_outd(${inop}, ${inc});`);
    emitCode(`this.cycles += ${timings[0]};`);

    if (repeat) {
        emitCode(`}`);
        emitCode(`} else {`);
        emitCode(`this.cycles += ${timings[1]};`);
        emitCode(`}`)
    }

    emitLog(`this.log(addr, \`${instr}\`);`);
    emitCode(`});\n`);
}

function generateLdiLddLdirLddrOpcode(r, opcode) {

    let instr = r.Instruction;
    let timings = r.TimingZ80.split('/');
    let inc = instr.indexOf('LDI') == 0;
    let repeat = instr.indexOf('R') >= 0;

    generateLambda(r, opcode);

    if (repeat) {
        emitCode(`if(this.r16[BC] > 0) {`);
        emitCode(`while(this.r16[BC] > 0) {`);
    }

    emitCode(`this.ldi_ldd(${inc});`);
    emitCode(`this.cycles += ${timings[0]};`);

    if (repeat) {
        emitCode(`}`);
        emitCode(`} else {`);
        emitCode(`this.cycles += ${timings[1]};`);
        emitCode(`}`)
    }

    emitLog(`this.log(addr, \`${instr}\`);`);
    emitCode(`});\n`);
}

function generateCpiCpdCpirCpdrOpcode(r, opcode) {

    let instr = r.Instruction;
    let timings = r.TimingZ80.split('/');
    let inc = instr.indexOf('CPI') == 0;
    let repeat = instr.indexOf('R') >= 0;

    generateLambda(r, opcode);

    if (repeat) {
        emitCode(`if(this.r16[BC] > 0) {`);
        emitCode(`while(this.r16[BC] > 0) {`);
    }

    emitCode(`this.cpi_cpd(${inc});`);
    emitCode(`this.cycles += ${timings[0]};`);

    if (repeat) {
        emitCode(`}`);
        emitCode(`} else {`);
        emitCode(`this.cycles += ${timings[1]};`);
        emitCode(`}`)
    }

    emitLog(`this.log(addr, \`${instr}\`);`);
    emitCode(`});\n`);
}


function generateIncDecOpcode(r, src, opcode, inc) {

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o}')
        .replace(/nn/, '${nn}');

    generateLambda(r, opcode);

    let val = 'val';
    if (registersLD[src].direct && registersLD[src].type == 8) {
        if (inc) {
            emitCode(`${registersLD[src].direct} = this.inc8(${registersLD[src].direct});`);
        } else {
            emitCode(`${registersLD[src].direct} = this.dec8(${registersLD[src].direct});`);
        }
    } else {
        emitCode(registersLD[src].src);
        if (registersLD[src].type == 8) {
            if (inc) {
                emitCode(`${val} = this.inc8(${val});`);
            } else {
                emitCode(`${val} = this.dec8(${val});`);
            }
        } else {
            if (inc) {
                emitCode(`${val}++;`);
            } else {
                emitCode(`${val}--;`);
            }
        }
        emitCode(registersLD[src].dst)
    }

    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`${instr}\`);`);
    emitCode(`});\n`);
}

function generateAndOrXorOpcode(r, src, opcode, operation) {
    generateLambda(r, opcode);

    let val = 'val';
    emitCode(registersLD[src].src);

    emitCode(`this.logicalOperation(${val}, LogicalOperation.${operation});`);

    if (src === 'n') {
        emitLog(`this.log(addr, \`${operation} \${val.toString(16)}\`);`);
    } else {
        src = src.replace(/\+o/, '+${o}');
        emitLog(`this.log(addr, \`${operation} ${src}\`);`);
    }

    emitCode(`});\n`);
}


function generateDJNZOpcode(r, opcode) {

    let timings = r.TimingZ80.split('/');

    generateLambda(r, opcode);
    emitCode(`let d = this.memory.read8(this.r16[PC]++)`);
    emitCode(`this.r8[B]--;`);
    emitCode(`this.r16[PC] += this.r8[B] !== 0 ? d : 0;`);
    emitCode(`this.cycles += this.r8[B] !== 0 ? ${timings[0]} : ${timings[1]};`);
    emitLog(`this.log(addr, \`DJNZ \${d}\`);`);
    emitCode(`});\n`);
}

function generateDIOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`this.disableInterrupts();`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`DI\`);`);
    emitCode(`});\n`);
}

function generateEIOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`this.enableInterrupts();`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`EI\`);`);
    emitCode(`});\n`);
}

function generateNOPOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`NOP\`);`);
    emitCode(`});\n`);
}

function generateHaltOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`this.halt();`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`HALT\`);`);
    emitCode(`});\n`);
}

function generateCCFOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitComment('Carry flag inverted. Also inverts H and clears N. Rest of the flags are preserved.');
    emitCode(`if (this.r8[F] & Flags.C) { this.r8[F] &= ~Flags.C; } else { this.r8[F] |= Flags.C };`);
    emitCode(`if (this.r8[F] & Flags.H) { this.r8[F] &= ~Flags.H; } else { this.r8[F] |= Flags.H };`);
    emitCode(`this.r8[F] &= ~Flags.N;`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`CCF\`);`);
    emitCode(`});\n`);
}

function generateSCFOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitComment('Carry flag set, H and N cleared, rest are preserved.');
    emitCode(`this.r8[F] |= Flags.C;`);
    emitCode(`this.r8[F] &= ~Flags.H;`);
    emitCode(`this.r8[F] &= ~Flags.N;`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`SCF\`);`);
    emitCode(`});\n`);
}

function generateNegOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`this.r8[A] = this.neg(this.r8[A]);`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`NEG\`);`);
    emitCode(`});\n`);
}

function generateRLAOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`let temp_flags = this.r8[F];`);
    emitCode(`this.r8[A] = this.rotateLeft(this.r8[A]);`);
    emitComment('Flags S, Z and PV are not set');
    emitCode(`let mask = Flags.S | Flags.Z | Flags.PV;`);
    emitCode(`this.r8[F] &= ~mask;`);
    emitCode(`this.r8[F] |= (mask & temp_flags);`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`RLA\`);`);
    emitCode(`});\n`);
}

function generateRLCAOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`let temp_flags = this.r8[F];`);
    emitCode(`this.r8[A] = this.rotateLeftCarry(this.r8[A], true);`);
    emitComment('Flags S, Z and PV are not set');
    emitCode(`let mask = Flags.S | Flags.Z | Flags.PV;`);
    emitCode(`this.r8[F] &= ~mask;`);
    emitCode(`this.r8[F] |= (mask & temp_flags);`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`RLCA\`);`);
    emitCode(`});\n`);
}

function generateRRAOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`let temp_flags = this.r8[F];`);
    emitCode(`this.r8[A] = this.rotateRight(this.r8[A]);`);
    emitComment('Flags S, Z and PV are not set');
    emitCode(`let mask = Flags.S | Flags.Z | Flags.PV;`);
    emitCode(`this.r8[F] &= ~mask;`);
    emitCode(`this.r8[F] |= (mask & temp_flags);`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`RLA\`);`);
    emitCode(`});\n`);
}

function generateRRCAOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`let temp_flags = this.r8[F];`);
    emitCode(`this.r8[A] = this.rotateRightCarry(this.r8[A]);`);
    emitComment('Flags S, Z and PV are not set');
    emitCode(`let mask = Flags.S | Flags.Z | Flags.PV;`);
    emitCode(`this.r8[F] &= ~mask;`);
    emitCode(`this.r8[F] |= (mask & temp_flags);`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`RRCA\`);`);
    emitCode(`});\n`);
}

function generateIMOpcode(r, opcode, operand) {
    generateLambda(r, opcode);
    emitCode(`this.interruptMode(${operand});`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`IM ${operand}\`);`);
    emitCode(`});\n`);
}

function generateRLDOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`this.rotateRLD();`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`RLD\`);`);
    emitCode(`});\n`);
}


function generateRRDOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`this.rotateRRD();`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`RRD\`);`);
    emitCode(`});\n`);
}

function generateDAAOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`this.daa();`);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`DAA\`);`);
    emitCode(`});\n`);
}

function generateCPLOpcode(r, opcode) {
    generateLambda(r, opcode);
    emitCode(`this.r8[A] = ~this.r8[A];`);
    emitCode(`this.r8[F] |= (Flags.H | Flags.N);`)
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`CPL\`);`);
    emitCode(`});\n`);
}

function fillRInOpcode(opcode, r) {
    let regex = /(?<base>\w+)\+r/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) + parseInt(r)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillPInOpcode(opcode, p) {
    let regex = /(?<base>\w+)\+p/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) + parseInt(p)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillPInOpcodeMul(opcode, p) {
    let regex = /(?<base>\w+)\*p/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) * parseInt(p)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillQInOpcode(opcode, p) {
    let regex = /(?<base>\w+)\+q/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) + parseInt(p)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillQInOpcode(opcode, q) {
    let regex = /(?<base>\w+)\+q/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) + parseInt(q)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillBAndRInOpcode(opcode, b, r) {
    return opcode.map(x => x.replace(/b/, b).replace(/r/, r))
        .map(x => '0x' + x)
        .map(x => x == '0xo' ? 'o' : eval(x))
        .map(x => x.toString(16).toUpperCase())
}

function fillQInOpcodeMul(opcode, q) {
    let regex = /(?<base>\w+)\*q/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) * parseInt(q)).toString(16)}`;
        }
        return `${o}`;
    })
}

function generateLD(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let dst = match.groups["operand"];
    let src = match.groups["operand2"];
    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);

    // TODO: generate flag behavior for I and R registers.
    // In all other cases no flags are affected
    if (src == 'r') {
        Object.entries(rLookup).forEach(c => {
            let r = c[0];
            generateLDOpcode(row, dst, c[1], fillRInOpcode(opcode, r));
        });
    } else if (src.match(/p/)) {
        Object.entries(pLookup).forEach(c => {
            let p = c[0];
            generateLDOpcode(row, dst, c[1], fillPInOpcode(opcode, p));
        });
    } else if (src.match(/q/)) {
        Object.entries(qLookup).forEach(c => {
            let q = c[0];
            generateLDOpcode(row, dst, c[1], fillQInOpcode(opcode, q));
        });
    } else {
        generateLDOpcode(row, dst, src, opcode);
    }
}

function generateBitAndSet(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let dst = match.groups["operand"];
    let src = match.groups["operand2"];
    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);


    if (src == 'r') {
        [...Array(8).keys()].forEach(b => {
            Object.entries(rLookup).forEach(r => {
                opcodeWithB = fillBAndRInOpcode(opcode, b, r[0]);
                generateBitAndSetOpcode(row, b, r[1], opcodeWithB);
            });
        });
    } else {
        [...Array(8).keys()].forEach(b => {
            opcodeWithB = fillBAndRInOpcode(opcode, b);
            generateBitAndSetOpcode(row, b, src, opcodeWithB);
        });
    }
}

function generateAddSub(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let dst = match.groups["operand"];
    let src = match.groups["operand2"];

    if (!src) {
        src = dst;
        dst = 'A';
    }

    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);

    // TODO: generate flag behavior for I and R registers.
    // In all other cases no flags are affected
    if (src == 'r') {
        Object.entries(rLookup).forEach(c => {
            let r = c[0];
            generateAddSubCpOpcode(row, dst, c[1], fillRInOpcode(opcode, r));
        });
    } else if (src.match(/p/)) {
        Object.entries(pLookup).forEach(c => {
            let p = c[0];
            generateAddSubCpOpcode(row, dst, c[1], fillPInOpcode(opcode, p));
        });
    } else if (src.match(/q/)) {
        Object.entries(qLookup).forEach(c => {
            let q = c[0];
            generateAddSubCpOpcode(row, dst, c[1], fillQInOpcode(opcode, q));
        });
    } else {
        generateAddSubCpOpcode(row, dst, src, opcode);
    }
}

function generateShiftRotate(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let dst = match.groups["operand"];
    let src = match.groups["operand2"];

    if (!dst) {
        dst = 'A';
    }

    if (!src) {
        src = dst;
        dst = 'A';
    }

    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);

    // TODO: generate flag behavior for I and R registers.
    // In all other cases no flags are affected
    if (src == 'r') {
        Object.entries(rLookup).forEach(c => {
            let r = c[0];
            generateShiftRotateOpcode(row, c[1], c[1], fillRInOpcode(opcode, r));
        });
    } else {
        generateShiftRotateOpcode(row, dst, src, opcode);
    }
}

function generateJPJR(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let condition = match.groups["operand"];
    let src = match.groups["operand2"];

    if (!src) {
        src = condition;
        condition = undefined;
    }
    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);

    if (match.groups['opcode'] == "JP") {
        generateJPOpcode(row, condition, src, opcode);
    } else {
        generateJRAndCallOpcode(row, condition, src, opcode);
    }
}

function generateIncDec(row, inc) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);
    let src = match.groups["operand"];
    if (src.match(/p/)) {
        Object.entries(pLookup).forEach(c => {
            let p = c[0];
            generateIncDecOpcode(row, c[1], fillPInOpcodeMul(opcode, p), inc);
        });
    } else if (src.match(/q/)) {
        Object.entries(qLookup).forEach(c => {
            let q = c[0];
            generateIncDecOpcode(row, c[1], fillQInOpcodeMul(opcode, q), inc);
        });
    } else {
        generateIncDecOpcode(row, src, opcode, inc);
    }
}

function generateAndOrXor(row, operation) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);
    let src = match.groups["operand"];
    if (src.match(/r/)) {
        Object.entries(rLookup).forEach(c => {
            let r = c[0];
            generateAndOrXorOpcode(row, c[1], fillRInOpcode(opcode, r), operation);
        });
    } else if (src.match(/p/)) {
        Object.entries(pLookup).forEach(c => {
            let p = c[0];
            generateAndOrXorOpcode(row, c[1], fillPInOpcode(opcode, p), operation);
        });
    } else if (src.match(/q/)) {
        Object.entries(qLookup).forEach(c => {
            let q = c[0];
            generateAndOrXorOpcode(row, c[1], fillQInOpcode(opcode, q), operation);
        });
    } else {
        generateAndOrXorOpcode(row, src, opcode, operation);
    }
}

function generateRet(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    let condition = match.groups["operand"];
    generateRetOpcode(row, condition, opcode);
}

function generatePushPop(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    let operand = match.groups["operand"];
    generatePushPopOpcode(row, operand, opcode);
}

function generateEx(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    let operand = match.groups["operand"];
    let operand2 = match.groups["operand2"];
    generateExOpcode(row, operand, operand2, opcode);
}

function generateRst(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    let operand = match.groups["operand"];
    generateRstOpcode(row, operand, opcode);
}

function generateLdCpInOut(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    if (row.Instruction.indexOf('LD') == 0) {
        generateLdiLddLdirLddrOpcode(row, opcode);
    } else if (row.Instruction.indexOf('CP') == 0) {
        generateCpiCpdCpirCpdrOpcode(row, opcode);
    } else {
        generateInOutOpcode(row, opcode);
    }
}

function generateDJNZ(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    generateDJNZOpcode(row, opcode);
}

function generateGeneral(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    switch (match.groups['opcode']) {
        case 'DI':
            generateDIOpcode(row, opcode);
            return true;
        case 'EI':
            generateEIOpcode(row, opcode);
            return true;
        case 'NOP':
            generateNOPOpcode(row, opcode);
            return true;
        case 'HALT':
            generateHaltOpcode(row, opcode);
            return true;
        case 'CCF':
            generateCCFOpcode(row, opcode);
            return true;
        case 'SCF':
            generateSCFOpcode(row, opcode);
            return true;
        case 'NEG':
            generateNegOpcode(row, opcode);
            return true;
        case 'RLA':
            generateRLAOpcode(row, opcode);
            return true;
        case 'RLCA':
            generateRLCAOpcode(row, opcode);
            return true;
        case 'RRA':
            generateRRAOpcode(row, opcode);
            return true;
        case 'RRCA':
            generateRRCAOpcode(row, opcode);
            return true;
        case 'IM':
            generateIMOpcode(row, opcode, match.groups['operand']);
            return true;
        case 'RLD':
            generateRLDOpcode(row, opcode);
            return true;
        case 'RRD':
            generateRRDOpcode(row, opcode);
            return true;
        case 'DAA':
            generateDAAOpcode(row, opcode);
            return true;
        case 'CPL':
            generateCPLOpcode(row, opcode);
            return true;
        default:
            return false;
    }
}

async function generateCode() {
    await new Promise((res, rej) => {
        fs.createReadStream('Opcodes.csv')
            .pipe(csv({ separator: ';' }))
            .on('data', (data) => results.push(data))
            .on('end', () => {
                results.forEach(r => {
                    if (r.Instruction.indexOf('LD ') == 0) { generateLD(r); }
                    else if (r.Instruction.indexOf('JP ') == 0) { generateJPJR(r); }
                    else if (r.Instruction.indexOf('JR ') == 0) { generateJPJR(r); }
                    else if (r.Instruction.indexOf('CALL ') == 0) { generateJPJR(r); }
                    else if (r.Instruction.indexOf('INC ') == 0) { generateIncDec(r, true); }
                    else if (r.Instruction.indexOf('DEC ') == 0) { generateIncDec(r, false); }
                    else if (r.Instruction.indexOf('AND ') == 0) { generateAndOrXor(r, 'AND'); }
                    else if (r.Instruction.indexOf('OR ') == 0) { generateAndOrXor(r, 'OR'); }
                    else if (r.Instruction.indexOf('XOR ') == 0) { generateAndOrXor(r, 'XOR'); }
                    else if (r.Instruction.indexOf('OUT ') == 0) { generateLD(r); }
                    else if (r.Instruction.indexOf('IN ') == 0) { generateLD(r); }
                    else if (r.Instruction.indexOf('ADC ') == 0) { generateAddSub(r); }
                    else if (r.Instruction.indexOf('ADD ') == 0) { generateAddSub(r); }
                    else if (r.Instruction.indexOf('SBC ') == 0) { generateAddSub(r); }
                    else if (r.Instruction.indexOf('SUB ') == 0) { generateAddSub(r); }
                    else if (r.Instruction.indexOf('CP ') == 0) { generateAddSub(r); }
                    else if (r.Instruction.indexOf('RL ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('RLC ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('RR ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('RRC ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('RLA ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('RRA ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('SLA ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('SRA ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('SRL ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('SLL ') == 0) { generateShiftRotate(r); }
                    else if (r.Instruction.indexOf('RET') == 0) { generateRet(r); }
                    else if (r.Instruction.indexOf('PUSH ') == 0) { generatePushPop(r); }
                    else if (r.Instruction.indexOf('POP ') == 0) { generatePushPop(r); }
                    else if (r.Instruction.indexOf('BIT ') == 0) { generateBitAndSet(r); }
                    else if (r.Instruction.indexOf('SET ') == 0) { generateBitAndSet(r); }
                    else if (r.Instruction.indexOf('RES ') == 0) { generateBitAndSet(r); }
                    else if (r.Instruction.indexOf('EX') == 0) { generateEx(r); }
                    else if (r.Instruction.indexOf('RST') == 0) { generateRst(r); }
                    else if (r.Instruction.indexOf('IN') == 0) { generateLdCpInOut(r); }
                    else if (r.Instruction.indexOf('O') == 0) { generateLdCpInOut(r); } // OUTI OUTD OTIR and OTID still remaining
                    else if (r.Instruction.indexOf('DJNZ') == 0) { generateDJNZ(r); }
                    else if (r.Instruction.indexOf('LD') == 0) { generateLdCpInOut(r); } // LDI, LDD, LDIR and LDDR
                    else if (r.Instruction.indexOf('CPL') == 0) { generateGeneral(r); }
                    else if (r.Instruction.indexOf('CP') == 0) { generateLdCpInOut(r); } // CPI, CPD, CPIR and CPDR                    
                    else {
                        if (!generateGeneral(r)) {
                            console.error('Unhandled: ' + r.Instruction);
                        }
                    }
                });

                res();
            });
    });
}

async function readFile() {
    const data = fs.readFileSync('src/z80_template.ts', 'utf8');
    let lines = data.split('\r\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('/* GENERATED_CODE_INSERT_HERE */') >= 0) {
            await generateCode();
        } else {
            console.log(lines[i]);
        }
    }
}

readFile();