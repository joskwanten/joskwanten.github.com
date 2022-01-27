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
        this.addInstruction(0x8E, (addr) => {
            // ADC A,(HL) Opcode: 8E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 7;
        });
        this.addInstructionDD(0x8E, (addr) => {
            // ADC A,(IX+o) Opcode: DD 8E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 19;
        });
        this.addInstructionFD(0x8E, (addr) => {
            // ADC A,(IY+o) Opcode: FD 8E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 19;
        });
        this.addInstruction(0xCE, (addr) => {
            // ADC A,n Opcode: CE n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 7;
        });
        this.addInstruction(0x88, (addr) => {
            // ADC A,r Opcode: 88+r
            let val = this.r8[B];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 4;
        });
        this.addInstruction(0x89, (addr) => {
            // ADC A,r Opcode: 88+r
            let val = this.r8[C];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 4;
        });
        this.addInstruction(0x8a, (addr) => {
            // ADC A,r Opcode: 88+r
            let val = this.r8[D];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 4;
        });
        this.addInstruction(0x8b, (addr) => {
            // ADC A,r Opcode: 88+r
            let val = this.r8[E];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 4;
        });
        this.addInstruction(0x8c, (addr) => {
            // ADC A,r Opcode: 88+r
            let val = this.r8[H];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 4;
        });
        this.addInstruction(0x8d, (addr) => {
            // ADC A,r Opcode: 88+r
            let val = this.r8[L];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 4;
        });
        this.addInstruction(0x8f, (addr) => {
            // ADC A,r Opcode: 88+r
            let val = this.r8[A];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 4;
        });
        this.addInstructionDD(0x8c, (addr) => {
            // ADC A,IXp Opcode: DD 88+p
            let val = this.r8[IXh];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 8;
        });
        this.addInstructionDD(0x8d, (addr) => {
            // ADC A,IXp Opcode: DD 88+p
            let val = this.r8[IXl];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 8;
        });
        this.addInstructionFD(0x8c, (addr) => {
            // ADC A,IYq Opcode: FD 88+q
            let val = this.r8[IYh];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 8;
        });
        this.addInstructionFD(0x8d, (addr) => {
            // ADC A,IYq Opcode: FD 88+q
            let val = this.r8[IYl];
            this.r8[A] = this.addSub8(this.r8[A], val, false, true);
            this.cycles += 8;
        });
        this.addInstructionED(0x4A, (addr) => {
            // ADC HL,BC Opcode: ED 4A
            let val = this.r16[BC];
            this.r16[HL] = this.addSub16(this.r16[HL], val, false, true);
            this.cycles += 15;
        });
        this.addInstructionED(0x5A, (addr) => {
            // ADC HL,DE Opcode: ED 5A
            let val = this.r16[DE];
            this.r16[HL] = this.addSub16(this.r16[HL], val, false, true);
            this.cycles += 15;
        });
        this.addInstructionED(0x6A, (addr) => {
            // ADC HL,HL Opcode: ED 6A
            let val = this.r16[HL];
            this.r16[HL] = this.addSub16(this.r16[HL], val, false, true);
            this.cycles += 15;
        });
        this.addInstructionED(0x7A, (addr) => {
            // ADC HL,SP Opcode: ED 7A
            let val = this.r16[SP];
            this.r16[HL] = this.addSub16(this.r16[HL], val, false, true);
            this.cycles += 15;
        });
        this.addInstruction(0x86, (addr) => {
            // ADD A,(HL) Opcode: 86
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 7;
        });
        this.addInstructionDD(0x86, (addr) => {
            // ADD A,(IX+o) Opcode: DD 86 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 19;
        });
        this.addInstructionFD(0x86, (addr) => {
            // ADD A,(IY+o) Opcode: FD 86 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 19;
        });
        this.addInstruction(0xC6, (addr) => {
            // ADD A,n Opcode: C6 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 7;
        });
        this.addInstruction(0x80, (addr) => {
            // ADD A,r Opcode: 80+r
            let val = this.r8[B];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 4;
        });
        this.addInstruction(0x81, (addr) => {
            // ADD A,r Opcode: 80+r
            let val = this.r8[C];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 4;
        });
        this.addInstruction(0x82, (addr) => {
            // ADD A,r Opcode: 80+r
            let val = this.r8[D];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 4;
        });
        this.addInstruction(0x83, (addr) => {
            // ADD A,r Opcode: 80+r
            let val = this.r8[E];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 4;
        });
        this.addInstruction(0x84, (addr) => {
            // ADD A,r Opcode: 80+r
            let val = this.r8[H];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 4;
        });
        this.addInstruction(0x85, (addr) => {
            // ADD A,r Opcode: 80+r
            let val = this.r8[L];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 4;
        });
        this.addInstruction(0x87, (addr) => {
            // ADD A,r Opcode: 80+r
            let val = this.r8[A];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 4;
        });
        this.addInstructionDD(0x84, (addr) => {
            // ADD A,IXp Opcode: DD 80+p
            let val = this.r8[IXh];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 8;
        });
        this.addInstructionDD(0x85, (addr) => {
            // ADD A,IXp Opcode: DD 80+p
            let val = this.r8[IXl];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 8;
        });
        this.addInstructionFD(0x84, (addr) => {
            // ADD A,IYq Opcode: FD 80+q
            let val = this.r8[IYh];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 8;
        });
        this.addInstructionFD(0x85, (addr) => {
            // ADD A,IYq Opcode: FD 80+q
            let val = this.r8[IYl];
            this.r8[A] = this.addSub8(this.r8[A], val, false, false);
            this.cycles += 8;
        });
        this.addInstruction(0x9, (addr) => {
            // ADD HL,BC Opcode: 9
            let val = this.r16[BC];
            this.r16[HL] = this.addSub16(this.r16[HL], val, false, false);
            this.cycles += 11;
        });
        this.addInstruction(0x19, (addr) => {
            // ADD HL,DE Opcode: 19
            let val = this.r16[DE];
            this.r16[HL] = this.addSub16(this.r16[HL], val, false, false);
            this.cycles += 11;
        });
        this.addInstruction(0x29, (addr) => {
            // ADD HL,HL Opcode: 29
            let val = this.r16[HL];
            this.r16[HL] = this.addSub16(this.r16[HL], val, false, false);
            this.cycles += 11;
        });
        this.addInstruction(0x39, (addr) => {
            // ADD HL,SP Opcode: 39
            let val = this.r16[SP];
            this.r16[HL] = this.addSub16(this.r16[HL], val, false, false);
            this.cycles += 11;
        });
        this.addInstructionDD(0x09, (addr) => {
            // ADD IX,BC Opcode: DD 09
            let val = this.r16[BC];
            this.r16[IX] = this.addSub16(this.r16[IX], val, false, false);
            this.cycles += 15;
        });
        this.addInstructionDD(0x19, (addr) => {
            // ADD IX,DE Opcode: DD 19
            let val = this.r16[DE];
            this.r16[IX] = this.addSub16(this.r16[IX], val, false, false);
            this.cycles += 15;
        });
        this.addInstructionDD(0x29, (addr) => {
            // ADD IX,IX Opcode: DD 29
            let val = this.r16[IX];
            this.r16[IX] = this.addSub16(this.r16[IX], val, false, false);
            this.cycles += 15;
        });
        this.addInstructionDD(0x39, (addr) => {
            // ADD IX,SP Opcode: DD 39
            let val = this.r16[SP];
            this.r16[IX] = this.addSub16(this.r16[IX], val, false, false);
            this.cycles += 15;
        });
        this.addInstructionFD(0x09, (addr) => {
            // ADD IY,BC Opcode: FD 09
            let val = this.r16[BC];
            this.r16[IY] = this.addSub16(this.r16[IY], val, false, false);
            this.cycles += 15;
        });
        this.addInstructionFD(0x19, (addr) => {
            // ADD IY,DE Opcode: FD 19
            let val = this.r16[DE];
            this.r16[IY] = this.addSub16(this.r16[IY], val, false, false);
            this.cycles += 15;
        });
        this.addInstructionFD(0x29, (addr) => {
            // ADD IY,IY Opcode: FD 29
            let val = this.r16[IY];
            this.r16[IY] = this.addSub16(this.r16[IY], val, false, false);
            this.cycles += 15;
        });
        this.addInstructionFD(0x39, (addr) => {
            // ADD IY,SP Opcode: FD 39
            let val = this.r16[SP];
            this.r16[IY] = this.addSub16(this.r16[IY], val, false, false);
            this.cycles += 15;
        });
        this.addInstruction(0xA6, (addr) => {
            // AND (HL) Opcode: A6
            let val = this.memory.uread8(this.r16[HL]);
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstructionDD(0xA6, (addr) => {
            // AND (IX+o) Opcode: DD A6 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstructionFD(0xA6, (addr) => {
            // AND (IY+o) Opcode: FD A6 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstruction(0xE6, (addr) => {
            // AND n Opcode: E6 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstruction(0xa0, (addr) => {
            // AND r Opcode: A0+r
            let val = this.r8[B];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstruction(0xa1, (addr) => {
            // AND r Opcode: A0+r
            let val = this.r8[C];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstruction(0xa2, (addr) => {
            // AND r Opcode: A0+r
            let val = this.r8[D];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstruction(0xa3, (addr) => {
            // AND r Opcode: A0+r
            let val = this.r8[E];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstruction(0xa4, (addr) => {
            // AND r Opcode: A0+r
            let val = this.r8[H];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstruction(0xa5, (addr) => {
            // AND r Opcode: A0+r
            let val = this.r8[L];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstruction(0xa7, (addr) => {
            // AND r Opcode: A0+r
            let val = this.r8[A];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstructionDD(0xa4, (addr) => {
            // AND IXp Opcode: DD A0+p
            let val = this.r8[IXh];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstructionDD(0xa5, (addr) => {
            // AND IXp Opcode: DD A0+p
            let val = this.r8[IXl];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstructionFD(0xa4, (addr) => {
            // AND IYq Opcode: FD A0+q
            let val = this.r8[IYh];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstructionFD(0xa5, (addr) => {
            // AND IYq Opcode: FD A0+q
            let val = this.r8[IYl];
            this.logicalOperation(val, LogicalOperation.AND);
        });
        this.addInstructionCB(0x46, (addr) => {
            // BIT b,(HL) Opcode: CB 46+8*b
            let val = this.memory.uread8(this.r16[HL]);
            this.bit(0, val);
            this.cycles += 12;
        });
        this.addInstructionCB(0x4E, (addr) => {
            // BIT b,(HL) Opcode: CB 46+8*b
            let val = this.memory.uread8(this.r16[HL]);
            this.bit(1, val);
            this.cycles += 12;
        });
        this.addInstructionCB(0x56, (addr) => {
            // BIT b,(HL) Opcode: CB 46+8*b
            let val = this.memory.uread8(this.r16[HL]);
            this.bit(2, val);
            this.cycles += 12;
        });
        this.addInstructionCB(0x5E, (addr) => {
            // BIT b,(HL) Opcode: CB 46+8*b
            let val = this.memory.uread8(this.r16[HL]);
            this.bit(3, val);
            this.cycles += 12;
        });
        this.addInstructionCB(0x66, (addr) => {
            // BIT b,(HL) Opcode: CB 46+8*b
            let val = this.memory.uread8(this.r16[HL]);
            this.bit(4, val);
            this.cycles += 12;
        });
        this.addInstructionCB(0x6E, (addr) => {
            // BIT b,(HL) Opcode: CB 46+8*b
            let val = this.memory.uread8(this.r16[HL]);
            this.bit(5, val);
            this.cycles += 12;
        });
        this.addInstructionCB(0x76, (addr) => {
            // BIT b,(HL) Opcode: CB 46+8*b
            let val = this.memory.uread8(this.r16[HL]);
            this.bit(6, val);
            this.cycles += 12;
        });
        this.addInstructionCB(0x7E, (addr) => {
            // BIT b,(HL) Opcode: CB 46+8*b
            let val = this.memory.uread8(this.r16[HL]);
            this.bit(7, val);
            this.cycles += 12;
        });
        this.addInstructionDDCB(0x46, (addr, o) => {
            // BIT b,(IX+o) Opcode: DD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            this.bit(0, val);
            this.cycles += 20;
        });
        this.addInstructionDDCB(0x4E, (addr, o) => {
            // BIT b,(IX+o) Opcode: DD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            this.bit(1, val);
            this.cycles += 20;
        });
        this.addInstructionDDCB(0x56, (addr, o) => {
            // BIT b,(IX+o) Opcode: DD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            this.bit(2, val);
            this.cycles += 20;
        });
        this.addInstructionDDCB(0x5E, (addr, o) => {
            // BIT b,(IX+o) Opcode: DD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            this.bit(3, val);
            this.cycles += 20;
        });
        this.addInstructionDDCB(0x66, (addr, o) => {
            // BIT b,(IX+o) Opcode: DD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            this.bit(4, val);
            this.cycles += 20;
        });
        this.addInstructionDDCB(0x6E, (addr, o) => {
            // BIT b,(IX+o) Opcode: DD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            this.bit(5, val);
            this.cycles += 20;
        });
        this.addInstructionDDCB(0x76, (addr, o) => {
            // BIT b,(IX+o) Opcode: DD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            this.bit(6, val);
            this.cycles += 20;
        });
        this.addInstructionDDCB(0x7E, (addr, o) => {
            // BIT b,(IX+o) Opcode: DD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            this.bit(7, val);
            this.cycles += 20;
        });
        this.addInstructionFDCB(0x46, (addr, o) => {
            // BIT b,(IY+o) Opcode: FD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            this.bit(0, val);
            this.cycles += 20;
        });
        this.addInstructionFDCB(0x4E, (addr, o) => {
            // BIT b,(IY+o) Opcode: FD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            this.bit(1, val);
            this.cycles += 20;
        });
        this.addInstructionFDCB(0x56, (addr, o) => {
            // BIT b,(IY+o) Opcode: FD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            this.bit(2, val);
            this.cycles += 20;
        });
        this.addInstructionFDCB(0x5E, (addr, o) => {
            // BIT b,(IY+o) Opcode: FD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            this.bit(3, val);
            this.cycles += 20;
        });
        this.addInstructionFDCB(0x66, (addr, o) => {
            // BIT b,(IY+o) Opcode: FD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            this.bit(4, val);
            this.cycles += 20;
        });
        this.addInstructionFDCB(0x6E, (addr, o) => {
            // BIT b,(IY+o) Opcode: FD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            this.bit(5, val);
            this.cycles += 20;
        });
        this.addInstructionFDCB(0x76, (addr, o) => {
            // BIT b,(IY+o) Opcode: FD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            this.bit(6, val);
            this.cycles += 20;
        });
        this.addInstructionFDCB(0x7E, (addr, o) => {
            // BIT b,(IY+o) Opcode: FD CB o 46+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            this.bit(7, val);
            this.cycles += 20;
        });
        this.addInstructionCB(0x40, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[B];
            this.bit(0, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x41, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[C];
            this.bit(0, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x42, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[D];
            this.bit(0, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x43, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[E];
            this.bit(0, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x44, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[H];
            this.bit(0, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x45, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[L];
            this.bit(0, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x47, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[A];
            this.bit(0, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x48, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[B];
            this.bit(1, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x49, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[C];
            this.bit(1, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x4A, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[D];
            this.bit(1, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x4B, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[E];
            this.bit(1, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x4C, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[H];
            this.bit(1, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x4D, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[L];
            this.bit(1, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x4F, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[A];
            this.bit(1, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x50, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[B];
            this.bit(2, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x51, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[C];
            this.bit(2, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x52, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[D];
            this.bit(2, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x53, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[E];
            this.bit(2, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x54, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[H];
            this.bit(2, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x55, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[L];
            this.bit(2, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x57, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[A];
            this.bit(2, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x58, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[B];
            this.bit(3, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x59, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[C];
            this.bit(3, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x5A, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[D];
            this.bit(3, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x5B, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[E];
            this.bit(3, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x5C, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[H];
            this.bit(3, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x5D, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[L];
            this.bit(3, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x5F, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[A];
            this.bit(3, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x60, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[B];
            this.bit(4, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x61, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[C];
            this.bit(4, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x62, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[D];
            this.bit(4, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x63, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[E];
            this.bit(4, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x64, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[H];
            this.bit(4, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x65, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[L];
            this.bit(4, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x67, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[A];
            this.bit(4, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x68, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[B];
            this.bit(5, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x69, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[C];
            this.bit(5, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x6A, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[D];
            this.bit(5, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x6B, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[E];
            this.bit(5, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x6C, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[H];
            this.bit(5, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x6D, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[L];
            this.bit(5, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x6F, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[A];
            this.bit(5, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x70, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[B];
            this.bit(6, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x71, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[C];
            this.bit(6, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x72, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[D];
            this.bit(6, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x73, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[E];
            this.bit(6, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x74, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[H];
            this.bit(6, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x75, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[L];
            this.bit(6, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x77, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[A];
            this.bit(6, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x78, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[B];
            this.bit(7, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x79, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[C];
            this.bit(7, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x7A, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[D];
            this.bit(7, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x7B, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[E];
            this.bit(7, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x7C, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[H];
            this.bit(7, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x7D, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[L];
            this.bit(7, val);
            this.cycles += 8;
        });
        this.addInstructionCB(0x7F, (addr) => {
            // BIT b,r Opcode: CB 40+8*b+r
            let val = this.r8[A];
            this.bit(7, val);
            this.cycles += 8;
        });
        this.addInstruction(0xCD, (addr) => {
            // CALL nn Opcode: CD nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            this.r16[PC] = nn;
            this.cycles += 17;
        });
        this.addInstruction(0xDC, (addr) => {
            // CALL C,nn Opcode: DC nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if ((this.r8[F] & Flags.C)) {
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = nn;
                this.cycles += 17;
            }
            else {
                this.cycles += 10;
            }
        });
        this.addInstruction(0xFC, (addr) => {
            // CALL M,nn Opcode: FC nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if ((this.r8[F] & Flags.S)) {
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = nn;
                this.cycles += 17;
            }
            else {
                this.cycles += 10;
            }
        });
        this.addInstruction(0xD4, (addr) => {
            // CALL NC,nn Opcode: D4 nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if (!(this.r8[F] & Flags.C)) {
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = nn;
                this.cycles += 17;
            }
            else {
                this.cycles += 10;
            }
        });
        this.addInstruction(0xC4, (addr) => {
            // CALL NZ,nn Opcode: C4 nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if (!(this.r8[F] & Flags.Z)) {
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = nn;
                this.cycles += 17;
            }
            else {
                this.cycles += 10;
            }
        });
        this.addInstruction(0xF4, (addr) => {
            // CALL P,nn Opcode: F4 nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if (!(this.r8[F] & Flags.S)) {
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = nn;
                this.cycles += 17;
            }
            else {
                this.cycles += 10;
            }
        });
        this.addInstruction(0xEC, (addr) => {
            // CALL PE,nn Opcode: EC nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if ((this.r8[F] & Flags.PV)) {
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = nn;
                this.cycles += 17;
            }
            else {
                this.cycles += 10;
            }
        });
        this.addInstruction(0xE4, (addr) => {
            // CALL PO,nn Opcode: E4 nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if (!(this.r8[F] & Flags.PV)) {
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = nn;
                this.cycles += 17;
            }
            else {
                this.cycles += 10;
            }
        });
        this.addInstruction(0xCC, (addr) => {
            // CALL Z,nn Opcode: CC nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if ((this.r8[F] & Flags.Z)) {
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = nn;
                this.cycles += 17;
            }
            else {
                this.cycles += 10;
            }
        });
        this.addInstruction(0x3F, (addr) => {
            // CCF Opcode: 3F
            // Carry flag inverted. Also inverts H and clears N. Rest of the flags are preserved.
            if (this.r8[F] & Flags.C) {
                this.r8[F] &= ~Flags.C;
            }
            else {
                this.r8[F] |= Flags.C;
            }
            ;
            if (this.r8[F] & Flags.H) {
                this.r8[F] &= ~Flags.H;
            }
            else {
                this.r8[F] |= Flags.H;
            }
            ;
            this.r8[F] &= ~Flags.N;
            this.cycles += 4;
        });
        this.addInstruction(0xBE, (addr) => {
            // CP (HL) Opcode: BE
            let val = this.memory.uread8(this.r16[HL]);
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 7;
        });
        this.addInstructionDD(0xBE, (addr) => {
            // CP (IX+o) Opcode: DD BE o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 19;
        });
        this.addInstructionFD(0xBE, (addr) => {
            // CP (IY+o) Opcode: FD BE o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 19;
        });
        this.addInstruction(0xFE, (addr) => {
            // CP n Opcode: FE n
            let val = this.memory.uread8(this.r16[PC]++);
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 7;
        });
        this.addInstruction(0xb8, (addr) => {
            // CP r Opcode: B8+r
            let val = this.r8[B];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0xb9, (addr) => {
            // CP r Opcode: B8+r
            let val = this.r8[C];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0xba, (addr) => {
            // CP r Opcode: B8+r
            let val = this.r8[D];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0xbb, (addr) => {
            // CP r Opcode: B8+r
            let val = this.r8[E];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0xbc, (addr) => {
            // CP r Opcode: B8+r
            let val = this.r8[H];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0xbd, (addr) => {
            // CP r Opcode: B8+r
            let val = this.r8[L];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0xbf, (addr) => {
            // CP r Opcode: B8+r
            let val = this.r8[A];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstructionDD(0xbc, (addr) => {
            // CP IXp Opcode: DD B8+p
            let val = this.r8[IXh];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 8;
        });
        this.addInstructionDD(0xbd, (addr) => {
            // CP IXp Opcode: DD B8+p
            let val = this.r8[IXl];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 8;
        });
        this.addInstructionFD(0xbc, (addr) => {
            // CP IYq Opcode: FD B8+q
            let val = this.r8[IYh];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 8;
        });
        this.addInstructionFD(0xbd, (addr) => {
            // CP IYq Opcode: FD B8+q
            let val = this.r8[IYl];
            this.addSub8(this.r8[A], val, true, false);
            this.cycles += 8;
        });
        this.addInstructionED(0xA9, (addr) => {
            // CPD Opcode: ED A9
            this.cpi_cpd(false);
            this.cycles += 16;
        });
        this.addInstructionED(0xB9, (addr) => {
            // CPDR Opcode: ED B9
            if (this.r16[BC] > 0) {
                while (this.r16[BC] > 0) {
                    this.cpi_cpd(false);
                    this.cycles += 21;
                }
            }
            else {
                this.cycles += 16;
            }
        });
        this.addInstructionED(0xA1, (addr) => {
            // CPI Opcode: ED A1
            this.cpi_cpd(true);
            this.cycles += 16;
        });
        this.addInstructionED(0xB1, (addr) => {
            // CPIR Opcode: ED B1
            if (this.r16[BC] > 0) {
                while (this.r16[BC] > 0) {
                    this.cpi_cpd(true);
                    this.cycles += 21;
                }
            }
            else {
                this.cycles += 16;
            }
        });
        this.addInstruction(0x2F, (addr) => {
            // CPL Opcode: 2F
            this.r8[A] = ~this.r8[A];
            this.r8[F] |= (Flags.H | Flags.N);
            this.cycles += 4;
        });
        this.addInstruction(0x27, (addr) => {
            // DAA Opcode: 27
            this.daa();
            this.cycles += 4;
        });
        this.addInstruction(0x35, (addr) => {
            // DEC (HL) Opcode: 35
            let val = this.memory.uread8(this.r16[HL]);
            val = this.dec8(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 11;
        });
        this.addInstructionDD(0x35, (addr) => {
            // DEC (IX+o) Opcode: DD 35 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.dec8(val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFD(0x35, (addr) => {
            // DEC (IY+o) Opcode: FD 35 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.dec8(val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstruction(0x3D, (addr) => {
            // DEC A Opcode: 3D
            this.r8[A] = this.dec8(this.r8[A]);
            this.cycles += 4;
        });
        this.addInstruction(0x5, (addr) => {
            // DEC B Opcode: 5
            this.r8[B] = this.dec8(this.r8[B]);
            this.cycles += 4;
        });
        this.addInstruction(0x0B, (addr) => {
            // DEC BC Opcode: 0B
            let val = this.r16[BC];
            val--;
            this.r16[BC] = val;
            this.cycles += 6;
        });
        this.addInstruction(0x0D, (addr) => {
            // DEC C Opcode: 0D
            this.r8[C] = this.dec8(this.r8[C]);
            this.cycles += 4;
        });
        this.addInstruction(0x15, (addr) => {
            // DEC D Opcode: 15
            this.r8[D] = this.dec8(this.r8[D]);
            this.cycles += 4;
        });
        this.addInstruction(0x1B, (addr) => {
            // DEC DE Opcode: 1B
            let val = this.r16[DE];
            val--;
            this.r16[DE] = val;
            this.cycles += 6;
        });
        this.addInstruction(0x1D, (addr) => {
            // DEC E Opcode: 1D
            this.r8[E] = this.dec8(this.r8[E]);
            this.cycles += 4;
        });
        this.addInstruction(0x25, (addr) => {
            // DEC H Opcode: 25
            this.r8[H] = this.dec8(this.r8[H]);
            this.cycles += 4;
        });
        this.addInstruction(0x2B, (addr) => {
            // DEC HL Opcode: 2B
            let val = this.r16[HL];
            val--;
            this.r16[HL] = val;
            this.cycles += 6;
        });
        this.addInstructionDD(0x2B, (addr) => {
            // DEC IX Opcode: DD 2B
            let val = this.r16[IX];
            val--;
            this.r16[IX] = val;
            this.cycles += 10;
        });
        this.addInstructionFD(0x2B, (addr) => {
            // DEC IY Opcode: FD 2B
            let val = this.r16[IY];
            val--;
            this.r16[IY] = val;
            this.cycles += 10;
        });
        this.addInstructionDD(0x20, (addr) => {
            // DEC IXp Opcode: DD 05+8*p
            this.r8[IXh] = this.dec8(this.r8[IXh]);
            this.cycles += 8;
        });
        this.addInstructionDD(0x28, (addr) => {
            // DEC IXp Opcode: DD 05+8*p
            this.r8[IXl] = this.dec8(this.r8[IXl]);
            this.cycles += 8;
        });
        this.addInstructionFD(0x20, (addr) => {
            // DEC IYq Opcode: FD 05+8*q
            this.r8[IYh] = this.dec8(this.r8[IYh]);
            this.cycles += 8;
        });
        this.addInstructionFD(0x28, (addr) => {
            // DEC IYq Opcode: FD 05+8*q
            this.r8[IYl] = this.dec8(this.r8[IYl]);
            this.cycles += 8;
        });
        this.addInstruction(0x2D, (addr) => {
            // DEC L Opcode: 2D
            this.r8[L] = this.dec8(this.r8[L]);
            this.cycles += 4;
        });
        this.addInstruction(0x3B, (addr) => {
            // DEC SP Opcode: 3B
            let val = this.r16[SP];
            val--;
            this.r16[SP] = val;
            this.cycles += 6;
        });
        this.addInstruction(0xF3, (addr) => {
            // DI Opcode: F3
            this.disableInterrupts();
            this.cycles += 4;
        });
        this.addInstruction(0x10, (addr) => {
            // DJNZ o Opcode: 10 o
            let d = this.memory.read8(this.r16[PC]++);
            this.r8[B]--;
            this.r16[PC] += this.r8[B] !== 0 ? d : 0;
            this.cycles += this.r8[B] !== 0 ? 13 : 8;
        });
        this.addInstruction(0xFB, (addr) => {
            // EI Opcode: FB
            this.enableInterrupts();
            this.cycles += 4;
        });
        this.addInstruction(0xE3, (addr) => {
            // EX (SP),HL Opcode: E3
            let val = this.r16[HL];
            let val2 = this.memory.uread16(this.r16[SP]);
            this.memory.uwrite16(this.r16[SP], val);
            this.r16[HL] = val2;
            this.cycles += 19;
        });
        this.addInstructionDD(0xE3, (addr) => {
            // EX (SP),IX Opcode: DD E3
            let val = this.r16[IX];
            let val2 = this.memory.uread16(this.r16[SP]);
            this.memory.uwrite16(this.r16[SP], val);
            this.r16[IX] = val2;
            this.cycles += 23;
        });
        this.addInstructionFD(0xE3, (addr) => {
            // EX (SP),IY Opcode: FD E3
            let val = this.r16[IY];
            let val2 = this.memory.uread16(this.r16[SP]);
            this.memory.uwrite16(this.r16[SP], val);
            this.r16[IY] = val2;
            this.cycles += 23;
        });
        this.addInstruction(0x8, (addr) => {
            // EX AF,AF' Opcode: 8
            let val = this.r16s[AF];
            let val2 = this.r16[AF];
            this.r16[AF] = val;
            this.r16s[AF] = val2;
            this.cycles += 4;
        });
        this.addInstruction(0xEB, (addr) => {
            // EX DE,HL Opcode: EB
            let val = this.r16[HL];
            let val2 = this.r16[DE];
            this.r16[DE] = val;
            this.r16[HL] = val2;
            this.cycles += 4;
        });
        this.addInstruction(0xD9, (addr) => {
            // EXX Opcode: D9
            let bc = this.r16[BC];
            let de = this.r16[DE];
            let hl = this.r16[HL];
            this.r16[BC] = this.r16s[BC];
            this.r16[DE] = this.r16s[DE];
            this.r16[HL] = this.r16s[HL];
            this.r16s[BC] = bc;
            this.r16s[DE] = de;
            this.r16s[HL] = hl;
            this.cycles += 4;
        });
        this.addInstruction(0x76, (addr) => {
            // HALT Opcode: 76
            this.halt();
            this.cycles += 4;
        });
        this.addInstructionED(0x46, (addr) => {
            // IM 0 Opcode: ED 46
            this.interruptMode(0);
            this.cycles += 8;
        });
        this.addInstructionED(0x56, (addr) => {
            // IM 1 Opcode: ED 56
            this.interruptMode(1);
            this.cycles += 8;
        });
        this.addInstructionED(0x5E, (addr) => {
            // IM 2 Opcode: ED 5E
            this.interruptMode(2);
            this.cycles += 8;
        });
        this.addInstructionED(0x78, (addr) => {
            // IN A,(C) Opcode: ED 78
            let val = this.IO.read8(this.r8[C]);
            this.r8[A] = val;
            this.cycles += 12;
        });
        this.addInstruction(0xDB, (addr) => {
            // IN A,(n) Opcode: DB n
            let n = this.memory.uread8(this.r16[PC]++);
            let val = this.IO.read8(n);
            this.r8[A] = val;
            this.cycles += 11;
        });
        this.addInstructionED(0x40, (addr) => {
            // IN B,(C) Opcode: ED 40
            let val = this.IO.read8(this.r8[C]);
            this.r8[B] = val;
            this.cycles += 12;
        });
        this.addInstructionED(0x48, (addr) => {
            // IN C,(C) Opcode: ED 48
            let val = this.IO.read8(this.r8[C]);
            this.r8[C] = val;
            this.cycles += 12;
        });
        this.addInstructionED(0x50, (addr) => {
            // IN D,(C) Opcode: ED 50
            let val = this.IO.read8(this.r8[C]);
            this.r8[D] = val;
            this.cycles += 12;
        });
        this.addInstructionED(0x58, (addr) => {
            // IN E,(C) Opcode: ED 58
            let val = this.IO.read8(this.r8[C]);
            this.r8[E] = val;
            this.cycles += 12;
        });
        this.addInstructionED(0x60, (addr) => {
            // IN H,(C) Opcode: ED 60
            let val = this.IO.read8(this.r8[C]);
            this.r8[H] = val;
            this.cycles += 12;
        });
        this.addInstructionED(0x68, (addr) => {
            // IN L,(C) Opcode: ED 68
            let val = this.IO.read8(this.r8[C]);
            this.r8[L] = val;
            this.cycles += 12;
        });
        this.addInstructionED(0x70, (addr) => {
            // IN F,(C) Opcode: ED 70
            let val = this.IO.read8(this.r8[C]);
            this.r8[F] = val;
            this.cycles += 12;
        });
        this.addInstruction(0x34, (addr) => {
            // INC (HL) Opcode: 34
            let val = this.memory.uread8(this.r16[HL]);
            val = this.inc8(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 11;
        });
        this.addInstructionDD(0x34, (addr) => {
            // INC (IX+o) Opcode: DD 34 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.inc8(val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFD(0x34, (addr) => {
            // INC (IY+o) Opcode: FD 34 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.inc8(val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstruction(0x3C, (addr) => {
            // INC A Opcode: 3C
            this.r8[A] = this.inc8(this.r8[A]);
            this.cycles += 4;
        });
        this.addInstruction(0x4, (addr) => {
            // INC B Opcode: 4
            this.r8[B] = this.inc8(this.r8[B]);
            this.cycles += 4;
        });
        this.addInstruction(0x3, (addr) => {
            // INC BC Opcode: 3
            let val = this.r16[BC];
            val++;
            this.r16[BC] = val;
            this.cycles += 6;
        });
        this.addInstruction(0x0C, (addr) => {
            // INC C Opcode: 0C
            this.r8[C] = this.inc8(this.r8[C]);
            this.cycles += 4;
        });
        this.addInstruction(0x14, (addr) => {
            // INC D Opcode: 14
            this.r8[D] = this.inc8(this.r8[D]);
            this.cycles += 4;
        });
        this.addInstruction(0x13, (addr) => {
            // INC DE Opcode: 13
            let val = this.r16[DE];
            val++;
            this.r16[DE] = val;
            this.cycles += 6;
        });
        this.addInstruction(0x1C, (addr) => {
            // INC E Opcode: 1C
            this.r8[E] = this.inc8(this.r8[E]);
            this.cycles += 4;
        });
        this.addInstruction(0x24, (addr) => {
            // INC H Opcode: 24
            this.r8[H] = this.inc8(this.r8[H]);
            this.cycles += 4;
        });
        this.addInstruction(0x23, (addr) => {
            // INC HL Opcode: 23
            let val = this.r16[HL];
            val++;
            this.r16[HL] = val;
            this.cycles += 6;
        });
        this.addInstructionDD(0x23, (addr) => {
            // INC IX Opcode: DD 23
            let val = this.r16[IX];
            val++;
            this.r16[IX] = val;
            this.cycles += 10;
        });
        this.addInstructionFD(0x23, (addr) => {
            // INC IY Opcode: FD 23
            let val = this.r16[IY];
            val++;
            this.r16[IY] = val;
            this.cycles += 10;
        });
        this.addInstructionDD(0x20, (addr) => {
            // INC IXp Opcode: DD 04+8*p
            this.r8[IXh] = this.inc8(this.r8[IXh]);
            this.cycles += 8;
        });
        this.addInstructionDD(0x28, (addr) => {
            // INC IXp Opcode: DD 04+8*p
            this.r8[IXl] = this.inc8(this.r8[IXl]);
            this.cycles += 8;
        });
        this.addInstructionFD(0x20, (addr) => {
            // INC IYq Opcode: FD 04+8*q
            this.r8[IYh] = this.inc8(this.r8[IYh]);
            this.cycles += 8;
        });
        this.addInstructionFD(0x28, (addr) => {
            // INC IYq Opcode: FD 04+8*q
            this.r8[IYl] = this.inc8(this.r8[IYl]);
            this.cycles += 8;
        });
        this.addInstruction(0x2C, (addr) => {
            // INC L Opcode: 2C
            this.r8[L] = this.inc8(this.r8[L]);
            this.cycles += 4;
        });
        this.addInstruction(0x33, (addr) => {
            // INC SP Opcode: 33
            let val = this.r16[SP];
            val++;
            this.r16[SP] = val;
            this.cycles += 6;
        });
        this.addInstructionED(0xAA, (addr) => {
            // IND Opcode: ED AA
            this.ini_inid_outi_outd(true, false);
            this.cycles += 16;
        });
        this.addInstructionED(0xBA, (addr) => {
            // INDR Opcode: ED BA
            if (this.r8[B] > 0) {
                while (this.r8[B] > 0) {
                    this.ini_inid_outi_outd(true, false);
                    this.cycles += 21;
                }
            }
            else {
                this.cycles += 16;
            }
        });
        this.addInstructionED(0xA2, (addr) => {
            // INI Opcode: ED A2
            this.ini_inid_outi_outd(true, true);
            this.cycles += 16;
        });
        this.addInstructionED(0xB2, (addr) => {
            // INIR Opcode: ED B2
            if (this.r8[B] > 0) {
                while (this.r8[B] > 0) {
                    this.ini_inid_outi_outd(true, true);
                    this.cycles += 21;
                }
            }
            else {
                this.cycles += 16;
            }
        });
        this.addInstruction(0xC3, (addr) => {
            // JP nn Opcode: C3 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.r16[PC] = val;
            this.cycles += 10;
        });
        this.addInstruction(0xE9, (addr) => {
            // JP (HL) Opcode: E9
            this.r16[PC] = this.r16[HL];
            this.cycles += 4;
        });
        this.addInstructionDD(0xE9, (addr) => {
            // JP (IX) Opcode: DD E9
            this.r16[PC] = this.r16[IX];
            this.cycles += 8;
        });
        this.addInstructionFD(0xE9, (addr) => {
            // JP (IY) Opcode: FD E9
            this.r16[PC] = this.r16[IY];
            this.cycles += 8;
        });
        this.addInstruction(0xDA, (addr) => {
            // JP C,nn Opcode: DA nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if ((this.r8[F] & Flags.C)) {
                this.r16[PC] = val;
            }
            this.cycles += 10;
        });
        this.addInstruction(0xFA, (addr) => {
            // JP M,nn Opcode: FA nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if ((this.r8[F] & Flags.S)) {
                this.r16[PC] = val;
            }
            this.cycles += 10;
        });
        this.addInstruction(0xD2, (addr) => {
            // JP NC,nn Opcode: D2 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if (!(this.r8[F] & Flags.C)) {
                this.r16[PC] = val;
            }
            this.cycles += 10;
        });
        this.addInstruction(0xC2, (addr) => {
            // JP NZ,nn Opcode: C2 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if (!(this.r8[F] & Flags.Z)) {
                this.r16[PC] = val;
            }
            this.cycles += 10;
        });
        this.addInstruction(0xF2, (addr) => {
            // JP P,nn Opcode: F2 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if (!(this.r8[F] & Flags.S)) {
                this.r16[PC] = val;
            }
            this.cycles += 10;
        });
        this.addInstruction(0xEA, (addr) => {
            // JP PE,nn Opcode: EA nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if ((this.r8[F] & Flags.PV)) {
                this.r16[PC] = val;
            }
            this.cycles += 10;
        });
        this.addInstruction(0xE2, (addr) => {
            // JP PO,nn Opcode: E2 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if (!(this.r8[F] & Flags.PV)) {
                this.r16[PC] = val;
            }
            this.cycles += 10;
        });
        this.addInstruction(0xCA, (addr) => {
            // JP Z,nn Opcode: CA nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            if ((this.r8[F] & Flags.Z)) {
                this.r16[PC] = val;
            }
            this.cycles += 10;
        });
        this.addInstruction(0x18, (addr) => {
            // JR o Opcode: 18 o
            let o = this.memory.read8(this.r16[PC]++);
            this.r16[PC] += o;
            this.cycles += 12;
        });
        this.addInstruction(0x38, (addr) => {
            // JR C,o Opcode: 38 o
            let o = this.memory.read8(this.r16[PC]++);
            if ((this.r8[F] & Flags.C)) {
                this.r16[PC] += o;
                this.cycles += 12;
            }
            else {
                this.cycles += 7;
            }
        });
        this.addInstruction(0x30, (addr) => {
            // JR NC,o Opcode: 30 o
            let o = this.memory.read8(this.r16[PC]++);
            if (!(this.r8[F] & Flags.C)) {
                this.r16[PC] += o;
                this.cycles += 12;
            }
            else {
                this.cycles += 7;
            }
        });
        this.addInstruction(0x20, (addr) => {
            // JR NZ,o Opcode: 20 o
            let o = this.memory.read8(this.r16[PC]++);
            if (!(this.r8[F] & Flags.Z)) {
                this.r16[PC] += o;
                this.cycles += 12;
            }
            else {
                this.cycles += 7;
            }
        });
        this.addInstruction(0x28, (addr) => {
            // JR Z,o Opcode: 28 o
            let o = this.memory.read8(this.r16[PC]++);
            if ((this.r8[F] & Flags.Z)) {
                this.r16[PC] += o;
                this.cycles += 12;
            }
            else {
                this.cycles += 7;
            }
        });
        this.addInstruction(0x2, (addr) => {
            // LD (BC),A Opcode: 2
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[BC], val);
            this.cycles += 7;
        });
        this.addInstruction(0x12, (addr) => {
            // LD (DE),A Opcode: 12
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[DE], val);
            this.cycles += 7;
        });
        this.addInstruction(0x36, (addr) => {
            // LD (HL),n Opcode: 36 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 10;
        });
        this.addInstruction(0x70, (addr) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[B];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
        });
        this.addInstruction(0x71, (addr) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[C];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
        });
        this.addInstruction(0x72, (addr) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[D];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
        });
        this.addInstruction(0x73, (addr) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[E];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
        });
        this.addInstruction(0x74, (addr) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[H];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
        });
        this.addInstruction(0x75, (addr) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[L];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
        });
        this.addInstruction(0x77, (addr) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
        });
        this.addInstructionDD(0x36, (addr) => {
            // LD (IX+o),n Opcode: DD 36 o n
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[PC]++);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
        });
        this.addInstructionDD(0x70, (addr) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[B];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
        });
        this.addInstructionDD(0x71, (addr) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[C];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
        });
        this.addInstructionDD(0x72, (addr) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[D];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
        });
        this.addInstructionDD(0x73, (addr) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[E];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
        });
        this.addInstructionDD(0x74, (addr) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[H];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
        });
        this.addInstructionDD(0x75, (addr) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[L];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
        });
        this.addInstructionDD(0x77, (addr) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
        });
        this.addInstructionFD(0x36, (addr) => {
            // LD (IY+o),n Opcode: FD 36 o n
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[PC]++);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
        });
        this.addInstructionFD(0x70, (addr) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[B];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
        });
        this.addInstructionFD(0x71, (addr) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[C];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
        });
        this.addInstructionFD(0x72, (addr) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[D];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
        });
        this.addInstructionFD(0x73, (addr) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[E];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
        });
        this.addInstructionFD(0x74, (addr) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[H];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
        });
        this.addInstructionFD(0x75, (addr) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[L];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
        });
        this.addInstructionFD(0x77, (addr) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
        });
        this.addInstruction(0x32, (addr) => {
            // LD (nn),A Opcode: 32 nn nn
            let val = this.r8[A];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite8(nn, val);
            this.cycles += 13;
        });
        this.addInstructionED(0x43, (addr) => {
            // LD (nn),BC Opcode: ED 43 nn nn
            let val = this.r16[BC];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
        });
        this.addInstructionED(0x53, (addr) => {
            // LD (nn),DE Opcode: ED 53 nn nn
            let val = this.r16[DE];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
        });
        this.addInstruction(0x22, (addr) => {
            // LD (nn),HL Opcode: 22 nn nn
            let val = this.r16[HL];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 16;
        });
        this.addInstructionDD(0x22, (addr) => {
            // LD (nn),IX Opcode: DD 22 nn nn
            let val = this.r16[IX];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
        });
        this.addInstructionFD(0x22, (addr) => {
            // LD (nn),IY Opcode: FD 22 nn nn
            let val = this.r16[IY];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
        });
        this.addInstructionED(0x73, (addr) => {
            // LD (nn),SP Opcode: ED 73 nn nn
            let val = this.r16[SP];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
        });
        this.addInstruction(0x0A, (addr) => {
            // LD A,(BC) Opcode: 0A
            let val = this.memory.uread8(this.r16[BC]);
            this.r8[A] = val;
            this.cycles += 7;
        });
        this.addInstruction(0x1A, (addr) => {
            // LD A,(DE) Opcode: 1A
            let val = this.memory.uread8(this.r16[DE]);
            this.r8[A] = val;
            this.cycles += 7;
        });
        this.addInstruction(0x7E, (addr) => {
            // LD A,(HL) Opcode: 7E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[A] = val;
            this.cycles += 7;
        });
        this.addInstructionDD(0x7E, (addr) => {
            // LD A,(IX+o) Opcode: DD 7E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[A] = val;
            this.cycles += 19;
        });
        this.addInstructionFD(0x7E, (addr) => {
            // LD A,(IY+o) Opcode: FD 7E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[A] = val;
            this.cycles += 19;
        });
        this.addInstruction(0x3A, (addr) => {
            // LD A,(nn) Opcode: 3A nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread8(nn);
            this.r8[A] = val;
            this.cycles += 13;
        });
        this.addInstruction(0x3E, (addr) => {
            // LD A,n Opcode: 3E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[A] = val;
            this.cycles += 7;
        });
        this.addInstruction(0x78, (addr) => {
            // LD A,r Opcode: 78+r
            this.r8[A] = this.r8[B];
            this.cycles += 4;
        });
        this.addInstruction(0x79, (addr) => {
            // LD A,r Opcode: 78+r
            this.r8[A] = this.r8[C];
            this.cycles += 4;
        });
        this.addInstruction(0x7a, (addr) => {
            // LD A,r Opcode: 78+r
            this.r8[A] = this.r8[D];
            this.cycles += 4;
        });
        this.addInstruction(0x7b, (addr) => {
            // LD A,r Opcode: 78+r
            this.r8[A] = this.r8[E];
            this.cycles += 4;
        });
        this.addInstruction(0x7c, (addr) => {
            // LD A,r Opcode: 78+r
            this.r8[A] = this.r8[H];
            this.cycles += 4;
        });
        this.addInstruction(0x7d, (addr) => {
            // LD A,r Opcode: 78+r
            this.r8[A] = this.r8[L];
            this.cycles += 4;
        });
        this.addInstruction(0x7f, (addr) => {
            // LD A,r Opcode: 78+r
            this.r8[A] = this.r8[A];
            this.cycles += 4;
        });
        this.addInstructionDD(0x7c, (addr) => {
            // LD A,IXp Opcode: DD 78+p
            this.r8[A] = this.r8[IXh];
            this.cycles += 8;
        });
        this.addInstructionDD(0x7d, (addr) => {
            // LD A,IXp Opcode: DD 78+p
            this.r8[A] = this.r8[IXl];
            this.cycles += 8;
        });
        this.addInstructionFD(0x7c, (addr) => {
            // LD A,IYq Opcode: FD 78+q
            this.r8[A] = this.r8[IYh];
            this.cycles += 8;
        });
        this.addInstructionFD(0x7d, (addr) => {
            // LD A,IYq Opcode: FD 78+q
            this.r8[A] = this.r8[IYl];
            this.cycles += 8;
        });
        this.addInstructionED(0x57, (addr) => {
            // LD A,I Opcode: ED 57
            this.r8[A] = this.r8[I];
            this.cycles += 9;
        });
        this.addInstructionED(0x5F, (addr) => {
            // LD A,R Opcode: ED 5F
            this.r8[A] = this.r8[R];
            this.cycles += 9;
        });
        this.addInstruction(0x46, (addr) => {
            // LD B,(HL) Opcode: 46
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[B] = val;
            this.cycles += 7;
        });
        this.addInstructionDD(0x46, (addr) => {
            // LD B,(IX+o) Opcode: DD 46 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[B] = val;
            this.cycles += 19;
        });
        this.addInstructionFD(0x46, (addr) => {
            // LD B,(IY+o) Opcode: FD 46 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[B] = val;
            this.cycles += 19;
        });
        this.addInstruction(0x06, (addr) => {
            // LD B,n Opcode: 06 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[B] = val;
            this.cycles += 7;
        });
        this.addInstruction(0x40, (addr) => {
            // LD B,r Opcode: 40+r
            this.r8[B] = this.r8[B];
            this.cycles += 4;
        });
        this.addInstruction(0x41, (addr) => {
            // LD B,r Opcode: 40+r
            this.r8[B] = this.r8[C];
            this.cycles += 4;
        });
        this.addInstruction(0x42, (addr) => {
            // LD B,r Opcode: 40+r
            this.r8[B] = this.r8[D];
            this.cycles += 4;
        });
        this.addInstruction(0x43, (addr) => {
            // LD B,r Opcode: 40+r
            this.r8[B] = this.r8[E];
            this.cycles += 4;
        });
        this.addInstruction(0x44, (addr) => {
            // LD B,r Opcode: 40+r
            this.r8[B] = this.r8[H];
            this.cycles += 4;
        });
        this.addInstruction(0x45, (addr) => {
            // LD B,r Opcode: 40+r
            this.r8[B] = this.r8[L];
            this.cycles += 4;
        });
        this.addInstruction(0x47, (addr) => {
            // LD B,r Opcode: 40+r
            this.r8[B] = this.r8[A];
            this.cycles += 4;
        });
        this.addInstructionDD(0x44, (addr) => {
            // LD B,IXp Opcode: DD 40+p
            this.r8[B] = this.r8[IXh];
            this.cycles += 8;
        });
        this.addInstructionDD(0x45, (addr) => {
            // LD B,IXp Opcode: DD 40+p
            this.r8[B] = this.r8[IXl];
            this.cycles += 8;
        });
        this.addInstructionFD(0x44, (addr) => {
            // LD B,IYq Opcode: FD 40+q
            this.r8[B] = this.r8[IYh];
            this.cycles += 8;
        });
        this.addInstructionFD(0x45, (addr) => {
            // LD B,IYq Opcode: FD 40+q
            this.r8[B] = this.r8[IYl];
            this.cycles += 8;
        });
        this.addInstructionED(0x4B, (addr) => {
            // LD BC,(nn) Opcode: ED 4B nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);
            this.r16[BC] = val;
            this.cycles += 20;
        });
        this.addInstruction(0x01, (addr) => {
            // LD BC,nn Opcode: 01 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.r16[BC] = val;
            this.cycles += 10;
        });
        this.addInstruction(0x4E, (addr) => {
            // LD C,(HL) Opcode: 4E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[C] = val;
            this.cycles += 7;
        });
        this.addInstructionDD(0x4E, (addr) => {
            // LD C,(IX+o) Opcode: DD 4E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[C] = val;
            this.cycles += 19;
        });
        this.addInstructionFD(0x4E, (addr) => {
            // LD C,(IY+o) Opcode: FD 4E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[C] = val;
            this.cycles += 19;
        });
        this.addInstruction(0x0E, (addr) => {
            // LD C,n Opcode: 0E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[C] = val;
            this.cycles += 7;
        });
        this.addInstruction(0x48, (addr) => {
            // LD C,r Opcode: 48+r
            this.r8[C] = this.r8[B];
            this.cycles += 4;
        });
        this.addInstruction(0x49, (addr) => {
            // LD C,r Opcode: 48+r
            this.r8[C] = this.r8[C];
            this.cycles += 4;
        });
        this.addInstruction(0x4a, (addr) => {
            // LD C,r Opcode: 48+r
            this.r8[C] = this.r8[D];
            this.cycles += 4;
        });
        this.addInstruction(0x4b, (addr) => {
            // LD C,r Opcode: 48+r
            this.r8[C] = this.r8[E];
            this.cycles += 4;
        });
        this.addInstruction(0x4c, (addr) => {
            // LD C,r Opcode: 48+r
            this.r8[C] = this.r8[H];
            this.cycles += 4;
        });
        this.addInstruction(0x4d, (addr) => {
            // LD C,r Opcode: 48+r
            this.r8[C] = this.r8[L];
            this.cycles += 4;
        });
        this.addInstruction(0x4f, (addr) => {
            // LD C,r Opcode: 48+r
            this.r8[C] = this.r8[A];
            this.cycles += 4;
        });
        this.addInstructionDD(0x4c, (addr) => {
            // LD C,IXp Opcode: DD 48+p
            this.r8[C] = this.r8[IXh];
            this.cycles += 8;
        });
        this.addInstructionDD(0x4d, (addr) => {
            // LD C,IXp Opcode: DD 48+p
            this.r8[C] = this.r8[IXl];
            this.cycles += 8;
        });
        this.addInstructionFD(0x4c, (addr) => {
            // LD C,IYq Opcode: FD 48+q
            this.r8[C] = this.r8[IYh];
            this.cycles += 8;
        });
        this.addInstructionFD(0x4d, (addr) => {
            // LD C,IYq Opcode: FD 48+q
            this.r8[C] = this.r8[IYl];
            this.cycles += 8;
        });
        this.addInstruction(0x56, (addr) => {
            // LD D,(HL) Opcode: 56
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[D] = val;
            this.cycles += 7;
        });
        this.addInstructionDD(0x56, (addr) => {
            // LD D,(IX+o) Opcode: DD 56 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[D] = val;
            this.cycles += 19;
        });
        this.addInstructionFD(0x56, (addr) => {
            // LD D,(IY+o) Opcode: FD 56 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[D] = val;
            this.cycles += 19;
        });
        this.addInstruction(0x16, (addr) => {
            // LD D,n Opcode: 16 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[D] = val;
            this.cycles += 7;
        });
        this.addInstruction(0x50, (addr) => {
            // LD D,r Opcode: 50+r
            this.r8[D] = this.r8[B];
            this.cycles += 4;
        });
        this.addInstruction(0x51, (addr) => {
            // LD D,r Opcode: 50+r
            this.r8[D] = this.r8[C];
            this.cycles += 4;
        });
        this.addInstruction(0x52, (addr) => {
            // LD D,r Opcode: 50+r
            this.r8[D] = this.r8[D];
            this.cycles += 4;
        });
        this.addInstruction(0x53, (addr) => {
            // LD D,r Opcode: 50+r
            this.r8[D] = this.r8[E];
            this.cycles += 4;
        });
        this.addInstruction(0x54, (addr) => {
            // LD D,r Opcode: 50+r
            this.r8[D] = this.r8[H];
            this.cycles += 4;
        });
        this.addInstruction(0x55, (addr) => {
            // LD D,r Opcode: 50+r
            this.r8[D] = this.r8[L];
            this.cycles += 4;
        });
        this.addInstruction(0x57, (addr) => {
            // LD D,r Opcode: 50+r
            this.r8[D] = this.r8[A];
            this.cycles += 4;
        });
        this.addInstructionDD(0x54, (addr) => {
            // LD D,IXp Opcode: DD 50+p
            this.r8[D] = this.r8[IXh];
            this.cycles += 8;
        });
        this.addInstructionDD(0x55, (addr) => {
            // LD D,IXp Opcode: DD 50+p
            this.r8[D] = this.r8[IXl];
            this.cycles += 8;
        });
        this.addInstructionFD(0x54, (addr) => {
            // LD D,IYq Opcode: FD 50+q
            this.r8[D] = this.r8[IYh];
            this.cycles += 8;
        });
        this.addInstructionFD(0x55, (addr) => {
            // LD D,IYq Opcode: FD 50+q
            this.r8[D] = this.r8[IYl];
            this.cycles += 8;
        });
        this.addInstructionED(0x5B, (addr) => {
            // LD DE,(nn) Opcode: ED 5B nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);
            this.r16[DE] = val;
            this.cycles += 20;
        });
        this.addInstruction(0x11, (addr) => {
            // LD DE,nn Opcode: 11 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.r16[DE] = val;
            this.cycles += 10;
        });
        this.addInstruction(0x5E, (addr) => {
            // LD E,(HL) Opcode: 5E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[E] = val;
            this.cycles += 7;
        });
        this.addInstructionDD(0x5E, (addr) => {
            // LD E,(IX+o) Opcode: DD 5E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[E] = val;
            this.cycles += 19;
        });
        this.addInstructionFD(0x5E, (addr) => {
            // LD E,(IY+o) Opcode: FD 5E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[E] = val;
            this.cycles += 19;
        });
        this.addInstruction(0x1E, (addr) => {
            // LD E,n Opcode: 1E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[E] = val;
            this.cycles += 7;
        });
        this.addInstruction(0x58, (addr) => {
            // LD E,r Opcode: 58+r
            this.r8[E] = this.r8[B];
            this.cycles += 4;
        });
        this.addInstruction(0x59, (addr) => {
            // LD E,r Opcode: 58+r
            this.r8[E] = this.r8[C];
            this.cycles += 4;
        });
        this.addInstruction(0x5a, (addr) => {
            // LD E,r Opcode: 58+r
            this.r8[E] = this.r8[D];
            this.cycles += 4;
        });
        this.addInstruction(0x5b, (addr) => {
            // LD E,r Opcode: 58+r
            this.r8[E] = this.r8[E];
            this.cycles += 4;
        });
        this.addInstruction(0x5c, (addr) => {
            // LD E,r Opcode: 58+r
            this.r8[E] = this.r8[H];
            this.cycles += 4;
        });
        this.addInstruction(0x5d, (addr) => {
            // LD E,r Opcode: 58+r
            this.r8[E] = this.r8[L];
            this.cycles += 4;
        });
        this.addInstruction(0x5f, (addr) => {
            // LD E,r Opcode: 58+r
            this.r8[E] = this.r8[A];
            this.cycles += 4;
        });
        this.addInstructionDD(0x5c, (addr) => {
            // LD E,IXp Opcode: DD 58+p
            this.r8[E] = this.r8[IXh];
            this.cycles += 8;
        });
        this.addInstructionDD(0x5d, (addr) => {
            // LD E,IXp Opcode: DD 58+p
            this.r8[E] = this.r8[IXl];
            this.cycles += 8;
        });
        this.addInstructionFD(0x5c, (addr) => {
            // LD E,IYq Opcode: FD 58+q
            this.r8[E] = this.r8[IYh];
            this.cycles += 8;
        });
        this.addInstructionFD(0x5d, (addr) => {
            // LD E,IYq Opcode: FD 58+q
            this.r8[E] = this.r8[IYl];
            this.cycles += 8;
        });
        this.addInstruction(0x66, (addr) => {
            // LD H,(HL) Opcode: 66
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[H] = val;
            this.cycles += 7;
        });
        this.addInstructionDD(0x66, (addr) => {
            // LD H,(IX+o) Opcode: DD 66 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[H] = val;
            this.cycles += 19;
        });
        this.addInstructionFD(0x66, (addr) => {
            // LD H,(IY+o) Opcode: FD 66 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[H] = val;
            this.cycles += 19;
        });
        this.addInstruction(0x26, (addr) => {
            // LD H,n Opcode: 26 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[H] = val;
            this.cycles += 7;
        });
        this.addInstruction(0x60, (addr) => {
            // LD H,r Opcode: 60+r
            this.r8[H] = this.r8[B];
            this.cycles += 4;
        });
        this.addInstruction(0x61, (addr) => {
            // LD H,r Opcode: 60+r
            this.r8[H] = this.r8[C];
            this.cycles += 4;
        });
        this.addInstruction(0x62, (addr) => {
            // LD H,r Opcode: 60+r
            this.r8[H] = this.r8[D];
            this.cycles += 4;
        });
        this.addInstruction(0x63, (addr) => {
            // LD H,r Opcode: 60+r
            this.r8[H] = this.r8[E];
            this.cycles += 4;
        });
        this.addInstruction(0x64, (addr) => {
            // LD H,r Opcode: 60+r
            this.r8[H] = this.r8[H];
            this.cycles += 4;
        });
        this.addInstruction(0x65, (addr) => {
            // LD H,r Opcode: 60+r
            this.r8[H] = this.r8[L];
            this.cycles += 4;
        });
        this.addInstruction(0x67, (addr) => {
            // LD H,r Opcode: 60+r
            this.r8[H] = this.r8[A];
            this.cycles += 4;
        });
        this.addInstruction(0x2A, (addr) => {
            // LD HL,(nn) Opcode: 2A nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);
            this.r16[HL] = val;
            this.cycles += 16;
        });
        this.addInstruction(0x21, (addr) => {
            // LD HL,nn Opcode: 21 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.r16[HL] = val;
            this.cycles += 10;
        });
        this.addInstructionED(0x47, (addr) => {
            // LD I,A Opcode: ED 47
            this.r8[I] = this.r8[A];
            this.cycles += 9;
        });
        this.addInstructionDD(0x2A, (addr) => {
            // LD IX,(nn) Opcode: DD 2A nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);
            this.r16[IX] = val;
            this.cycles += 20;
        });
        this.addInstructionDD(0x21, (addr) => {
            // LD IX,nn Opcode: DD 21 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.r16[IX] = val;
            this.cycles += 14;
        });
        this.addInstructionDD(0x26, (addr) => {
            // LD IXh,n Opcode: DD 26 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[IXh] = val;
            this.cycles += 11;
        });
        this.addInstructionDD(0x64, (addr) => {
            // LD IXh,p Opcode: DD 60+p
            this.r8[IXh] = this.r8[IXh];
            this.cycles += 8;
        });
        this.addInstructionDD(0x65, (addr) => {
            // LD IXh,p Opcode: DD 60+p
            this.r8[IXh] = this.r8[IXl];
            this.cycles += 8;
        });
        this.addInstructionDD(0x2E, (addr) => {
            // LD IXl,n Opcode: DD 2E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[IXl] = val;
            this.cycles += 11;
        });
        this.addInstructionDD(0x6c, (addr) => {
            // LD IXl,p Opcode: DD 68+p
            this.r8[IXl] = this.r8[IXh];
            this.cycles += 8;
        });
        this.addInstructionDD(0x6d, (addr) => {
            // LD IXl,p Opcode: DD 68+p
            this.r8[IXl] = this.r8[IXl];
            this.cycles += 8;
        });
        this.addInstructionFD(0x2A, (addr) => {
            // LD IY,(nn) Opcode: FD 2A nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);
            this.r16[IY] = val;
            this.cycles += 20;
        });
        this.addInstructionFD(0x21, (addr) => {
            // LD IY,nn Opcode: FD 21 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.r16[IY] = val;
            this.cycles += 14;
        });
        this.addInstructionFD(0x26, (addr) => {
            // LD IYh,n Opcode: FD 26 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[IYh] = val;
            this.cycles += 11;
        });
        this.addInstructionFD(0x64, (addr) => {
            // LD IYh,q Opcode: FD 60+q
            this.r8[IYh] = this.r8[IYh];
            this.cycles += 8;
        });
        this.addInstructionFD(0x65, (addr) => {
            // LD IYh,q Opcode: FD 60+q
            this.r8[IYh] = this.r8[IYl];
            this.cycles += 8;
        });
        this.addInstructionFD(0x2E, (addr) => {
            // LD IYl,n Opcode: FD 2E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[IYl] = val;
            this.cycles += 11;
        });
        this.addInstructionFD(0x6c, (addr) => {
            // LD IYl,q Opcode: FD 68+q
            this.r8[IYl] = this.r8[IYh];
            this.cycles += 8;
        });
        this.addInstructionFD(0x6d, (addr) => {
            // LD IYl,q Opcode: FD 68+q
            this.r8[IYl] = this.r8[IYl];
            this.cycles += 8;
        });
        this.addInstruction(0x6E, (addr) => {
            // LD L,(HL) Opcode: 6E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[L] = val;
            this.cycles += 7;
        });
        this.addInstructionDD(0x6E, (addr) => {
            // LD L,(IX+o) Opcode: DD 6E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[L] = val;
            this.cycles += 19;
        });
        this.addInstructionFD(0x6E, (addr) => {
            // LD L,(IY+o) Opcode: FD 6E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[L] = val;
            this.cycles += 19;
        });
        this.addInstruction(0x2E, (addr) => {
            // LD L,n Opcode: 2E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[L] = val;
            this.cycles += 7;
        });
        this.addInstruction(0x68, (addr) => {
            // LD L,r Opcode: 68+r
            this.r8[L] = this.r8[B];
            this.cycles += 4;
        });
        this.addInstruction(0x69, (addr) => {
            // LD L,r Opcode: 68+r
            this.r8[L] = this.r8[C];
            this.cycles += 4;
        });
        this.addInstruction(0x6a, (addr) => {
            // LD L,r Opcode: 68+r
            this.r8[L] = this.r8[D];
            this.cycles += 4;
        });
        this.addInstruction(0x6b, (addr) => {
            // LD L,r Opcode: 68+r
            this.r8[L] = this.r8[E];
            this.cycles += 4;
        });
        this.addInstruction(0x6c, (addr) => {
            // LD L,r Opcode: 68+r
            this.r8[L] = this.r8[H];
            this.cycles += 4;
        });
        this.addInstruction(0x6d, (addr) => {
            // LD L,r Opcode: 68+r
            this.r8[L] = this.r8[L];
            this.cycles += 4;
        });
        this.addInstruction(0x6f, (addr) => {
            // LD L,r Opcode: 68+r
            this.r8[L] = this.r8[A];
            this.cycles += 4;
        });
        this.addInstructionED(0x4F, (addr) => {
            // LD R,A Opcode: ED 4F
            this.r8[R] = this.r8[A];
            this.cycles += 9;
        });
        this.addInstructionED(0x7B, (addr) => {
            // LD SP,(nn) Opcode: ED 7B nn nn
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);
            this.r16[SP] = val;
            this.cycles += 20;
        });
        this.addInstruction(0xF9, (addr) => {
            // LD SP,HL Opcode: F9
            this.r16[SP] = this.r16[HL];
            this.cycles += 6;
        });
        this.addInstructionDD(0xF9, (addr) => {
            // LD SP,IX Opcode: DD F9
            this.r16[SP] = this.r16[IX];
            this.cycles += 10;
        });
        this.addInstructionFD(0xF9, (addr) => {
            // LD SP,IY Opcode: FD F9
            this.r16[SP] = this.r16[IY];
            this.cycles += 10;
        });
        this.addInstruction(0x31, (addr) => {
            // LD SP,nn Opcode: 31 nn nn
            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.r16[SP] = val;
            this.cycles += 10;
        });
        this.addInstructionED(0xA8, (addr) => {
            // LDD Opcode: ED A8
            this.ldi_ldd(false);
            this.cycles += 16;
        });
        this.addInstructionED(0xB8, (addr) => {
            // LDDR Opcode: ED B8
            if (this.r16[BC] > 0) {
                while (this.r16[BC] > 0) {
                    this.ldi_ldd(false);
                    this.cycles += 21;
                }
            }
            else {
                this.cycles += 16;
            }
        });
        this.addInstructionED(0xA0, (addr) => {
            // LDI Opcode: ED A0
            this.ldi_ldd(true);
            this.cycles += 16;
        });
        this.addInstructionED(0xB0, (addr) => {
            // LDIR Opcode: ED B0
            if (this.r16[BC] > 0) {
                while (this.r16[BC] > 0) {
                    this.ldi_ldd(true);
                    this.cycles += 21;
                }
            }
            else {
                this.cycles += 16;
            }
        });
        this.addInstructionED(0x44, (addr) => {
            // NEG Opcode: ED 44
            this.r8[A] = this.neg(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstruction(0x0, (addr) => {
            // NOP Opcode: 0
            this.cycles += 4;
        });
        this.addInstruction(0xB6, (addr) => {
            // OR (HL) Opcode: B6
            let val = this.memory.uread8(this.r16[HL]);
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstructionDD(0xB6, (addr) => {
            // OR (IX+o) Opcode: DD B6 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstructionFD(0xB6, (addr) => {
            // OR (IY+o) Opcode: FD B6 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstruction(0xF6, (addr) => {
            // OR n Opcode: F6 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstruction(0xb0, (addr) => {
            // OR r Opcode: B0+r
            let val = this.r8[B];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstruction(0xb1, (addr) => {
            // OR r Opcode: B0+r
            let val = this.r8[C];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstruction(0xb2, (addr) => {
            // OR r Opcode: B0+r
            let val = this.r8[D];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstruction(0xb3, (addr) => {
            // OR r Opcode: B0+r
            let val = this.r8[E];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstruction(0xb4, (addr) => {
            // OR r Opcode: B0+r
            let val = this.r8[H];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstruction(0xb5, (addr) => {
            // OR r Opcode: B0+r
            let val = this.r8[L];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstruction(0xb7, (addr) => {
            // OR r Opcode: B0+r
            let val = this.r8[A];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstructionDD(0xb4, (addr) => {
            // OR IXp Opcode: DD B0+p
            let val = this.r8[IXh];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstructionDD(0xb5, (addr) => {
            // OR IXp Opcode: DD B0+p
            let val = this.r8[IXl];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstructionFD(0xb4, (addr) => {
            // OR IYq Opcode: FD B0+q
            let val = this.r8[IYh];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstructionFD(0xb5, (addr) => {
            // OR IYq Opcode: FD B0+q
            let val = this.r8[IYl];
            this.logicalOperation(val, LogicalOperation.OR);
        });
        this.addInstructionED(0xBB, (addr) => {
            // OTDR Opcode: ED BB
            if (this.r8[B] > 0) {
                while (this.r8[B] > 0) {
                    this.ini_inid_outi_outd(false, false);
                    this.cycles += 21;
                }
            }
            else {
                this.cycles += 16;
            }
        });
        this.addInstructionED(0xB3, (addr) => {
            // OTIR Opcode: ED B3
            if (this.r8[B] > 0) {
                while (this.r8[B] > 0) {
                    this.ini_inid_outi_outd(false, true);
                    this.cycles += 21;
                }
            }
            else {
                this.cycles += 16;
            }
        });
        this.addInstructionED(0x79, (addr) => {
            // OUT (C),A Opcode: ED 79
            let val = this.r8[A];
            this.IO.write8(this.r8[C], val);
            this.cycles += 12;
        });
        this.addInstructionED(0x41, (addr) => {
            // OUT (C),B Opcode: ED 41
            let val = this.r8[B];
            this.IO.write8(this.r8[C], val);
            this.cycles += 12;
        });
        this.addInstructionED(0x49, (addr) => {
            // OUT (C),C Opcode: ED 49
            let val = this.r8[C];
            this.IO.write8(this.r8[C], val);
            this.cycles += 12;
        });
        this.addInstructionED(0x51, (addr) => {
            // OUT (C),D Opcode: ED 51
            let val = this.r8[D];
            this.IO.write8(this.r8[C], val);
            this.cycles += 12;
        });
        this.addInstructionED(0x59, (addr) => {
            // OUT (C),E Opcode: ED 59
            let val = this.r8[E];
            this.IO.write8(this.r8[C], val);
            this.cycles += 12;
        });
        this.addInstructionED(0x61, (addr) => {
            // OUT (C),H Opcode: ED 61
            let val = this.r8[H];
            this.IO.write8(this.r8[C], val);
            this.cycles += 12;
        });
        this.addInstructionED(0x69, (addr) => {
            // OUT (C),L Opcode: ED 69
            let val = this.r8[L];
            this.IO.write8(this.r8[C], val);
            this.cycles += 12;
        });
        this.addInstruction(0xD3, (addr) => {
            // OUT (n),A Opcode: D3 n
            let val = this.r8[A];
            let n = this.memory.uread8(this.r16[PC]++);
            this.IO.write8(n, val);
            this.cycles += 11;
        });
        this.addInstructionED(0xAB, (addr) => {
            // OUTD Opcode: ED AB
            this.ini_inid_outi_outd(false, false);
            this.cycles += 16;
        });
        this.addInstructionED(0xA3, (addr) => {
            // OUTI Opcode: ED A3
            this.ini_inid_outi_outd(false, true);
            this.cycles += 16;
        });
        this.addInstruction(0xF1, (addr) => {
            // POP AF Opcode: F1
            this.r16[AF] = this.memory.uread16(this.r16[SP]);
            this.r16[SP] += 2;
            this.cycles += 10;
        });
        this.addInstruction(0xC1, (addr) => {
            // POP BC Opcode: C1
            this.r16[BC] = this.memory.uread16(this.r16[SP]);
            this.r16[SP] += 2;
            this.cycles += 10;
        });
        this.addInstruction(0xD1, (addr) => {
            // POP DE Opcode: D1
            this.r16[DE] = this.memory.uread16(this.r16[SP]);
            this.r16[SP] += 2;
            this.cycles += 10;
        });
        this.addInstruction(0xE1, (addr) => {
            // POP HL Opcode: E1
            this.r16[HL] = this.memory.uread16(this.r16[SP]);
            this.r16[SP] += 2;
            this.cycles += 10;
        });
        this.addInstructionDD(0xE1, (addr) => {
            // POP IX Opcode: DD E1
            this.r16[IX] = this.memory.uread16(this.r16[SP]);
            this.r16[SP] += 2;
            this.cycles += 14;
        });
        this.addInstructionFD(0xE1, (addr) => {
            // POP IY Opcode: FD E1
            this.r16[IY] = this.memory.uread16(this.r16[SP]);
            this.r16[SP] += 2;
            this.cycles += 14;
        });
        this.addInstruction(0xF5, (addr) => {
            // PUSH AF Opcode: F5
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[AF]);
            this.cycles += 11;
        });
        this.addInstruction(0xC5, (addr) => {
            // PUSH BC Opcode: C5
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[BC]);
            this.cycles += 11;
        });
        this.addInstruction(0xD5, (addr) => {
            // PUSH DE Opcode: D5
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[DE]);
            this.cycles += 11;
        });
        this.addInstruction(0xE5, (addr) => {
            // PUSH HL Opcode: E5
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[HL]);
            this.cycles += 11;
        });
        this.addInstructionDD(0xE5, (addr) => {
            // PUSH IX Opcode: DD E5
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[IX]);
            this.cycles += 15;
        });
        this.addInstructionFD(0xE5, (addr) => {
            // PUSH IY Opcode: FD E5
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[IY]);
            this.cycles += 15;
        });
        this.addInstructionCB(0x86, (addr) => {
            // RES b,(HL) Opcode: CB 86+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.res(0, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0x8E, (addr) => {
            // RES b,(HL) Opcode: CB 86+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.res(1, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0x96, (addr) => {
            // RES b,(HL) Opcode: CB 86+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.res(2, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0x9E, (addr) => {
            // RES b,(HL) Opcode: CB 86+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.res(3, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xA6, (addr) => {
            // RES b,(HL) Opcode: CB 86+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.res(4, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xAE, (addr) => {
            // RES b,(HL) Opcode: CB 86+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.res(5, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xB6, (addr) => {
            // RES b,(HL) Opcode: CB 86+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.res(6, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xBE, (addr) => {
            // RES b,(HL) Opcode: CB 86+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.res(7, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionDDCB(0x86, (addr, o) => {
            // RES b,(IX+o) Opcode: DD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.res(0, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0x8E, (addr, o) => {
            // RES b,(IX+o) Opcode: DD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.res(1, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0x96, (addr, o) => {
            // RES b,(IX+o) Opcode: DD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.res(2, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0x9E, (addr, o) => {
            // RES b,(IX+o) Opcode: DD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.res(3, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xA6, (addr, o) => {
            // RES b,(IX+o) Opcode: DD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.res(4, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xAE, (addr, o) => {
            // RES b,(IX+o) Opcode: DD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.res(5, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xB6, (addr, o) => {
            // RES b,(IX+o) Opcode: DD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.res(6, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xBE, (addr, o) => {
            // RES b,(IX+o) Opcode: DD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.res(7, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x86, (addr, o) => {
            // RES b,(IY+o) Opcode: FD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.res(0, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x8E, (addr, o) => {
            // RES b,(IY+o) Opcode: FD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.res(1, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x96, (addr, o) => {
            // RES b,(IY+o) Opcode: FD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.res(2, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x9E, (addr, o) => {
            // RES b,(IY+o) Opcode: FD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.res(3, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xA6, (addr, o) => {
            // RES b,(IY+o) Opcode: FD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.res(4, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xAE, (addr, o) => {
            // RES b,(IY+o) Opcode: FD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.res(5, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xB6, (addr, o) => {
            // RES b,(IY+o) Opcode: FD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.res(6, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xBE, (addr, o) => {
            // RES b,(IY+o) Opcode: FD CB o 86+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.res(7, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionCB(0x80, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[B];
            val = this.res(0, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x81, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[C];
            val = this.res(0, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x82, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[D];
            val = this.res(0, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x83, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[E];
            val = this.res(0, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x84, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[H];
            val = this.res(0, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x85, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[L];
            val = this.res(0, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x87, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[A];
            val = this.res(0, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x88, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[B];
            val = this.res(1, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x89, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[C];
            val = this.res(1, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x8A, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[D];
            val = this.res(1, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x8B, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[E];
            val = this.res(1, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x8C, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[H];
            val = this.res(1, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x8D, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[L];
            val = this.res(1, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x8F, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[A];
            val = this.res(1, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x90, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[B];
            val = this.res(2, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x91, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[C];
            val = this.res(2, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x92, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[D];
            val = this.res(2, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x93, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[E];
            val = this.res(2, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x94, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[H];
            val = this.res(2, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x95, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[L];
            val = this.res(2, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x97, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[A];
            val = this.res(2, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x98, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[B];
            val = this.res(3, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x99, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[C];
            val = this.res(3, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x9A, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[D];
            val = this.res(3, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x9B, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[E];
            val = this.res(3, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x9C, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[H];
            val = this.res(3, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x9D, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[L];
            val = this.res(3, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x9F, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[A];
            val = this.res(3, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xA0, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[B];
            val = this.res(4, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xA1, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[C];
            val = this.res(4, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xA2, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[D];
            val = this.res(4, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xA3, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[E];
            val = this.res(4, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xA4, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[H];
            val = this.res(4, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xA5, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[L];
            val = this.res(4, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xA7, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[A];
            val = this.res(4, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xA8, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[B];
            val = this.res(5, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xA9, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[C];
            val = this.res(5, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xAA, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[D];
            val = this.res(5, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xAB, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[E];
            val = this.res(5, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xAC, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[H];
            val = this.res(5, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xAD, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[L];
            val = this.res(5, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xAF, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[A];
            val = this.res(5, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xB0, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[B];
            val = this.res(6, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xB1, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[C];
            val = this.res(6, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xB2, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[D];
            val = this.res(6, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xB3, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[E];
            val = this.res(6, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xB4, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[H];
            val = this.res(6, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xB5, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[L];
            val = this.res(6, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xB7, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[A];
            val = this.res(6, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xB8, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[B];
            val = this.res(7, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xB9, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[C];
            val = this.res(7, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xBA, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[D];
            val = this.res(7, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xBB, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[E];
            val = this.res(7, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xBC, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[H];
            val = this.res(7, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xBD, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[L];
            val = this.res(7, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xBF, (addr) => {
            // RES b,r Opcode: CB 80+8*b+r
            let val = this.r8[A];
            val = this.res(7, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstruction(0xC9, (addr) => {
            // RET Opcode: C9
            this.r16[PC] = this.memory.uread16(this.r16[SP]);
            this.r16[SP] += 2;
            this.cycles += 10;
        });
        this.addInstruction(0xD8, (addr) => {
            // RET C Opcode: D8
            if ((this.r8[F] & Flags.C)) {
                this.r16[PC] = this.memory.uread16(this.r16[SP]);
                this.r16[SP] += 2;
                this.cycles += 11;
            }
            else {
                this.cycles += 5;
            }
        });
        this.addInstruction(0xF8, (addr) => {
            // RET M Opcode: F8
            if ((this.r8[F] & Flags.S)) {
                this.r16[PC] = this.memory.uread16(this.r16[SP]);
                this.r16[SP] += 2;
                this.cycles += 11;
            }
            else {
                this.cycles += 5;
            }
        });
        this.addInstruction(0xD0, (addr) => {
            // RET NC Opcode: D0
            if (!(this.r8[F] & Flags.C)) {
                this.r16[PC] = this.memory.uread16(this.r16[SP]);
                this.r16[SP] += 2;
                this.cycles += 11;
            }
            else {
                this.cycles += 5;
            }
        });
        this.addInstruction(0xC0, (addr) => {
            // RET NZ Opcode: C0
            if (!(this.r8[F] & Flags.Z)) {
                this.r16[PC] = this.memory.uread16(this.r16[SP]);
                this.r16[SP] += 2;
                this.cycles += 11;
            }
            else {
                this.cycles += 5;
            }
        });
        this.addInstruction(0xF0, (addr) => {
            // RET P Opcode: F0
            if (!(this.r8[F] & Flags.S)) {
                this.r16[PC] = this.memory.uread16(this.r16[SP]);
                this.r16[SP] += 2;
                this.cycles += 11;
            }
            else {
                this.cycles += 5;
            }
        });
        this.addInstruction(0xE8, (addr) => {
            // RET PE Opcode: E8
            if ((this.r8[F] & Flags.PV)) {
                this.r16[PC] = this.memory.uread16(this.r16[SP]);
                this.r16[SP] += 2;
                this.cycles += 11;
            }
            else {
                this.cycles += 5;
            }
        });
        this.addInstruction(0xE0, (addr) => {
            // RET PO Opcode: E0
            if (!(this.r8[F] & Flags.PV)) {
                this.r16[PC] = this.memory.uread16(this.r16[SP]);
                this.r16[SP] += 2;
                this.cycles += 11;
            }
            else {
                this.cycles += 5;
            }
        });
        this.addInstruction(0xC8, (addr) => {
            // RET Z Opcode: C8
            if ((this.r8[F] & Flags.Z)) {
                this.r16[PC] = this.memory.uread16(this.r16[SP]);
                this.r16[SP] += 2;
                this.cycles += 11;
            }
            else {
                this.cycles += 5;
            }
        });
        this.addInstructionED(0x4D, (addr) => {
            // RETI Opcode: ED 4D
            this.r16[PC] = this.memory.uread16(this.r16[SP]);
            this.r16[SP] += 2;
            this.cycles += 14;
        });
        this.addInstructionED(0x45, (addr) => {
            // RETN Opcode: ED 45
            this.r16[PC] = this.memory.uread16(this.r16[SP]);
            this.r16[SP] += 2;
            this.cycles += 14;
        });
        this.addInstructionCB(0x16, (addr) => {
            // RL (HL) Opcode: CB 16
            let val = this.memory.uread8(this.r16[HL]);
            val = this.rotateLeft(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionDDCB(0x16, (addr, o) => {
            // RL (IX+o) Opcode: DD CB o 16
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.rotateLeft(val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x16, (addr, o) => {
            // RL (IY+o) Opcode: FD CB o 16
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.rotateLeft(val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionCB(0x10, (addr) => {
            // RL r Opcode: CB 10+r
            this.r8[B] = this.rotateLeft(this.r8[B]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x11, (addr) => {
            // RL r Opcode: CB 10+r
            this.r8[C] = this.rotateLeft(this.r8[C]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x12, (addr) => {
            // RL r Opcode: CB 10+r
            this.r8[D] = this.rotateLeft(this.r8[D]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x13, (addr) => {
            // RL r Opcode: CB 10+r
            this.r8[E] = this.rotateLeft(this.r8[E]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x14, (addr) => {
            // RL r Opcode: CB 10+r
            this.r8[H] = this.rotateLeft(this.r8[H]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x15, (addr) => {
            // RL r Opcode: CB 10+r
            this.r8[L] = this.rotateLeft(this.r8[L]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x17, (addr) => {
            // RL r Opcode: CB 10+r
            this.r8[A] = this.rotateLeft(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstruction(0x17, (addr) => {
            // RLA Opcode: 17
            let temp_flags = this.r8[F];
            this.r8[A] = this.rotateLeft(this.r8[A]);
            // Flags S, Z and PV are not set
            let mask = Flags.S | Flags.Z | Flags.PV;
            this.r8[F] &= ~mask;
            this.r8[F] |= (mask & temp_flags);
            this.cycles += 4;
        });
        this.addInstructionCB(0x06, (addr) => {
            // RLC (HL) Opcode: CB 06
            let val = this.memory.uread8(this.r16[HL]);
            val = this.rotateLeftCarry(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionDDCB(0x06, (addr, o) => {
            // RLC (IX+o) Opcode: DD CB o 06
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.rotateLeftCarry(val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x06, (addr, o) => {
            // RLC (IY+o) Opcode: FD CB o 06
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.rotateLeftCarry(val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionCB(0x0, (addr) => {
            // RLC r Opcode: CB 00+r
            this.r8[B] = this.rotateLeftCarry(this.r8[B]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x1, (addr) => {
            // RLC r Opcode: CB 00+r
            this.r8[C] = this.rotateLeftCarry(this.r8[C]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x2, (addr) => {
            // RLC r Opcode: CB 00+r
            this.r8[D] = this.rotateLeftCarry(this.r8[D]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x3, (addr) => {
            // RLC r Opcode: CB 00+r
            this.r8[E] = this.rotateLeftCarry(this.r8[E]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x4, (addr) => {
            // RLC r Opcode: CB 00+r
            this.r8[H] = this.rotateLeftCarry(this.r8[H]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x5, (addr) => {
            // RLC r Opcode: CB 00+r
            this.r8[L] = this.rotateLeftCarry(this.r8[L]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x7, (addr) => {
            // RLC r Opcode: CB 00+r
            this.r8[A] = this.rotateLeftCarry(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstruction(0x7, (addr) => {
            // RLCA Opcode: 7
            let temp_flags = this.r8[F];
            this.r8[A] = this.rotateLeftCarry(this.r8[A], true);
            // Flags S, Z and PV are not set
            let mask = Flags.S | Flags.Z | Flags.PV;
            this.r8[F] &= ~mask;
            this.r8[F] |= (mask & temp_flags);
            this.cycles += 4;
        });
        this.addInstructionED(0x6F, (addr) => {
            // RLD Opcode: ED 6F
            this.rotateRLD();
            this.cycles += 18;
        });
        this.addInstructionCB(0x1E, (addr) => {
            // RR (HL) Opcode: CB 1E
            let val = this.memory.uread8(this.r16[HL]);
            val = this.rotateRight(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionDDCB(0x1E, (addr, o) => {
            // RR (IX+o) Opcode: DD CB o 1E
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.rotateRight(val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x1E, (addr, o) => {
            // RR (IY+o) Opcode: FD CB o 1E
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.rotateRight(val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionCB(0x18, (addr) => {
            // RR r Opcode: CB 18+r
            this.r8[B] = this.rotateRight(this.r8[B]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x19, (addr) => {
            // RR r Opcode: CB 18+r
            this.r8[C] = this.rotateRight(this.r8[C]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x1a, (addr) => {
            // RR r Opcode: CB 18+r
            this.r8[D] = this.rotateRight(this.r8[D]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x1b, (addr) => {
            // RR r Opcode: CB 18+r
            this.r8[E] = this.rotateRight(this.r8[E]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x1c, (addr) => {
            // RR r Opcode: CB 18+r
            this.r8[H] = this.rotateRight(this.r8[H]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x1d, (addr) => {
            // RR r Opcode: CB 18+r
            this.r8[L] = this.rotateRight(this.r8[L]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x1f, (addr) => {
            // RR r Opcode: CB 18+r
            this.r8[A] = this.rotateRight(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstruction(0x1F, (addr) => {
            // RRA Opcode: 1F
            let temp_flags = this.r8[F];
            this.r8[A] = this.rotateRight(this.r8[A]);
            // Flags S, Z and PV are not set
            let mask = Flags.S | Flags.Z | Flags.PV;
            this.r8[F] &= ~mask;
            this.r8[F] |= (mask & temp_flags);
            this.cycles += 4;
        });
        this.addInstructionCB(0x0E, (addr) => {
            // RRC (HL) Opcode: CB 0E
            let val = this.memory.uread8(this.r16[HL]);
            val = this.rotateRightCarry(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionDDCB(0x0E, (addr, o) => {
            // RRC (IX+o) Opcode: DD CB o 0E
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.rotateRightCarry(val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x0E, (addr, o) => {
            // RRC (IY+o) Opcode: FD CB o 0E
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.rotateRightCarry(val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionCB(0x8, (addr) => {
            // RRC r Opcode: CB 08+r
            this.r8[B] = this.rotateRightCarry(this.r8[B]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x9, (addr) => {
            // RRC r Opcode: CB 08+r
            this.r8[C] = this.rotateRightCarry(this.r8[C]);
            this.cycles += 8;
        });
        this.addInstructionCB(0xa, (addr) => {
            // RRC r Opcode: CB 08+r
            this.r8[D] = this.rotateRightCarry(this.r8[D]);
            this.cycles += 8;
        });
        this.addInstructionCB(0xb, (addr) => {
            // RRC r Opcode: CB 08+r
            this.r8[E] = this.rotateRightCarry(this.r8[E]);
            this.cycles += 8;
        });
        this.addInstructionCB(0xc, (addr) => {
            // RRC r Opcode: CB 08+r
            this.r8[H] = this.rotateRightCarry(this.r8[H]);
            this.cycles += 8;
        });
        this.addInstructionCB(0xd, (addr) => {
            // RRC r Opcode: CB 08+r
            this.r8[L] = this.rotateRightCarry(this.r8[L]);
            this.cycles += 8;
        });
        this.addInstructionCB(0xf, (addr) => {
            // RRC r Opcode: CB 08+r
            this.r8[A] = this.rotateRightCarry(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstruction(0x0F, (addr) => {
            // RRCA Opcode: 0F
            let temp_flags = this.r8[F];
            this.r8[A] = this.rotateRightCarry(this.r8[A]);
            // Flags S, Z and PV are not set
            let mask = Flags.S | Flags.Z | Flags.PV;
            this.r8[F] &= ~mask;
            this.r8[F] |= (mask & temp_flags);
            this.cycles += 4;
        });
        this.addInstructionED(0x67, (addr) => {
            // RRD Opcode: ED 67
            this.rotateRRD();
            this.cycles += 18;
        });
        this.addInstruction(0xC7, (addr) => {
            // RST 0 Opcode: C7
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            this.r16[PC] = 0x0;
            this.cycles += 11;
        });
        this.addInstruction(0xCF, (addr) => {
            // RST 8H Opcode: CF
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            this.r16[PC] = 0x8;
            this.cycles += 11;
        });
        this.addInstruction(0xD7, (addr) => {
            // RST 10H Opcode: D7
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            this.r16[PC] = 0x10;
            this.cycles += 11;
        });
        this.addInstruction(0xDF, (addr) => {
            // RST 18H Opcode: DF
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            this.r16[PC] = 0x18;
            this.cycles += 11;
        });
        this.addInstruction(0xE7, (addr) => {
            // RST 20H Opcode: E7
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            this.r16[PC] = 0x20;
            this.cycles += 11;
        });
        this.addInstruction(0xEF, (addr) => {
            // RST 28H Opcode: EF
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            this.r16[PC] = 0x28;
            this.cycles += 11;
        });
        this.addInstruction(0xF7, (addr) => {
            // RST 30H Opcode: F7
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            this.r16[PC] = 0x30;
            this.cycles += 11;
        });
        this.addInstruction(0xFF, (addr) => {
            // RST 38H Opcode: FF
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            this.r16[PC] = 0x38;
            this.cycles += 11;
        });
        this.addInstruction(0x9E, (addr) => {
            // SBC A,(HL) Opcode: 9E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 7;
        });
        this.addInstructionDD(0x9E, (addr) => {
            // SBC A,(IX+o) Opcode: DD 9E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 19;
        });
        this.addInstructionFD(0x9E, (addr) => {
            // SBC A,(IY+o) Opcode: FD 9E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 19;
        });
        this.addInstruction(0xDE, (addr) => {
            // SBC A,n Opcode: DE n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 7;
        });
        this.addInstruction(0x98, (addr) => {
            // SBC A,r Opcode: 98+r
            let val = this.r8[B];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 4;
        });
        this.addInstruction(0x99, (addr) => {
            // SBC A,r Opcode: 98+r
            let val = this.r8[C];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 4;
        });
        this.addInstruction(0x9a, (addr) => {
            // SBC A,r Opcode: 98+r
            let val = this.r8[D];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 4;
        });
        this.addInstruction(0x9b, (addr) => {
            // SBC A,r Opcode: 98+r
            let val = this.r8[E];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 4;
        });
        this.addInstruction(0x9c, (addr) => {
            // SBC A,r Opcode: 98+r
            let val = this.r8[H];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 4;
        });
        this.addInstruction(0x9d, (addr) => {
            // SBC A,r Opcode: 98+r
            let val = this.r8[L];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 4;
        });
        this.addInstruction(0x9f, (addr) => {
            // SBC A,r Opcode: 98+r
            let val = this.r8[A];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 4;
        });
        this.addInstructionDD(0x9c, (addr) => {
            // SBC A,IXp Opcode: DD 98+p
            let val = this.r8[IXh];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 8;
        });
        this.addInstructionDD(0x9d, (addr) => {
            // SBC A,IXp Opcode: DD 98+p
            let val = this.r8[IXl];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 8;
        });
        this.addInstructionFD(0x9c, (addr) => {
            // SBC A,IYq Opcode: FD 98+q
            let val = this.r8[IYh];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 8;
        });
        this.addInstructionFD(0x9d, (addr) => {
            // SBC A,IYq Opcode: FD 98+q
            let val = this.r8[IYl];
            this.r8[A] = this.addSub8(this.r8[A], val, true, true);
            this.cycles += 8;
        });
        this.addInstructionED(0x42, (addr) => {
            // SBC HL,BC Opcode: ED 42
            let val = this.r16[BC];
            this.r16[HL] = this.addSub16(this.r16[HL], val, true, true);
            this.cycles += 15;
        });
        this.addInstructionED(0x52, (addr) => {
            // SBC HL,DE Opcode: ED 52
            let val = this.r16[DE];
            this.r16[HL] = this.addSub16(this.r16[HL], val, true, true);
            this.cycles += 15;
        });
        this.addInstructionED(0x62, (addr) => {
            // SBC HL,HL Opcode: ED 62
            let val = this.r16[HL];
            this.r16[HL] = this.addSub16(this.r16[HL], val, true, true);
            this.cycles += 15;
        });
        this.addInstructionED(0x72, (addr) => {
            // SBC HL,SP Opcode: ED 72
            let val = this.r16[SP];
            this.r16[HL] = this.addSub16(this.r16[HL], val, true, true);
            this.cycles += 15;
        });
        this.addInstruction(0x37, (addr) => {
            // SCF Opcode: 37
            // Carry flag set, H and N cleared, rest are preserved.
            this.r8[F] |= Flags.C;
            this.r8[F] &= ~Flags.H;
            this.r8[F] &= ~Flags.N;
            this.cycles += 4;
        });
        this.addInstructionCB(0xC6, (addr) => {
            // SET b,(HL) Opcode: CB C6+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.set(0, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xCE, (addr) => {
            // SET b,(HL) Opcode: CB C6+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.set(1, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xD6, (addr) => {
            // SET b,(HL) Opcode: CB C6+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.set(2, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xDE, (addr) => {
            // SET b,(HL) Opcode: CB C6+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.set(3, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xE6, (addr) => {
            // SET b,(HL) Opcode: CB C6+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.set(4, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xEE, (addr) => {
            // SET b,(HL) Opcode: CB C6+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.set(5, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xF6, (addr) => {
            // SET b,(HL) Opcode: CB C6+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.set(6, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0xFE, (addr) => {
            // SET b,(HL) Opcode: CB C6+8*b
            let val = this.memory.uread8(this.r16[HL]);
            val = this.set(7, val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionDDCB(0xC6, (addr, o) => {
            // SET b,(IX+o) Opcode: DD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.set(0, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xCE, (addr, o) => {
            // SET b,(IX+o) Opcode: DD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.set(1, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xD6, (addr, o) => {
            // SET b,(IX+o) Opcode: DD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.set(2, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xDE, (addr, o) => {
            // SET b,(IX+o) Opcode: DD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.set(3, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xE6, (addr, o) => {
            // SET b,(IX+o) Opcode: DD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.set(4, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xEE, (addr, o) => {
            // SET b,(IX+o) Opcode: DD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.set(5, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xF6, (addr, o) => {
            // SET b,(IX+o) Opcode: DD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.set(6, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionDDCB(0xFE, (addr, o) => {
            // SET b,(IX+o) Opcode: DD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.set(7, val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xC6, (addr, o) => {
            // SET b,(IY+o) Opcode: FD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.set(0, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xCE, (addr, o) => {
            // SET b,(IY+o) Opcode: FD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.set(1, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xD6, (addr, o) => {
            // SET b,(IY+o) Opcode: FD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.set(2, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xDE, (addr, o) => {
            // SET b,(IY+o) Opcode: FD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.set(3, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xE6, (addr, o) => {
            // SET b,(IY+o) Opcode: FD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.set(4, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xEE, (addr, o) => {
            // SET b,(IY+o) Opcode: FD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.set(5, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xF6, (addr, o) => {
            // SET b,(IY+o) Opcode: FD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.set(6, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0xFE, (addr, o) => {
            // SET b,(IY+o) Opcode: FD CB o C6+8*b
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.set(7, val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionCB(0xC0, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[B];
            val = this.set(0, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xC1, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[C];
            val = this.set(0, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xC2, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[D];
            val = this.set(0, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xC3, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[E];
            val = this.set(0, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xC4, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[H];
            val = this.set(0, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xC5, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[L];
            val = this.set(0, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xC7, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[A];
            val = this.set(0, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xC8, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[B];
            val = this.set(1, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xC9, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[C];
            val = this.set(1, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xCA, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[D];
            val = this.set(1, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xCB, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[E];
            val = this.set(1, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xCC, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[H];
            val = this.set(1, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xCD, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[L];
            val = this.set(1, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xCF, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[A];
            val = this.set(1, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xD0, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[B];
            val = this.set(2, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xD1, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[C];
            val = this.set(2, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xD2, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[D];
            val = this.set(2, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xD3, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[E];
            val = this.set(2, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xD4, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[H];
            val = this.set(2, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xD5, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[L];
            val = this.set(2, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xD7, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[A];
            val = this.set(2, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xD8, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[B];
            val = this.set(3, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xD9, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[C];
            val = this.set(3, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xDA, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[D];
            val = this.set(3, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xDB, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[E];
            val = this.set(3, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xDC, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[H];
            val = this.set(3, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xDD, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[L];
            val = this.set(3, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xDF, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[A];
            val = this.set(3, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xE0, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[B];
            val = this.set(4, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xE1, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[C];
            val = this.set(4, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xE2, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[D];
            val = this.set(4, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xE3, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[E];
            val = this.set(4, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xE4, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[H];
            val = this.set(4, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xE5, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[L];
            val = this.set(4, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xE7, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[A];
            val = this.set(4, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xE8, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[B];
            val = this.set(5, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xE9, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[C];
            val = this.set(5, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xEA, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[D];
            val = this.set(5, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xEB, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[E];
            val = this.set(5, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xEC, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[H];
            val = this.set(5, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xED, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[L];
            val = this.set(5, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xEF, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[A];
            val = this.set(5, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xF0, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[B];
            val = this.set(6, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xF1, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[C];
            val = this.set(6, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xF2, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[D];
            val = this.set(6, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xF3, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[E];
            val = this.set(6, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xF4, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[H];
            val = this.set(6, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xF5, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[L];
            val = this.set(6, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xF7, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[A];
            val = this.set(6, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xF8, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[B];
            val = this.set(7, val);
            this.r8[B] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xF9, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[C];
            val = this.set(7, val);
            this.r8[C] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xFA, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[D];
            val = this.set(7, val);
            this.r8[D] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xFB, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[E];
            val = this.set(7, val);
            this.r8[E] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xFC, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[H];
            val = this.set(7, val);
            this.r8[H] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xFD, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[L];
            val = this.set(7, val);
            this.r8[L] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0xFF, (addr) => {
            // SET b,r Opcode: CB C0+8*b+r
            let val = this.r8[A];
            val = this.set(7, val);
            this.r8[A] = val;
            this.cycles += 8;
        });
        this.addInstructionCB(0x26, (addr) => {
            // SLA (HL) Opcode: CB 26
            let val = this.memory.uread8(this.r16[HL]);
            val = this.shiftLeft(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionDDCB(0x26, (addr, o) => {
            // SLA (IX+o) Opcode: DD CB o 26
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.shiftLeft(val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x26, (addr, o) => {
            // SLA (IY+o) Opcode: FD CB o 26
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.shiftLeft(val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionCB(0x20, (addr) => {
            // SLA r Opcode: CB 20+r
            this.r8[B] = this.shiftLeft(this.r8[B]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x21, (addr) => {
            // SLA r Opcode: CB 20+r
            this.r8[C] = this.shiftLeft(this.r8[C]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x22, (addr) => {
            // SLA r Opcode: CB 20+r
            this.r8[D] = this.shiftLeft(this.r8[D]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x23, (addr) => {
            // SLA r Opcode: CB 20+r
            this.r8[E] = this.shiftLeft(this.r8[E]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x24, (addr) => {
            // SLA r Opcode: CB 20+r
            this.r8[H] = this.shiftLeft(this.r8[H]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x25, (addr) => {
            // SLA r Opcode: CB 20+r
            this.r8[L] = this.shiftLeft(this.r8[L]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x27, (addr) => {
            // SLA r Opcode: CB 20+r
            this.r8[A] = this.shiftLeft(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x2E, (addr) => {
            // SRA (HL) Opcode: CB 2E
            let val = this.memory.uread8(this.r16[HL]);
            val = this.shiftRightArithmetic(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionDDCB(0x2E, (addr, o) => {
            // SRA (IX+o) Opcode: DD CB o 2E
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.shiftRightArithmetic(val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x2E, (addr, o) => {
            // SRA (IY+o) Opcode: FD CB o 2E
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.shiftRightArithmetic(val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionCB(0x28, (addr) => {
            // SRA r Opcode: CB 28+r
            this.r8[B] = this.shiftRightArithmetic(this.r8[B]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x29, (addr) => {
            // SRA r Opcode: CB 28+r
            this.r8[C] = this.shiftRightArithmetic(this.r8[C]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x2a, (addr) => {
            // SRA r Opcode: CB 28+r
            this.r8[D] = this.shiftRightArithmetic(this.r8[D]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x2b, (addr) => {
            // SRA r Opcode: CB 28+r
            this.r8[E] = this.shiftRightArithmetic(this.r8[E]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x2c, (addr) => {
            // SRA r Opcode: CB 28+r
            this.r8[H] = this.shiftRightArithmetic(this.r8[H]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x2d, (addr) => {
            // SRA r Opcode: CB 28+r
            this.r8[L] = this.shiftRightArithmetic(this.r8[L]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x2f, (addr) => {
            // SRA r Opcode: CB 28+r
            this.r8[A] = this.shiftRightArithmetic(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x3E, (addr) => {
            // SRL (HL) Opcode: CB 3E
            let val = this.memory.uread8(this.r16[HL]);
            val = this.shiftRightLogic(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionDDCB(0x3E, (addr, o) => {
            // SRL (IX+o) Opcode: DD CB o 3E
            let val = this.memory.uread8(this.r16[IX] + o);
            val = this.shiftRightLogic(val);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 23;
        });
        this.addInstructionFDCB(0x3E, (addr, o) => {
            // SRL (IY+o) Opcode: FD CB o 3E
            let val = this.memory.uread8(this.r16[IY] + o);
            val = this.shiftRightLogic(val);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 23;
        });
        this.addInstructionCB(0x38, (addr) => {
            // SRL r Opcode: CB 38+r
            this.r8[B] = this.shiftRightLogic(this.r8[B]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x39, (addr) => {
            // SRL r Opcode: CB 38+r
            this.r8[C] = this.shiftRightLogic(this.r8[C]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x3a, (addr) => {
            // SRL r Opcode: CB 38+r
            this.r8[D] = this.shiftRightLogic(this.r8[D]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x3b, (addr) => {
            // SRL r Opcode: CB 38+r
            this.r8[E] = this.shiftRightLogic(this.r8[E]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x3c, (addr) => {
            // SRL r Opcode: CB 38+r
            this.r8[H] = this.shiftRightLogic(this.r8[H]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x3d, (addr) => {
            // SRL r Opcode: CB 38+r
            this.r8[L] = this.shiftRightLogic(this.r8[L]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x3f, (addr) => {
            // SRL r Opcode: CB 38+r
            this.r8[A] = this.shiftRightLogic(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstruction(0x96, (addr) => {
            // SUB (HL) Opcode: 96
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 7;
        });
        this.addInstructionDD(0x96, (addr) => {
            // SUB (IX+o) Opcode: DD 96 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 19;
        });
        this.addInstructionFD(0x96, (addr) => {
            // SUB (IY+o) Opcode: FD 96 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 19;
        });
        this.addInstruction(0xD6, (addr) => {
            // SUB n Opcode: D6 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 7;
        });
        this.addInstruction(0x90, (addr) => {
            // SUB r Opcode: 90+r
            let val = this.r8[B];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0x91, (addr) => {
            // SUB r Opcode: 90+r
            let val = this.r8[C];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0x92, (addr) => {
            // SUB r Opcode: 90+r
            let val = this.r8[D];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0x93, (addr) => {
            // SUB r Opcode: 90+r
            let val = this.r8[E];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0x94, (addr) => {
            // SUB r Opcode: 90+r
            let val = this.r8[H];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0x95, (addr) => {
            // SUB r Opcode: 90+r
            let val = this.r8[L];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstruction(0x97, (addr) => {
            // SUB r Opcode: 90+r
            let val = this.r8[A];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 4;
        });
        this.addInstructionDD(0x94, (addr) => {
            // SUB IXp Opcode: DD 90+p
            let val = this.r8[IXh];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 8;
        });
        this.addInstructionDD(0x95, (addr) => {
            // SUB IXp Opcode: DD 90+p
            let val = this.r8[IXl];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 8;
        });
        this.addInstructionFD(0x94, (addr) => {
            // SUB IYq Opcode: FD 90+q
            let val = this.r8[IYh];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 8;
        });
        this.addInstructionFD(0x95, (addr) => {
            // SUB IYq Opcode: FD 90+q
            let val = this.r8[IYl];
            this.r8[A] = this.addSub8(this.r8[A], val, true, false);
            this.cycles += 8;
        });
        this.addInstruction(0xAE, (addr) => {
            // XOR (HL) Opcode: AE
            let val = this.memory.uread8(this.r16[HL]);
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstructionDD(0xAE, (addr) => {
            // XOR (IX+o) Opcode: DD AE o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstructionFD(0xAE, (addr) => {
            // XOR (IY+o) Opcode: FD AE o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o);
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstruction(0xEE, (addr) => {
            // XOR n Opcode: EE n
            let val = this.memory.uread8(this.r16[PC]++);
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstruction(0xa8, (addr) => {
            // XOR r Opcode: A8+r
            let val = this.r8[B];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstruction(0xa9, (addr) => {
            // XOR r Opcode: A8+r
            let val = this.r8[C];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstruction(0xaa, (addr) => {
            // XOR r Opcode: A8+r
            let val = this.r8[D];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstruction(0xab, (addr) => {
            // XOR r Opcode: A8+r
            let val = this.r8[E];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstruction(0xac, (addr) => {
            // XOR r Opcode: A8+r
            let val = this.r8[H];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstruction(0xad, (addr) => {
            // XOR r Opcode: A8+r
            let val = this.r8[L];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstruction(0xaf, (addr) => {
            // XOR r Opcode: A8+r
            let val = this.r8[A];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstructionDD(0xac, (addr) => {
            // XOR IXp Opcode: DD A8+p
            let val = this.r8[IXh];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstructionDD(0xad, (addr) => {
            // XOR IXp Opcode: DD A8+p
            let val = this.r8[IXl];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstructionFD(0xac, (addr) => {
            // XOR IYq Opcode: FD A8+q
            let val = this.r8[IYh];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstructionFD(0xad, (addr) => {
            // XOR IYq Opcode: FD A8+q
            let val = this.r8[IYl];
            this.logicalOperation(val, LogicalOperation.XOR);
        });
        this.addInstructionED(0x4C, (addr) => {
            // NEG Opcode: ED 4C
            this.r8[A] = this.neg(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstructionED(0x54, (addr) => {
            // NEG Opcode: ED 54
            this.r8[A] = this.neg(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstructionED(0x5C, (addr) => {
            // NEG Opcode: ED 5C
            this.r8[A] = this.neg(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstructionED(0x64, (addr) => {
            // NEG Opcode: ED 64
            this.r8[A] = this.neg(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstructionED(0x6C, (addr) => {
            // NEG Opcode: ED 6C
            this.r8[A] = this.neg(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstructionED(0x74, (addr) => {
            // NEG Opcode: ED 74
            this.r8[A] = this.neg(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstructionED(0x7C, (addr) => {
            // NEG Opcode: ED 7C
            this.r8[A] = this.neg(this.r8[A]);
            this.cycles += 8;
        });
        this.addInstructionDD(0x24, (addr) => {
            // INC IXh Opcode: DD 24
            this.r8[IXh] = this.inc8(this.r8[IXh]);
            this.cycles += 8;
        });
        this.addInstructionDD(0x2C, (addr) => {
            // INC IXl Opcode: DD 2C
            this.r8[IXl] = this.inc8(this.r8[IXl]);
            this.cycles += 8;
        });
        this.addInstructionDD(0x25, (addr) => {
            // DEC IXh Opcode: DD 25
            this.r8[IXh] = this.dec8(this.r8[IXh]);
            this.cycles += 8;
        });
        this.addInstructionDD(0x2D, (addr) => {
            // DEC IXl Opcode: DD 2D
            this.r8[IXl] = this.dec8(this.r8[IXl]);
            this.cycles += 8;
        });
        this.addInstructionFD(0x24, (addr) => {
            // INC IYh Opcode: FD 24
            this.r8[IYh] = this.inc8(this.r8[IYh]);
            this.cycles += 8;
        });
        this.addInstructionFD(0x2C, (addr) => {
            // INC IYl Opcode: FD 2C
            this.r8[IYl] = this.inc8(this.r8[IYl]);
            this.cycles += 8;
        });
        this.addInstructionFD(0x25, (addr) => {
            // DEC IYh Opcode: FD 25
            this.r8[IYh] = this.dec8(this.r8[IYh]);
            this.cycles += 8;
        });
        this.addInstructionFD(0x2D, (addr) => {
            // DEC IYl Opcode: FD 2D
            this.r8[IYl] = this.dec8(this.r8[IYl]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x36, (addr) => {
            // SLL (HL) Opcode: CB 36
            let val = this.memory.uread8(this.r16[HL]);
            val = this.shiftLeftLogical(val);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 15;
        });
        this.addInstructionCB(0x30, (addr) => {
            // SLL r Opcode: CB 30+r
            this.r8[B] = this.shiftLeftLogical(this.r8[B]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x31, (addr) => {
            // SLL r Opcode: CB 30+r
            this.r8[C] = this.shiftLeftLogical(this.r8[C]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x32, (addr) => {
            // SLL r Opcode: CB 30+r
            this.r8[D] = this.shiftLeftLogical(this.r8[D]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x33, (addr) => {
            // SLL r Opcode: CB 30+r
            this.r8[E] = this.shiftLeftLogical(this.r8[E]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x34, (addr) => {
            // SLL r Opcode: CB 30+r
            this.r8[H] = this.shiftLeftLogical(this.r8[H]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x35, (addr) => {
            // SLL r Opcode: CB 30+r
            this.r8[L] = this.shiftLeftLogical(this.r8[L]);
            this.cycles += 8;
        });
        this.addInstructionCB(0x37, (addr) => {
            // SLL r Opcode: CB 30+r
            this.r8[A] = this.shiftLeftLogical(this.r8[A]);
            this.cycles += 8;
        });
    }
}
