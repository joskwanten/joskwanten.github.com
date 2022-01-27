const A = 1;
const F = 0;
const B = 3;
const C = 2;
const D = 5;
const E = 4;
const H = 7;
const L = 6;
const I = 16;
const R = 17;
const IXH = 9;
const IXL = 8;
const IYH = 11;
const IYL = 10;
const r8_debug = ["F", "A", "C", "B", "E", "D", "L", "H"];
const r16_debug = ["AF", "BC", "DE", "HL", "IX", "IY", "SP", "PC"];
const AF = 0;
const BC = 1;
const DE = 2;
const HL = 3;
const IX = 4;
const IY = 5;
const SP = 6;
const _I = 7;
const _R = 8;
const PC = 9;
const _F = 10;
const rp = [BC, DE, HL, SP];
const rp_dd = [BC, DE, IX, SP];
const rp_fd = [BC, DE, IY, SP];
const rp_debug = ["BC", "DE", "HL", "SP"];
const rp_debug_dd = ["BC", "DE", "IX", "SP"];
const rp_debug_fd = ["BC", "DE", "IY", "SP"];
const rp2 = [BC, DE, HL, AF];
const rp2_dd = [BC, DE, IX, AF];
const rp2_fd = [BC, DE, IY, AF];
const rp2_debug = ["BC", "DE", "HL", "AF"];
const rp2_debug_dd = ["BC", "DE", "IX", "AF"];
const rp2_debug_fd = ["BC", "DE", "IY", "AF"];
const r = [B, C, D, E, H, L, HL, A];
const r_dd = [B, C, D, E, IXH, IXL, HL, A];
const r_fd = [B, C, D, E, IYH, IYL, HL, A];
const r_debug = ["B", "C", "D", "E", "H", "L", "HL", "A"];
const r_debug_dd = ["B", "C", "D", "E", "IXH", "IXL", "HL", "A"];
const r_debug_fd = ["B", "C", "D", "E", "IYH", "IYL", "HL", "A"];
const alu_debug = ["ADD A,", "ADC A,", "SUB ", "SBC A,", "AND", "XOR", "OR", "CP"];
let rp_dd_fd = {
    0x00: rp,
    0xdd: rp_dd,
    0xfd: rp_fd, // FD instructions (H is replaced by IYH and L by IYL)
};
let rp_debug_dd_fd = {
    0x00: rp_debug,
    0xdd: rp_debug_dd,
    0xfd: rp_debug_fd, // FD instructions (H is replaced by IYH and L by IYL)
};
let r_dd_fd = {
    0x00: r,
    0xdd: r_dd,
    0xfd: r_fd, // FD instructions (H is replaced by IYH and L by IYL)
};
let r_debug_dd_fd = {
    0x00: r_debug,
    0xdd: r_debug_dd,
    0xfd: r_debug_fd, // FD instructions (H is replaced by IYH and L by IYL)
};
let rp2_dd_fd = {
    0x00: rp2,
    0xdd: rp2_dd,
    0xfd: rp2_fd, // FD instructions (H is replaced by IYH and L by IYL)
};
let rp2_debug_dd_fd = {
    0x00: rp2_debug,
    0xdd: rp2_debug_dd,
    0xfd: rp2_debug_fd, // FD instructions (H is replaced by IYH and L by IYL)
};
const ROT_RLC = 0;
const ROT_RRC = 1;
const ROT_RL = 2;
const ROT_RR = 3;
const ROT_SLA = 4;
const ROT_SRA = 5;
const ROT_SLL = 6;
const ROT_SRL = 7;
const rot_debug = ["RLC", "RRC", "RL", "RR", "SLA", "SRA", "SLL", "SRL"];
const ALU_ADD_A = 0;
const ALU_ADC_A = 1;
const ALU_SUB = 2;
const ALU_SBC_A = 3;
const ALU_AND = 4;
const ALU_XOR = 5;
const ALU_OR = 6;
const ALU_CP = 7;
const FLAG_SIGN_F3_F5 = 0b10101000;
const FLAG_F3_F5 = 0b10101000;
const FLAG_ZERO = 0b01000000;
const FLAG_HALF_CARRY = 0b00010000;
const FLAG_OVERFLOW = 0b00000100;
const FLAG_ADDSUB = 0b00000010;
const FLAG_CARRY = 0b00000001;
const FLAGS_ADD_AFFECTED = 0b00111011;
var Flags;
(function (Flags) {
    Flags[Flags["S"] = 128] = "S";
    Flags[Flags["Z"] = 64] = "Z";
    Flags[Flags["F5"] = 32] = "F5";
    Flags[Flags["H"] = 16] = "H";
    Flags[Flags["F3"] = 8] = "F3";
    Flags[Flags["PV"] = 4] = "PV";
    Flags[Flags["N"] = 2] = "N";
    Flags[Flags["C"] = 1] = "C";
})(Flags || (Flags = {}));
const cc_debug = ["NZ", "Z", "NC", "C", "PO", "PE", "P", "M"];
const nn_predicates = [
    (f) => !(f & FLAG_ZERO),
    (f) => !(f & FLAG_ZERO),
    (f) => !(f & FLAG_CARRY),
    (f) => (f & FLAG_CARRY), // C
];
export class Z80 {
    constructor(memory, IO, logger) {
        this.memory = memory;
        this.IO = IO;
        this.logger = logger;
        // Declare 256bits for the registers
        // The Z80 uses 208bits from it
        this.r16 = new Uint16Array(16);
        // We will use this array with only one element
        // to convert a javascript number to a 16 bit represenation
        // this to find out which flags have to be set
        this.rAlu = new Uint16Array(1);
        // Array to access shadow registers
        this.r16s = new Uint16Array(16);
        // Map the registers to 8bit registers
        this.r8 = new Uint8Array(this.r16.buffer);
        // Array to access shadow registers in 8bit mode
        this.r8s = new Uint8Array(this.r16s);
        // Interrupts are enabled at startup
        this.interruptEnabled = true;
        // Number of T-States executed
        this.tStates = 0;
        // Interrupt flags 
        this.iff1 = true;
        this.iff2 = true;
        // flag to indicate if the CPU is halted
        this.halted = false;
    }
    hex16(n) {
        return ("000" + n.toString(16)).slice(-4);
    }
    hex8(n) {
        return ("0" + n.toString(16)).slice(-2);
    }
    dumpRegisters() {
        let registers = {};
        r16_debug.forEach((v, i) => {
            registers[v] = this.r16[i];
        });
        r16_debug.forEach((v, i) => {
            registers[`_${v}`] = this.r16s[i];
        });
        return registers;
    }
    reset() {
        this.r16[PC] = 0;
        this.r16[SP] = 0;
    }
    execute(numOfInstructions, showLog) {
        for (let i = 0; i < numOfInstructions; i++) {
            this.fetchInstruction(showLog);
        }
    }
    executeUntil(breakPoint) {
        while (1) {
            this.fetchInstruction(false);
            if (this.r16[PC] == breakPoint) {
                return;
            }
        }
    }
    halt() {
        throw new Error("HALTED!");
    }
    flag(flag) {
        return (this.r8[F] | flag) > 0;
    }
    cc(index) {
        switch (index) {
            case 0: // NZ
                return (this.r8[F] & FLAG_ZERO) == 0;
                break;
            case 1: // Z;
                return (this.r8[F] & FLAG_ZERO) > 0;
                break;
            case 2: // NC
                return (this.r8[F] & FLAG_CARRY) == 0;
                break;
            case 3: // C
                return (this.r8[F] & FLAG_CARRY) > 0;
                break;
            case 4: // PO
                break;
            case 5: // PE
                break;
            case 6: // P
                break;
            case 7: // M
                break;
        }
        let flag = 1 << (index | 0);
        return (this.r8[F] | flag) > 0;
    }
    set_cc(index, value) {
        // TODO: implement flag setter
    }
    log(address, msg) {
        this.logger.debug(("000" + address.toString(16)).slice(-4) + " : " + msg, this.dumpRegisters());
    }
    ADD8(p1, p2) {
        this.rAlu[0] = (p1 & 0xFF) + (p2 & 0xFF);
        this.log(0, "ADD8 result : " + this.rAlu[0].toString(16));
        this.flags8(this.rAlu[0]);
        return this.rAlu[0] & 0xFF;
    }
    ADD16(p1, p2) {
        p1 = p1 & 0xFFFF | 0;
        p2 = p2 & 0xFFFF | 0;
        this.rAlu[0] = p1 + p2;
        let flags = (this.r8[F] & 0xc4);
        let r2 = (this.rAlu[0] >>> 8);
        flags |= ((r2 & 0xFF) & 0x28);
        flags |= ((r2 & 0x10) > 0 ? FLAG_HALF_CARRY : 0);
        flags |= ((r2 & 0x100) > 0 ? FLAG_CARRY : 0);
        this.r8[F] = flags; // & 0xFF;
        return this.rAlu[0];
    }
    ADD_A(n) {
        this.rAlu[0] = (this.r8[A] + n);
        this.r8[A] = this.rAlu[0];
        // TODO sign stuff correct?     
        this.flags8(this.rAlu[0]);
    }
    set_flags(...flaglist) {
        flaglist.forEach(f => this.r8[F] |= f);
    }
    reset_flags(...flaglist) {
        flaglist.forEach(f => this.r8[F] &= ~f);
    }
    set_parity(val) {
        let sum = 0;
        for (let i = 0; i < 8; i++) {
            sum += (val >> i) && 1;
        }
        // Parity bit is set when parity is even
        this.toggle_flag(Flags.PV, (sum & 0x1) == 0);
    }
    toggle_flag(flag, set) {
        if (set) {
            this.r8[F] &= flag;
        }
        else {
            this.r8[F] != flag;
        }
    }
    flags8(result) {
        this.r8[F] =
            // Copy sign , bit 5 and bit 3 (bit 5 and 3 behaviour is undocumented)
            (result & FLAG_SIGN_F3_F5) |
                // Zero flag
                ((result & 0xFF) == 0 ? FLAG_ZERO : 0) |
                // Overflow flag
                (result > 255 ? FLAG_OVERFLOW : 0) |
                // Not implemented yet
                (false ? FLAG_ADDSUB : 0) |
                // Half carry when bit 4 is set
                ((result & 0x10) > 0 ? FLAG_HALF_CARRY : 0) |
                // Carry when bit 9 is set
                ((result & 0x100) > 0 ? FLAG_CARRY : 0);
    }
    ADC_A(n) {
        let carry = this.r8[F] & FLAG_CARRY ? 1 : 0;
        this.rAlu[0] = (this.r8[A] + n + carry);
        this.r8[A] = this.rAlu[0];
        this.flags8(this.rAlu[0]);
    }
    SUB(n) {
        this.rAlu[0] = this.r8[A] - n;
        this.r8[A] = this.rAlu[0];
        this.flags8(this.rAlu[0]);
    }
    SBC_A(n) {
        let carry = this.r8[F] & FLAG_CARRY ? 1 : 0;
        this.rAlu[0] = (this.r8[A] - n - carry);
        this.r8[A] = this.rAlu[0];
        this.flags8(this.rAlu[0]);
    }
    AND(n) {
        this.r8[A] &= n;
        this.flags8(this.r8[A]);
    }
    XOR(n) {
        this.r8[A] ^= n;
        this.flags8(this.r8[A]);
    }
    OR(n) {
        this.r8[A] |= n;
        this.flags8(this.r8[A]);
    }
    CP(n) {
        this.rAlu[0] = this.r8[A] - n;
        if (n === H) {
            console.log('Break');
        }
        //this.log(this.r16[PC], `CP Result: ${this.rAlu[0]}`);
        this.flags8(this.rAlu[0]);
    }
    rotate(y, value) {
        switch (y) {
            case ROT_RLC:
                {
                    let result = value << 1;
                    result |= (result >> 8);
                    this.r8[F] = result & 0x100 ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_RRC:
                {
                    let lsb = value & 1;
                    let result = (value >> 1) | (lsb << 7);
                    this.r8[F] = lsb ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_RL:
                {
                    let result = value << 1;
                    result |= this.r8[F] & FLAG_CARRY ? 1 : 0;
                    this.r8[F] = result & 0x100 ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_RR:
                {
                    let lsb = value & 1;
                    let result = (value >> 1);
                    if (this.r8[F] | FLAG_CARRY) {
                        result |= 0x80;
                    }
                    this.r8[F] = lsb ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_SLA:
                {
                    let result = value << 1;
                    this.r8[F] = result & 0x100 ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_SRA:
                {
                    let lsb = value & 1;
                    let msb = value & 0x80;
                    let result = (value >> 1) | msb;
                    this.r8[F] = lsb ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_SLL:
                {
                    let result = (value << 1) + 1;
                    this.r8[F] = result & 0x100 ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_SRL:
                {
                    let lsb = value & 1;
                    let result = (value >> 1);
                    // S, H, and N flags reset, Z if result is zero, P/V set if parity is even, C from bit 0.
                    this.r8[F] = lsb ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    // TODO: Flags nog correct implmenented
                    return result;
                }
        }
        return 0;
    }
    handleCBInstruction(log) {
        let addr = this.r16[PC] - 1; // CB already read
        let opcode = this.memory.uread8(this.r16[PC]++);
        let x = opcode >> 6;
        let y = (opcode & 0x3F) >> 3;
        let z = (opcode & 0x07);
        switch (x) {
            case 0:
                if (z == 6) {
                    // (HL) handling
                    this.log(addr, `${rot_debug[y]}  (${r_debug[z]})`);
                    this.memory.uwrite8(this.r16[r[z]], this.rotate(y, this.memory.uread8(this.r16[r[z]])));
                }
                else {
                    this.log(addr, `${rot_debug[y]}  ${r_debug[z]}`);
                    this.r8[r[z]] = this.rotate(y, this.r8[r[z]]);
                }
                break;
            case 1:
                {
                    let mask = 1 << y;
                    let val = 0;
                    if (z == 6) {
                        // (HL) handling
                        if (log) {
                            this.log(addr, `BIT ${y}, (${r_debug[z]})`);
                        }
                        val = this.memory.uread8(this.r16[r[z]]) & mask;
                    }
                    else {
                        // Register version
                        this.log(addr, `BIT ${y}, ${r_debug[z]}`);
                        val = this.r8[r[z]] & mask;
                    }
                    // CARRY is preserved in the BIT command, Half carry is set and the
                    // zero flag is inverted value of the bit which is tested
                    this.r8[F] = (this.r8[F] & FLAG_CARRY) | FLAG_HALF_CARRY | (val ? 0 : FLAG_ZERO);
                }
                break;
            case 2:
                {
                    let mask = (~(1 << y)) & 0xff;
                    if (z == 6) {
                        // (HL) handling
                        if (log) {
                            this.log(addr, `RES ${y}, (${r_debug[z]})`);
                        }
                        this.memory.uwrite8(this.r16[r[z]], this.memory.uread8(this.r16[r[z]]) & mask);
                    }
                    else {
                        // Register version
                        this.log(addr, `RES ${y}, ${r_debug[z]}`);
                        this.r8[r[z]] = this.r8[r[z]] & mask;
                    }
                }
                break;
            case 3:
                {
                    let mask = (1 << y);
                    if (z == 6) {
                        // (HL) handling
                        if (log) {
                            this.log(addr, `SET ${y}, (${r_debug[z]})`);
                        }
                        this.memory.uwrite8(this.r16[r[z]], this.memory.uread8(this.r16[r[z]]) | mask);
                    }
                    else {
                        // Register version
                        this.log(addr, `SET ${y}, ${r_debug[z]}`);
                        this.r8[r[z]] = this.r8[r[z]] | mask;
                    }
                }
                break;
        }
    }
    handleEDInstruction(log) {
        let edAddr = this.r16[PC] - 1; // CB already read
        let opcode = this.memory.uread8(this.r16[PC]++);
        let x = opcode >> 6;
        let y = (opcode & 0x3F) >> 3;
        let z = (opcode & 0x07);
        let p = (opcode & 0x30) >> 4;
        let q = (opcode & 0x08) >> 3;
        if (x === 1) {
            switch (z) {
                case 0:
                    if (y !== 6) {
                        // IN r[y], (C)
                        if (log) {
                            this.log(edAddr, `IN ${r_debug[y]}, (C)`);
                        }
                        this.r8[r[y]] = this.IO.read8(this.r8[C]);
                        this.reset_flags(Flags.N);
                        this.set_parity(this.r8[r[y]]);
                        this.tStates += 12;
                        // N flag reset, P/V represents parity, C flag preserved, all other flags affected by definition.
                    }
                    else {
                        // IN (C)
                        if (true) {
                            this.log(edAddr, `IN (C) NOT IMPLEMENTED UNDOCUMENTED`);
                        }
                    }
                    break;
                case 1:
                    // OUT (C), r[y]
                    if (log && y != 6) {
                        this.log(edAddr, `OUT (C), ${r_debug[y]}`);
                    }
                    if (log && y == 6) {
                        this.log(edAddr, `OUT (C), 0`);
                    }
                    let val = y == 6 ? 0 : this.r8[r[y]];
                    this.IO.write8(this.r8[C], val);
                    this.tStates += 12;
                    // All flags preserved
                    break;
                case 2:
                    if (true) {
                        this.log(edAddr, `NOT IMPLEMENTED`);
                    }
                    break;
                case 3:
                    {
                        let nn = this.memory.uread16(this.r16[PC]);
                        this.r16[PC] += 2;
                        if (q === 0) {
                            if (log) {
                                this.log(edAddr, `LD ($${nn.toString(16)}), ${rp_debug[p]}`);
                            }
                            ;
                            this.memory.uwrite16(nn, this.r16[rp[p]]);
                        }
                        else {
                            if (log) {
                                this.log(edAddr, `LD ${rp_debug[p]}, ($${nn.toString(16)})`);
                            }
                            ;
                            this.r16[rp[p]] = this.memory.uread16(nn);
                        }
                        break;
                    }
                case 4:
                    if (log) {
                        this.log(edAddr, `NEG`);
                    }
                    this.r8[A] = -this.r8[A];
                    this.set_flags(Flags.N);
                    this.toggle_flag(Flags.Z, this.r8[A] == 0);
                    break;
                case 5:
                    if (true) {
                        this.log(edAddr, `NOT IMPLEMENTED`);
                    }
                    if (true) {
                        this.log(edAddr, y === 1 ? "RETI" : "RETN");
                    }
                    this.r16[PC] = this.memory.uread16(this.r16[SP]);
                    this.r16[SP] += 2;
                    break;
                case 6:
                    if (true) {
                        this.log(edAddr, `NOT IMPLEMENTED`);
                    }
                    break;
                case 7:
                    if (true) {
                        this.log(edAddr, `NOT IMPLEMENTED`);
                    }
                    break;
            }
        }
        else if (x === 2) {
            switch (z) {
                case 3:
                    {
                        if (log && y === 4) {
                            this.log(edAddr, `OUTI`);
                        }
                        else if (log && y === 5) {
                            this.log(edAddr, `OUTD`);
                        }
                        else if (log && y === 6) {
                            this.log(edAddr, `OTIR`);
                        }
                        else if (log && y === 7) {
                            this.log(edAddr, `OTDR`);
                        }
                        // OTIR and OTID are the same instructions as OUTI and OUTD
                        // but only repeat until register D is zero.
                        let repeat = y === 6 || y == 7 ? this.r8[B] : 1;
                        let inc = y === 4 || y == 6;
                        for (let i = 0; i < repeat; i++) {
                            this.IO.write8(this.r8[C], this.memory.uread8(this.r16[HL]));
                            if (inc) {
                                this.r16[HL]++;
                            }
                            else {
                                this.r16[HL]--;
                            }
                            this.r8[B]--;
                        }
                        this.r8[F] &= ~FLAG_SIGN_F3_F5; // Reset Negative / Sign flag (others undocumented
                        if (this.r8[B]) {
                            this.r8[F] &= ~FLAG_ZERO;
                        }
                        else {
                            this.r8[F] |= FLAG_ZERO;
                        }
                    }
                    break;
                case 2:
                    {
                        if (log && y === 4) {
                            this.log(edAddr, `INI`);
                        }
                        else if (log && y === 5) {
                            this.log(edAddr, `IND`);
                        }
                        else if (log && y === 6) {
                            this.log(edAddr, `INIR`);
                        }
                        else if (log && y === 7) {
                            this.log(edAddr, `INDR`);
                        }
                        // OTIR and OTID are the same instructions as OUTI and OUTD
                        // but only repeat until register D is zero.
                        let repeat = y === 6 || y == 7 ? this.r8[B] : 1;
                        let inc = y === 4 || y == 6;
                        for (let i = 0; i < repeat; i++) {
                            this.memory.uwrite8(this.r16[HL], this.IO.read8(this.r8[C]));
                            if (inc) {
                                this.r16[HL]++;
                            }
                            else {
                                this.r16[HL]--;
                            }
                            this.r8[B]--;
                        }
                        this.r8[F] &= ~FLAG_SIGN_F3_F5; // Reset Negative / Sign flag (others undocumented
                        if (this.r8[B]) {
                            this.r8[F] &= ~FLAG_ZERO;
                        }
                        else {
                            this.r8[F] |= FLAG_ZERO;
                        }
                    }
                    break;
                case 1:
                    throw new Error('NOT IMPLEMENTED');
                    break;
                case 0:
                    {
                        if (log && y === 4) {
                            this.log(edAddr, `LDI`);
                        }
                        else if (log && y === 5) {
                            this.log(edAddr, `LDD`);
                        }
                        else if (log && y === 6) {
                            this.log(edAddr, `LDIR`);
                        }
                        else if (log && y === 7) {
                            this.log(edAddr, `LDDR`);
                        }
                        // LDIR and LDDR are the same instructions as LDI and LDD
                        // but only repeat until register D is zero.
                        let repeat = y === 6 || y == 7 ? this.r16[BC] : 1;
                        // Increment or decrement 
                        let inc = y === 4 || y == 6;
                        for (let i = 0; i < repeat; i++) {
                            this.memory.uwrite8(this.r16[DE], this.memory.uread8(this.r16[HL]));
                            if (inc) {
                                this.r16[HL]++;
                                this.r16[DE]++;
                            }
                            else {
                                this.r16[HL]--;
                                this.r16[DE]--;
                            }
                            this.r16[BC]--;
                        }
                        if (this.r16[BC] == 0) {
                            this.reset_flags(Flags.PV);
                        }
                    }
                    break;
            }
        }
        return this.tStates;
    }
    fetchInstruction(log) {
        //this.dumpRegisters();
        if (this.halted) {
            return;
        }
        if (!this.r16[PC]) {
            console.log("DEVICE (RE)STARTED");
        }
        // else {
        //     console.log(this.r16[PC].toString(16));
        // }
        let addr = this.r16[PC]++;
        let opcode = this.memory.uread8(addr);
        let opcodeMode = 0;
        let tStates = 0; // Number of TStates the operation took
        //this.log(addr, `Opcode: ${opcode.toString(16)}`);
        // TODO: support more 0xDD or 0xFD opcodes and use the last one as
        if (opcode === 0xDD || opcode === 0xFD) {
            opcodeMode = opcode;
            opcode = this.memory.uread8(this.r16[PC]++);
        }
        if (opcode === 0xED) {
            return this.handleEDInstruction(log);
        }
        let x = opcode >> 6;
        let y = (opcode & 0x3F) >> 3;
        let z = (opcode & 0x07);
        let p = (opcode & 0x30) >> 4;
        let q = (opcode & 0x08) >> 3;
        //console.log(`OPCODE: ${opcode.toString(16)}, x = ${x}`);
        if (x === 0) {
            if (z === 0) {
                switch (y) {
                    case 0:
                        if (log) {
                            this.log(addr, "NOP");
                        }
                        this.tStates += 4;
                        break;
                    case 1:
                        {
                            if (log) {
                                this.log(addr, "EX AF, AF'");
                            }
                            let tmp = this.r16[AF];
                            this.r16[AF] = this.r16s[AF];
                            this.r16s[AF] = this.r16[AF];
                            this.tStates += 4;
                        }
                        break;
                    case 2:
                        {
                            let d = this.memory.read8(this.r16[PC]++);
                            if (log) {
                                this.log(addr, "DJNZ " + d);
                            }
                            this.r8[B]--;
                            this.r16[PC] += this.r8[B] !== 0 ? d : 0;
                            this.tStates += this.r8[B] !== 0 ? 13 : 8;
                        }
                        break;
                    case 3:
                        {
                            let d = this.memory.read8(this.r16[PC]++);
                            if (log) {
                                this.log(addr, "JR " + d);
                            }
                            this.r16[PC] += d;
                            this.tStates += 10;
                        }
                        break;
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                        {
                            let d = this.memory.read8(this.r16[PC]++);
                            if (log) {
                                this.log(addr, `JR ${cc_debug[y - 4]}, ${d}`);
                            }
                            this.r16[PC] += this.cc(y - 4) ? d : 0;
                            this.tStates += this.cc(y - 4) ? 12 : 7;
                        }
                    default:
                }
            }
            if (z === 1) {
                if (q === 0) {
                    let nn = this.memory.uread8(this.r16[PC]++) | (this.memory.uread8(this.r16[PC]++) << 8);
                    if (log) {
                        this.log(addr, "LD " + rp_debug_dd_fd[opcodeMode][p] + ", $" + nn.toString(16));
                    }
                    this.r16[rp_dd_fd[opcode][p]] = nn; //(nn & 0xFF)  << 8 + ((nn >> 8) & 0xFF);
                }
                if (q == 1) {
                    // TODO: Check flag modification
                    if (opcodeMode == 0) {
                        if (log) {
                            this.log(addr, `ADD HL, ` + rp_debug[p]);
                        }
                        this.r16[HL] = this.ADD16(this.r16[HL], this.r16[rp[p]]);
                        this.tStates += 11;
                    }
                    else if (opcodeMode == 0xdd) {
                        if (log) {
                            this.log(addr, `ADD IX, ` + rp_debug_dd[p]);
                        }
                        this.r16[IX] = this.ADD16(this.r16[IX], this.r16[rp_dd[p]]);
                        this.tStates += 15;
                    }
                    else {
                        if (log) {
                            this.log(addr, `ADD IY, ` + rp_debug_fd[p]);
                        }
                        this.r16[IY] = this.ADD16(this.r16[IY], this.r16[rp_fd[p]]);
                        this.tStates += 15;
                    }
                }
            }
            if (z === 2) {
                if (p < 2) {
                    if (q === 0) {
                        if (log) {
                            this.log(addr, "LD (" + rp_debug[p] + "), A");
                        }
                        this.memory.uwrite8(this.r16[rp[p]], this.r8[A]);
                    }
                    else {
                        if (log) {
                            this.log(addr, "LD A, (" + rp_debug[p] + ")");
                        }
                        this.r8[A] = this.memory.read8(this.r16[rp[p]]);
                    }
                }
                else {
                    // Fetch 16bits address location
                    let nn = this.memory.uread8(this.r16[PC]++) + (this.memory.uread8(this.r16[PC]++) << 8);
                    if (q === 0) {
                        if (p === 2) {
                            if (log) {
                                this.log(addr, "LD (" + nn.toString(16) + "), HL");
                            }
                            this.memory.uwrite16(nn, this.r16[HL]);
                        }
                        else {
                            if (log) {
                                this.log(addr, "LD (" + nn.toString(16) + "), A");
                            }
                            this.memory.uwrite8(nn, this.r8[A]);
                        }
                    }
                    else {
                        if (p === 2) {
                            if (log) {
                                this.log(addr, "LD HL, (" + nn.toString(16) + ")");
                            }
                            this.r16[HL] = this.memory.uread16(nn);
                        }
                        else {
                            if (log) {
                                this.log(addr, "LD A, (" + nn.toString(16) + ")");
                            }
                            this.r8[A] = this.memory.uread8(nn);
                        }
                    }
                }
            }
            if (z === 3) {
                if (log) {
                    this.log(addr, (q === 0 ? "INC" : "DEC") + " " + rp_debug[p]);
                }
                this.r16[rp[p]] += (q === 0 ? 1 : -1);
            }
            if (z === 4) {
                if (log) {
                    this.log(addr, "INC " + r_debug[y]);
                }
                this.flags8(++this.r8[r[y]]);
            }
            if (z === 5) {
                if (log) {
                    this.log(addr, "DEC " + r_debug[y]);
                }
                this.flags8(--this.r8[r[y]]);
            }
            if (z === 6) {
                let n = this.memory.uread8(this.r16[PC]++);
                if (log) {
                    this.log(addr, `LD ${r_debug[y]}, ${this.hex8(n)}`);
                }
                this.r8[r[y]] = n;
            }
            if (z === 7) {
                switch (y) {
                    case 0: // RLCA
                        {
                            if (log) {
                                this.log(addr, 'RLCA');
                            }
                            let result = this.r8[A] << 1;
                            let carry = (result & 0x100) > 0;
                            this.r8[A] = result | (carry ? 1 : 0);
                            this.toggle_flag(Flags.C, carry);
                            this.reset_flags(Flags.H, Flags.N);
                        }
                        break;
                    case 1: // RRCA
                        {
                            if (log) {
                                this.log(addr, 'RRCA');
                            }
                            let carry = (this.r8[A] & 1) === 1;
                            this.r8[A] = (this.r8[A] >> 1) | (carry ? 0x80 : 0);
                            this.toggle_flag(Flags.C, carry);
                            this.reset_flags(Flags.H, Flags.N);
                        }
                        break;
                    case 2: // RLA
                        if (log) {
                            this.log(addr, 'RLA');
                        }
                        let result = this.r8[A] << 1;
                        let carry = (result & 0x100) > 0;
                        this.r8[A] = result;
                        this.toggle_flag(Flags.C, carry);
                        this.reset_flags(Flags.H, Flags.N);
                        this.tStates += 4;
                        // C is changed to the leaving 7th bit, H and N are reset, P/V , S and Z are preserved.
                        break;
                    case 3: // RRA
                        throw new Error('RRA NOT IMPLEMENTED');
                        break;
                    case 4: // DAA
                        // if the lower 4 bits form a number greater than 9 or H is set, add $06 to the accumulator
                        // if the upper 4 bits form a number greater than 9 or C is set, add $60 to the accumulator
                        if (log) {
                            this.log(addr, 'DAA');
                        }
                        let lsb = this.r8[A] & 0xf;
                        let msb = this.r8[A] >> 4;
                        if (lsb > 9 || (this.r8[F] & Flags.H)) {
                            lsb += 6;
                        }
                        if (msb > 9 || (this.r8[F] & Flags.C)) {
                            msb += 6;
                            this.set_flags(Flags.C);
                        }
                        this.r8[A] = msb << 4 + lsb;
                        this.set_parity(this.r8[A]);
                        this.tStates += 4;
                        break;
                    case 5: // CPL
                        {
                            if (log) {
                                this.log(addr, 'CPL');
                            }
                            this.r8[A] = ~this.r8[A];
                            this.r8[F] = this.r8[F] | FLAG_HALF_CARRY | FLAG_ADDSUB;
                            break;
                        }
                    case 6: // SCF    
                        if (log) {
                            this.log(addr, 'SCF');
                        }
                        this.set_flags(Flags.C);
                        this.reset_flags(Flags.H, Flags.N);
                        break;
                    case 7: // CCF
                        throw new Error('CCF NOT IMPLEMENTED');
                        break;
                }
            }
        }
        if (x === 1) {
            if (z === 6 && y === 6) {
                if (log) {
                    this.log(addr, "HALT");
                }
                this.halted = true;
                // Go to the halted state, when an interrupt occurs,
                // the PC can be pushed on the stack and operation will continue
                //this.r16[PC]--;
            }
            else {
                if (y == 6) {
                    if (log) {
                        this.log(addr, `LD (${r_debug[y]}), ${r_debug[z]}`);
                    }
                    this.memory.uwrite8(this.r16[r[y]], this.r8[r[z]]);
                }
                else if (z == 6) {
                    if (log) {
                        this.log(addr, `LD ${r_debug[y]}, (${r_debug[z]})`);
                    }
                    this.r8[r[y]] = this.memory.uread8(this.r16[r[z]]);
                }
                else {
                    if (log) {
                        this.log(addr, `LD ${r_debug[y]}, ${r_debug[z]}`);
                    }
                    this.r8[r[y]] = this.r8[r[z]];
                }
            }
        }
        if (x === 2) {
            if (z == 6) {
                if (log) {
                    this.log(addr, `${alu_debug[y]} (${r_debug[z]})`);
                }
                let val = this.memory.uread8(this.r16[r[z]]);
                if (val === undefined) {
                    console.log('ERROR, should not read undefined');
                    val = this.memory.uread8(this.r16[r[z]]);
                }
                //console.log(val.toString(16));
                this.aluOperation(y, val);
            }
            else {
                if (log) {
                    this.log(addr, `${alu_debug[y]} ${r_debug[z]}`);
                }
                this.aluOperation(y, this.r8[r[z]]);
            }
        }
        if (x === 3) {
            if (z === 0) {
                if (log) {
                    this.log(addr, `RET ${cc_debug[y]}`);
                }
                if (log) {
                    this.log(addr, `${cc_debug[y]} FLAG : ${this.cc(y)}`);
                }
                if (this.cc(y)) {
                    this.r16[PC] = this.memory.uread16(this.r16[SP]);
                    this.r16[SP] += 2;
                }
            }
            if (z === 1) {
                if (q === 0) {
                    if (log) {
                        this.log(addr, `POP ${rp2_debug[p]}`);
                    }
                    this.r16[rp2[p]] = this.memory.uread16(this.r16[SP]);
                    this.r16[SP] += 2;
                }
                else {
                    switch (p) {
                        case 0:
                            if (true) {
                                this.log(addr, `RET PC=${this.memory.uread16(this.r16[SP]).toString(16)}`);
                            }
                            this.r16[PC] = this.memory.uread16(this.r16[SP]);
                            this.r16[SP] += 2;
                            break;
                        case 1:
                            if (log) {
                                this.log(addr, 'EXX');
                            }
                            let bc = this.r16[BC];
                            let de = this.r16[DE];
                            let hl = this.r16[HL];
                            this.r16[BC] = this.r16s[BC];
                            this.r16[DE] = this.r16s[DE];
                            this.r16[HL] = this.r16s[HL];
                            this.r16s[BC] = bc;
                            this.r16s[DE] = de;
                            this.r16s[HL] = hl;
                            break;
                        case 2:
                            if (log) {
                                this.log(addr, 'JP HL');
                            }
                            this.r16[PC] = this.r16[HL];
                            break;
                        case 3:
                            if (log) {
                                this.log(addr, 'LD SP,HL');
                            }
                            this.r16[SP] = this.r16[HL];
                            break;
                    }
                }
            }
            if (z === 2) {
                let nn = this.memory.uread16(this.r16[PC]);
                this.r16[PC] += 2;
                if (log) {
                    this.log(addr, `JP ${cc_debug[y]}, ${(nn).toString(16)}`);
                }
                if (this.cc(y)) {
                    this.r16[PC] = nn;
                }
                //this.r16[PC] += this.cc(y - 4) ? d : 0;
            }
            if (z === 3) {
                let n;
                switch (y) {
                    case 0: //	JP nn
                        let nn = this.memory.uread16(this.r16[PC]);
                        if (log) {
                            this.log(addr, `JP ${this.hex16(nn)}`);
                        }
                        this.r16[PC] = nn;
                        break;
                    case 1: //(CB prefix)                        
                        this.handleCBInstruction(log);
                        break;
                    case 2: //OUT (n), A
                        n = this.memory.uread8(this.r16[PC]++);
                        if (log) {
                            this.log(addr, `OUT (0x${n.toString(16)}), A`);
                        }
                        this.IO.write8(n, this.r8[A]);
                        break;
                    case 3: //IN A, (n)
                        n = this.memory.uread8(this.r16[PC]++);
                        if (log) {
                            this.log(addr, `IN A,(0x${n.toString(16)})`);
                        }
                        this.r8[A] = this.IO.read8(n);
                        // TODO: CHECK FLAGS
                        break;
                    case 4: //EX (SP), HL 
                        if (log) {
                            this.log(addr, `EX (SP), HL`);
                        }
                        let sp = this.memory.uread16(this.r16[SP]);
                        this.memory.uwrite16(this.r16[SP], this.r16[HL]);
                        this.r16[HL] = sp;
                        break;
                    case 5: //EX DE, HL   
                        if (log) {
                            this.log(addr, `EX DE, HL`);
                        }
                        let de = this.r16[DE];
                        this.r16[DE] = this.r16[HL];
                        this.r16[HL] = de;
                        break;
                    case 6: //DI
                        if (log) {
                            this.log(addr, `DI`);
                        }
                        this.interruptEnabled = false;
                        break;
                    case 7: //EI
                        if (log) {
                            this.log(addr, `EI`);
                        }
                        this.interruptEnabled = true;
                        break;
                }
            }
            if (z === 4) {
                let nn = this.memory.uread16(this.r16[PC]++);
                this.r16[PC] += 2;
                if (log) {
                    this.log(addr, `CALL ${cc_debug[y]}, ${this.hex16(nn)}`);
                }
                if (this.cc(y)) {
                    this.r16[SP] -= 2;
                    this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                    this.log(addr, `CALL CONDITIONAL ${this.hex16(nn)}`);
                    this.r16[PC] = nn;
                }
            }
            if (z === 5) {
                if (q === 0) {
                    if (log) {
                        this.log(addr, `PUSH ${rp2_debug_dd_fd[opcodeMode][p]}`);
                    }
                    this.r16[SP] -= 2;
                    this.memory.uwrite16(this.r16[SP], this.r16[rp2_dd_fd[opcodeMode][p]]);
                }
                else {
                    if (p === 0) {
                        let nn = this.memory.uread16(this.r16[PC]);
                        this.r16[PC] += 2;
                        this.r16[SP] -= 2;
                        this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                        this.log(addr, `CALL ${this.hex16(nn)}`);
                        this.r16[PC] = nn;
                    }
                    else if (p === 1) {
                    }
                    else if (p === 2) {
                    }
                    else if (p === 3) {
                    }
                }
            }
            if (z === 6) {
                let n = this.memory.uread8(this.r16[PC]++);
                if (log) {
                    this.log(addr, alu_debug[y] + " $" + n.toString(16));
                }
                this.aluOperation(y, n);
            }
            if (z === 7) {
                if (log) {
                    this.log(addr, `RST ${(y * 8).toString(16)}`);
                }
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = y * 8;
            }
        }
    }
    aluOperation(y, n) {
        switch (y) {
            case ALU_ADD_A:
                this.ADD_A(n);
                break;
            case ALU_ADC_A:
                this.ADC_A(n);
                break;
            case ALU_SUB:
                this.SUB(n);
                break;
            case ALU_SBC_A:
                this.SBC_A(n);
                break;
            case ALU_AND:
                this.AND(n);
                break;
            case ALU_XOR:
                this.XOR(n);
                break;
            case ALU_OR:
                this.OR(n);
                break;
            case ALU_CP:
                this.CP(n);
                break;
        }
    }
    interrupt() {
        if (this.interruptEnabled) {
            // Push the program counter
            this.r16[PC] += 2;
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            // Execute the interrupt routine
            this.halted = false;
            let retadd = this.r16[PC];
            this.r16[PC] = 0x0038;
            this.log(0x0038, `INT ($${retadd})`);
        }
    }
}
