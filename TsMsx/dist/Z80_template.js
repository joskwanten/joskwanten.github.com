export const A = 1;
export const F = 0;
export const B = 3;
export const C = 2;
export const D = 5;
export const E = 4;
export const H = 7;
export const L = 6;
export const I = 16;
export const R = 17;
export const IXh = 9;
export const IXl = 8;
export const IYh = 11;
export const IYl = 10;
export const r16_debug = ["AF", "BC", "DE", "HL", "IX", "IY", "SP", "PC"];
export const AF = 0;
export const BC = 1;
export const DE = 2;
export const HL = 3;
export const IX = 4;
export const IY = 5;
export const SP = 6;
export const _I = 7;
export const _R = 8;
export const PC = 9;
export const _F = 10;
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
    Flags[Flags["S_F5_F3"] = 168] = "S_F5_F3";
})(Flags || (Flags = {}));
var LogicalOperation;
(function (LogicalOperation) {
    LogicalOperation[LogicalOperation["AND"] = 0] = "AND";
    LogicalOperation[LogicalOperation["OR"] = 1] = "OR";
    LogicalOperation[LogicalOperation["XOR"] = 2] = "XOR";
})(LogicalOperation || (LogicalOperation = {}));
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
        // Interrupt flags 
        this.iff1 = true;
        this.iff2 = true;
        // flag to indicate if the CPU is halted
        this.halted = false;
        this.cycles = 0;
        this.opcodes = [];
        this.opcodesED = [];
        this.opcodesDD = [];
        this.opcodesFD = [];
        this.opcodesCB = [];
        this.opcodesDDCB = [];
        this.opcodesFDCB = [];
        this.evenParity = [];
        this.systemCalls = [];
        this.logging = false;
        // Generate parity table for fast computation of parity
        this.generateEvenParityTable();
        this.opcodes[0xED] = (addr) => {
            let opcode = this.memory.uread8(this.r16[PC]++);
            let func = this.opcodesED[opcode];
            if (func) {
                func(addr);
            }
            else {
                this.log(this.r16[PC] - 1, `Unknown opcode ED ${opcode.toString(16)}`);
                this.opcodes[0x00](addr);
            }
        };
        this.opcodes[0xDD] = (addr) => {
            let opcode = this.memory.uread8(this.r16[PC]++);
            let func = this.opcodesDD[opcode];
            if (func) {
                func(addr);
            }
            else {
                this.log(this.r16[PC] - 1, `Unknown opcode DD ${opcode.toString(16)}`);
                this.opcodes[0x00](addr);
            }
        };
        this.opcodes[0xFD] = (addr) => {
            let opcode = this.memory.uread8(this.r16[PC]++);
            let func = this.opcodesFD[opcode];
            if (func) {
                func(addr);
            }
            else {
                this.log(this.r16[PC] - 1, `Unknown opcode FD ${opcode.toString(16)}`);
                this.opcodes[0x00](addr);
            }
        };
        this.opcodes[0xCB] = (addr) => {
            let opcode = this.memory.uread8(this.r16[PC]++);
            let func = this.opcodesCB[opcode];
            if (func) {
                func(addr);
            }
            else {
                this.log(this.r16[PC] - 1, `Unknown opcode CB ${opcode.toString(16)}`);
                this.opcodes[0x00](addr);
            }
        };
        this.opcodesDD[0xCB] = (addr) => {
            let o = this.memory.uread8(this.r16[PC]++);
            let opcode = this.memory.uread8(this.r16[PC]++);
            let func = this.opcodesDDCB[opcode];
            if (func) {
                func(addr, o);
            }
            else {
                this.log(this.r16[PC] - 2, `Unknown opcode DDCB ${o} ${opcode.toString(16)}`);
                this.opcodes[0x00](addr);
            }
        };
        this.opcodesFD[0xCB] = (addr) => {
            let o = this.memory.uread8(this.r16[PC]++);
            let opcode = this.memory.uread8(this.r16[PC]++);
            let func = this.opcodesFDCB[opcode];
            if (func) {
                func(addr, o);
            }
            else {
                this.log(this.r16[PC] - 2, `Unknown opcode FDCB ${o} ${opcode.toString(16)}`);
                this.opcodes[0x00](addr);
            }
        };
        this.addOpcodes();
    }
    addSub8(value1, value2, sub, carry) {
        // If carry has to be taken into account add one to the second operand
        if (carry && (this.r8[F] & Flags.C)) {
            value2 += 1;
        }
        let result = sub ? value1 - value2 : value1 + value2;
        // Set / Reset N flag depending if it is an addition or substraction
        if (sub) {
            this.r8[F] |= Flags.N;
        }
        else {
            this.r8[F] &= ~Flags.N;
        }
        // Set Zero flag if result is zero
        if ((result & 0xff) === 0) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        // Set Sign / F3 / F5 are copies of the result
        this.r8[F] &= ~Flags.S_F5_F3; // Reset bits
        this.r8[F] |= (result & Flags.S_F5_F3); // Set bits if set in the result
        // Set carry if bit 9 is set
        if (result & 0x100) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        // Overflow, if signs of both values are the same and the sign result is different, then we have
        // an overflow e.g. when adding 0x7f (127) + 1 = 0x80 (-1)
        if (sub) {
            let overflow = ((value1 & 0x80) !== (value2 & 0x80)) && ((result & 0x80) !== (value1 & 0x80));
            if (overflow) {
                this.r8[F] |= Flags.PV;
            }
            else {
                this.r8[F] &= ~Flags.PV;
            }
            let H = (((value1 & 0x0f) - (value2 & 0x0f)) & 0x10) ? true : false;
            if (H) {
                this.r8[F] |= Flags.H;
            }
            else {
                this.r8[F] &= ~Flags.H;
            }
        }
        else {
            let overflow = ((value1 & 0x80) == (value2 & 0x80)) && ((result & 0x80) !== (value1 & 0x80));
            if (overflow) {
                this.r8[F] |= Flags.PV;
            }
            else {
                this.r8[F] &= ~Flags.PV;
            }
            let H = (((value1 & 0x0f) + (value2 & 0x0f)) & 0x10) ? true : false;
            if (H) {
                this.r8[F] |= Flags.H;
            }
            else {
                this.r8[F] &= ~Flags.H;
            }
        }
        return result;
    }
    neg(value) {
        let result = (value === 0x80) ? 0x80 : -value;
        // Set N flag
        this.r8[F] |= Flags.N;
        // Set Half carry if lower nibble is > 0 before making the number negative
        if ((value & 0x0f) > 0) {
            this.r8[F] |= Flags.H;
        }
        else {
            this.r8[F] &= ~Flags.H;
        }
        // // Set Zero flag if result is zero
        if ((result & 0xff) === 0) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        // // Set Sign / F3 / F5 are copies of the result
        this.r8[F] &= ~Flags.S_F5_F3; // Reset bits
        this.r8[F] |= (result & Flags.S_F5_F3); // Set bits if set in the result
        // // Set carry if result != 0
        if (result) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        // // Set overflow if bit 8 is set
        if (value === 0x80) {
            this.r8[F] |= Flags.PV;
        }
        else {
            this.r8[F] &= ~Flags.PV;
        }
        return result;
    }
    addSub16(operand1, operand2, sub, withCarry) {
        // If carry has to be taken into account add one to the second operand
        if (withCarry && (this.r8[F] & Flags.C)) {
            operand2 += 1;
        }
        let result = sub ? operand1 - operand2 : operand1 + operand2;
        // Reset N flag since we are adding
        if (sub) {
            this.r8[F] |= Flags.N;
            if (((operand1 & 0x0fff) - (operand2 & 0x0fff)) & 0x1000) {
                this.r8[F] |= Flags.H;
            }
            else {
                this.r8[F] &= ~Flags.H;
            }
        }
        else {
            this.r8[F] &= ~Flags.N;
            // Set half carry
            if (((operand1 & 0x0fff) + (operand2 & 0x0fff)) & 0x1000) {
                this.r8[F] |= Flags.H;
            }
            else {
                this.r8[F] &= ~Flags.H;
            }
        }
        // Set carry if bit 9 is set
        if (result & 0x10000) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        // Set flags for ADC operation
        if (withCarry) {
            // Set Zero flag if result is zero
            if ((result & 0xffff) === 0) {
                this.r8[F] |= Flags.Z;
            }
            else {
                this.r8[F] &= ~Flags.Z;
            }
            if (sub) {
                let overflow = ((operand1 & 0x8000) !== (operand2 & 0x8000)) && ((result & 0x8000) !== (operand1 & 0x8000));
                if (overflow) {
                    this.r8[F] |= Flags.PV;
                }
                else {
                    this.r8[F] &= ~Flags.PV;
                }
            }
            else {
                let overflow = ((operand1 & 0x8000) === (operand2 & 0x8000)) && ((result & 0x8000) !== (operand1 & 0x8000));
                if (overflow) {
                    this.r8[F] |= Flags.PV;
                }
                else {
                    this.r8[F] &= ~Flags.PV;
                }
            }
            if (result & 0x8000) {
                this.r8[F] |= Flags.S;
            }
            else {
                this.r8[F] &= ~Flags.S;
            }
        }
        return result;
    }
    registerSystemCall(addr, func) {
        this.systemCalls[addr] = func;
    }
    inc8(operand) {
        let result = operand + 1;
        // Reset N flag if it is an increment
        this.r8[F] &= ~Flags.N;
        // Set Zero flag if result is zero
        if ((result & 0xff) === 0) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        // Set Sign / F3 / F5 are copies of the result
        this.r8[F] &= ~Flags.S_F5_F3; // Reset bits
        this.r8[F] |= (result & Flags.S_F5_F3); // Set bits if set in the result
        // Carry is unaffected
        // Half carry
        let halfcarry = (operand & 0xf) === 0xf;
        if (halfcarry) {
            this.r8[F] |= Flags.H;
        }
        else {
            this.r8[F] &= ~Flags.H;
        }
        // Overflow, if the sign becomes negative when adding one
        let overflow = (operand === 0x7f);
        if (overflow) {
            this.r8[F] |= Flags.PV;
        }
        else {
            this.r8[F] &= ~Flags.PV;
        }
        return result;
    }
    dec8(operand) {
        let result = operand - 1;
        // Reset N flag if it is an increment
        this.r8[F] |= Flags.N;
        // Set Zero flag if result is zero
        if ((result & 0xff) === 0) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        // Set Sign / F3 / F5 are copies of the result
        this.r8[F] &= ~Flags.S_F5_F3; // Reset bits
        this.r8[F] |= (result & Flags.S_F5_F3); // Set bits if set in the result
        // Carry is unaffected
        // Half carry
        let halfcarry = (operand & 0xf) === 0;
        if (halfcarry) {
            this.r8[F] |= Flags.H;
        }
        else {
            this.r8[F] &= ~Flags.H;
        }
        // Overflow, if the sign becomes negative when adding one
        let overflow = (operand === 0x80);
        if (overflow) {
            this.r8[F] |= Flags.PV;
        }
        else {
            this.r8[F] &= ~Flags.PV;
        }
        return result;
    }
    logicalOperation(value, operation) {
        // Add 1 or in case of decrement the two's complement of one
        this.r8[A] = (operation == LogicalOperation.AND) ? this.r8[A] & value
            : (operation == LogicalOperation.OR) ? this.r8[A] | value
                : this.r8[A] ^ value;
        // Reset N and C flags
        this.r8[F] &= ~Flags.N;
        this.r8[F] &= ~Flags.C;
        // Set Zero flag if result is zero
        if (this.r8[A] === 0) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        // Set sign if the result has its sign bit set (2-complement)
        if (this.r8[A] & 0x80) {
            this.r8[F] |= Flags.S;
        }
        else {
            this.r8[F] &= ~Flags.S;
        }
        // Set parity if even
        if (this.evenParity[this.r8[A]]) {
            this.r8[F] |= Flags.PV;
        }
        else {
            this.r8[F] &= ~Flags.PV;
        }
        // And operation set H else reset
        if (operation === LogicalOperation.AND) {
            this.r8[F] |= Flags.H;
        }
        else {
            this.r8[F] &= ~Flags.H;
        }
    }
    shiftRotateFlags(result, PVFlag) {
        // Reset H and N flags
        this.r8[F] &= ~Flags.H;
        this.r8[F] &= ~Flags.N;
        // Set Zero flag if result is zero
        if ((result & 0xff) === 0) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        // Set sign if the result has its sign bit set (2-complement)
        if (result & 0x80) {
            this.r8[F] |= Flags.S;
        }
        else {
            this.r8[F] &= ~Flags.S;
        }
        // Set parity if even
        if (PVFlag) {
            if (this.evenParity[result & 0xff]) {
                this.r8[F] |= Flags.PV;
            }
            else {
                this.r8[F] &= ~Flags.PV;
            }
        }
    }
    rotateLeft(value) {
        let result = (value << 1) + ((this.r8[F] & Flags.C) ? 1 : 0);
        if (result & 0x100) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        this.shiftRotateFlags(result, true);
        return result;
    }
    rotateLeftCarry(value, PVFlag = true) {
        let result = (value << 1);
        // If we have a carry set bit 0 and the carry flag
        if (result & 0x100) {
            result |= 1;
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        this.shiftRotateFlags(result, PVFlag);
        return result;
    }
    rotateRight(value) {
        // bit 0 will be shifted to the carry
        let bit0 = value & 1;
        // Do shifting and add carry as bit 7 (0x80)
        let result = (value >>> 1) + ((this.r8[F] & Flags.C) ? 0x80 : 0);
        // Store bit 0 into the carry
        if (bit0) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        // Set flags
        this.shiftRotateFlags(result, true);
        return result;
    }
    rotateRightCarry(value, PVFlag = true) {
        // bit 0 will be shifted to the carry
        let bit0 = value & 1;
        // Do shifting and add bit0 as bit 7 (0x80)
        let result = ((value >>> 1) & 0x7f) + (bit0 ? 0x80 : 0);
        // Store bit0 into the carry
        if (bit0) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        // Set flags
        this.shiftRotateFlags(result, PVFlag);
        return result;
    }
    shiftLeft(value) {
        // Do shifting and add bit0 as bit 7 (0x80)
        let result = (value << 1);
        // Store bit0 into the carry
        if (result & 0x100) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        // Set flags
        this.shiftRotateFlags(result, true);
        return result;
    }
    shiftLeftLogical(value) {
        // Do shifting and add bit0 as bit 7 (0x80)
        let result = (value << 1) | 1;
        // Store bit0 into the carry
        if (result & 0x100) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        // Set flags
        this.shiftRotateFlags(result, true);
        return result;
    }
    shiftRightLogic(value) {
        // Do shifting and add bit0 as bit 7 (0x80)
        let result = (value >> 1);
        // Store original bit0 into the carry
        if (value & 1) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        // Set flags
        this.shiftRotateFlags(result, true);
        return result;
    }
    shiftRightArithmetic(value) {
        // Do shifting and add bit0 as bit 7 (0x80)
        let result = (value >> 1);
        // Copy bit 7 from the original value to maintain the same sign
        result |= (value & 0x80);
        // Store original bit0 into the carry
        if (value & 1) {
            this.r8[F] |= Flags.C;
        }
        else {
            this.r8[F] &= ~Flags.C;
        }
        // Set flags
        this.shiftRotateFlags(result, true);
        return result;
    }
    interruptMode(value) {
        // TODO: Msx uses Mode 0 so we don't bother right now
    }
    rotateRLD() {
        // Performs a 4-bit leftward rotation of the 12-bit number whose 4 most signigifcant 
        // bits are the 4 least significant bits of A, and its 8 least significant bits are in (HL).
        let val = this.memory.uread8(this.r16[HL]);
        let temp1 = val & 0xf0, temp2 = this.r8[A] & 0x0f;
        val = ((val & 0x0f) << 4) | temp2;
        this.r8[A] = (this.r8[A] & 0xf0) | (temp1 >>> 4);
        this.memory.uwrite8(this.r16[HL], val);
        // Set Sign / F3 / F5 are copies of the result
        this.r8[F] &= ~Flags.S_F5_F3; // Reset bits
        this.r8[F] |= (this.r8[A] & Flags.S_F5_F3); // Set bits if set in the result
        // Set Zero flag if result in A is 0
        if (this.r8[A] === 0) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        // The H and N flags are reset, P/V is parity, C is preserved, and S and Z are modified by definition.
        this.r8[F] &= ~(Flags.H | Flags.N);
        if (this.evenParity[this.r8[A]]) {
            this.r8[F] |= Flags.PV;
        }
        else {
            this.r8[F] &= ~Flags.PV;
        }
    }
    rotateRRD() {
        // Like rld, except rotation is rightward.
        let val = this.memory.uread8(this.r16[HL]);
        let temp1 = val & 0x0f, temp2 = this.r8[A] & 0x0f;
        val = ((val & 0xf0) >>> 4) | (temp2 << 4);
        this.r8[A] = (this.r8[A] & 0xf0) | temp1;
        this.memory.uwrite8(this.r16[HL], val);
        // Set Sign / F3 / F5 are copies of the result
        this.r8[F] &= ~Flags.S_F5_F3; // Reset bits
        this.r8[F] |= (this.r8[A] & Flags.S_F5_F3); // Set bits if set in the result
        // Set Zero flag if result in A is 0
        if (this.r8[A] === 0) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        // The H and N flags are reset, P/V is parity, C is preserved, and S and Z are modified by definition.
        this.r8[F] &= ~(Flags.H | Flags.N);
        if (this.evenParity[this.r8[A]]) {
            this.r8[F] |= Flags.PV;
        }
        else {
            this.r8[F] &= ~Flags.PV;
        }
    }
    generateEvenParityTable() {
        this.evenParity = [...Array(256).keys()]
            .map(x => {
            let sum = 0;
            for (let i = 0; i < 8; i++) {
                sum += ((x >> i) & 1);
            }
            ;
            return !(sum & 1);
        });
    }
    bit(n, value) {
        // Opposite of the nth bit is written into the Z flag. 
        // C is preserved, 
        // N is reset, H is set, and S and P/V are undefined.
        if (value & (1 << n)) {
            this.r8[F] &= ~Flags.Z;
            this.r8[F] &= ~Flags.PV;
            if (n === 7) {
                this.r8[F] |= Flags.S;
            }
            else {
                this.r8[F] &= ~Flags.S;
            }
            ;
        }
        else {
            this.r8[F] |= Flags.Z;
            this.r8[F] |= Flags.PV;
            this.r8[F] &= ~Flags.S;
        }
        ;
        this.r8[F] &= ~Flags.N;
        this.r8[F] |= Flags.H;
    }
    set(n, value) {
        // Create a mask where the bit is set and do a bitwise or
        // to set the bit
        let mask = 1 << n;
        return value | mask;
    }
    res(n, value) {
        // Create a mask where the bit is 0 and other bits 1
        let mask = ~(1 << n);
        return value & mask;
    }
    // Method for handing the INI, IND, INIR, INDR, OUTI, OUTD, OTIR and OTDR
    ini_inid_outi_outd(inOperation, inc) {
        if (inOperation) {
            // IN (read from port)
            this.memory.uwrite8(this.r16[HL], this.IO.read8(this.r8[C]));
        }
        else {
            // OUT (write to port)
            this.IO.write8(this.r8[C], this.memory.uread8(this.r16[HL]));
        }
        if (inc) {
            this.r16[HL]++;
        }
        else {
            this.r16[HL]--;
        }
        this.r8[B] = this.dec8(this.r8[B]);
        // Reset N flag if incrementing else set flag. (Documentation is inconsistent about this) )
        if (inc) {
            this.r8[F] &= ~Flags.N;
        }
        else {
            this.r8[F] |= Flags.N;
        }
    }
    ldi_ldd(inc) {
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
        // Reset Half Carry
        this.r8[F] &= ~Flags.H;
        // P/V is reset in case of overflow (if BC=0 after calling LDI).        
        if (this.r16[BC] === 0) {
            this.r8[F] &= ~Flags.PV;
        }
        else {
            this.r8[F] |= Flags.PV;
        }
        // Reset N flag if incrementing else set flag. (Documentation is inconsistent about this) )
        if (true) {
            this.r8[F] &= ~Flags.N;
        }
        else {
            this.r8[F] |= Flags.N;
        }
    }
    cpi_cpd(inc) {
        let val = this.memory.uread8(this.r16[HL]);
        // The carry is preserved, N is set and all the other flags are affected as defined. 
        // P/V denotes the overflowing of BC, while the Z flag is set if A=(HL) before HL is decreased.
        // Set zero flag in case A = (HL)
        if (this.r8[A] == val) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        ;
        if (inc) {
            this.r16[HL]++;
            this.r16[DE]++;
        }
        else {
            this.r16[HL]--;
            this.r16[DE]--;
        }
        this.r16[BC]--;
        // P/V is reset in case of overflow (if BC=0 after calling LDI).        
        if (this.r16[BC] === 0) {
            this.r8[F] &= ~Flags.PV;
        }
        else {
            this.r8[F] |= Flags.PV;
        }
        // Reset N flag if incrementing else set flag. (Documentation is inconsistent about this) )
        if (inc) {
            this.r8[F] &= ~Flags.N;
        }
        else {
            this.r8[F] |= Flags.N;
        }
    }
    disableInterrupts() {
        // TODO: 
        // this.iff1 = false;
        // this.iff2 = false
        this.interruptEnabled = false;
    }
    enableInterrupts() {
        // TODO: 
        // this.iff1 = false;
        // this.iff2 = false
        this.interruptEnabled = true;
    }
    halt() {
        this.halted = true;
    }
    daa() {
        // When this instruction is executed, the A register is BCD corrected using the contents
        // of the flags. The exact process is the following: if the least significant four bits 
        // of A contain a non-BCD digit (i. e. it is greater than 9) or the H flag is set, then $06 
        // is added to the register. Then the four most significant bits are checked. If this more 
        // significant digit also happens to be greater than 9 or the C flag is set, then $60 is added.
        var val = this.r8[A];
        if (!(this.r8[F] & Flags.N)) {
            if ((this.r8[F] & Flags.H) || ((this.r8[A] & 0x0f) > 9)) {
                val += 0x06;
            }
            if ((this.r8[F] & Flags.N) || (this.r8[A] > 0x99)) {
                val += 0x60;
                this.r8[F] |= Flags.C;
            }
        }
        else {
            if (this.r8[F] & Flags.H || ((this.r8[A] & 0x0f) > 9)) {
                val -= 0x06;
            }
            if (this.r8[F] & Flags.C || (this.r8[A] > 0x99)) {
                val -= 0x60;
                this.r8[F] |= Flags.C;
            }
        }
        if ((this.r8[A] & 0x10) ^ (val & 0x10)) {
            this.r8[F] |= Flags.H;
        }
        else {
            this.r8[F] &= ~Flags.H;
        }
        this.r8[A] = val;
        if (this.evenParity[this.r8[A]]) {
            this.r8[F] |= Flags.PV;
        }
        else {
            this.r8[F] &= ~Flags.PV;
        }
        if (this.r8[A] === 0) {
            this.r8[F] |= Flags.Z;
        }
        else {
            this.r8[F] &= ~Flags.Z;
        }
        //if (this.r8[A] > 0x99) { this.r8[F] |= Flags.C; } else { this.r8[F] &= ~Flags.C; }
        // Set Sign / F3 / F5 are copies of the result
        this.r8[F] &= ~Flags.S_F5_F3; // Reset bits
        this.r8[F] |= (this.r8[A] & Flags.S_F5_F3); // Set bits if set in the result
    }
    interrupt() {
        if (this.interruptEnabled) {
            // Push the program counter
            //this.r16[PC] += 2;
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            // Execute the interrupt routine
            this.halted = false;
            let retadd = this.r16[PC];
            this.r16[PC] = 0x0038;
            this.log(0x0038, `INT ($${retadd})`);
        }
    }
    hex16(n) {
        return ("000" + n.toString(16)).slice(-4);
    }
    hex8(n) {
        return ("0" + n.toString(16)).slice(-2);
    }
    log(address, msg) {
        if (this.logging) {
            this.logger.debug(("000" + address.toString(16)).slice(-4) + " : " + msg, this.dumpRegisters());
        }
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
    executeSingleInstruction() {
        if (this.halted) {
            return;
        }
        if (!this.r16[PC]) {
            console.log("DEVICE (RE)STARTED");
        }
        if (this.systemCalls.length > 0) {
            let func = this.systemCalls[this.r16[PC]];
            if (func) {
                // Callback
                func(this);
                // Execute RET instruction
                this.opcodes[0xC9](this.r16[PC]);
            }
        }
        // R is incremented at the start of every instruction cycle,
        //  before the instruction actually runs.
        // The high bit of R is not affected by this increment,
        //  it can only be changed using the LD R, A instruction.
        this.r8[R] = (this.r8[R] & 0x80) | (((this.r8[R] & 0x7f) + 1) & 0x7f);
        let addr = this.r16[PC]++;
        let opcode = this.memory.uread8(addr);
        this.opcodes[opcode](addr);
    }
    execute(numOfInstructions, showLog) {
        this.logging = showLog;
        for (let i = 0; i < numOfInstructions; i++) {
            this.executeSingleInstruction();
        }
    }
    executeUntil(breakPoint) {
        this.logging = false;
        while (1) {
            let prev = this.r16[PC];
            this.executeSingleInstruction();
            if (this.r16[PC] == breakPoint) {
                console.log(`Breakpoint prev: ${prev.toString(16)}`);
                return;
            }
        }
    }
    addInstructionCB(opcode, func) {
        this.opcodesCB[opcode] = func;
    }
    addInstructionED(opcode, func) {
        this.opcodesED[opcode] = func;
    }
    addInstructionDD(opcode, func) {
        this.opcodesDD[opcode] = func;
    }
    addInstructionFD(opcode, func) {
        this.opcodesFD[opcode] = func;
    }
    addInstructionDDCB(opcode, func) {
        this.opcodesDDCB[opcode] = func;
    }
    addInstructionFDCB(opcode, func) {
        this.opcodesFDCB[opcode] = func;
    }
    addInstruction(opcode, func) {
        this.opcodes[opcode] = func;
    }
    addOpcodes() {
        /* GENERATED_CODE_INSERT_HERE */
    }
}
