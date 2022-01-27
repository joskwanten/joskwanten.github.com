/*
Reg/Bit	7	    6	    5	    4	    3	    2	    1	    0
0	    -	    -	    -	    -	    -	    -	    M2	    EXTVID
1	    4/16K	BL	    GINT	M1	    M3	    -	    SI	    MAG
2	    -	    -	    -	    -	    PN13	PN12	PN11	PN10
3	    CT13	CT12	CT11	CT10	CT9	    CT8	    CT7	    CT6
4	    -	    -	    -	    -	    -	    PG13	PG12	PG11
5	    -	    SA13	SA12	SA11	SA10	SA9	    SA8	    SA7
6	    -	    -	    -	    -	    -	    SG13	SG12	SG11
7	    TC3 	TC2	    TC1	    TC0	    BD3	    BD2	    BD1	    BD0
 
Status  INT	    5S	    C   	FS4	    FS3	    FS2	    FS1	    FS0
*/

enum StatusFlags {
    S_INT = 0b10000000,
    S_5S = 0b01000000,
    S_C = 0b00100000,
    S_FS4 = 0b00010000,
    S_FS3 = 0b00001000,
    S_FS2 = 0b00000100,
    S_FS1 = 0b00000010,
    S_FS0 = 0b00000001,
};

export class TMS9918 {
    registers = new Uint8Array(8);
    vram = new Uint8Array(0x4000);
    vramAddress = 0;
    vdpStatus = 0;
    refreshRate = 60; // NTSC
    lastRefresh = 0;

    hasLatchedData = false;
    latchedData = 0;
    renderedImage = new Uint32Array(256 * 212);
    spriteDetectionBuffer = new Uint8Array(256 * 212);

    palette = [
        0x00000000,
        0x000000ff,
        0x21c842ff,
        0x5edc78ff,
        0x5455edff,
        0x7d76fcff,
        0xd4524dff,
        0x42ebf5ff,
        0xfc5554ff,
        0xff7978ff,
        0xd4c154ff,
        0xe6ce80ff,
        0x21b03bff,
        0xc95bbaff,
        0xccccccff,
        0xffffffff
    ];

    constructor(private interruptFunction: () => void, private backdropChangedFunc: (color: number) => void) {

    }

    getBlank() {
        return (this.registers[1] & 0x40) !== 0x40;
    }

    getSprintAttributeTable() {
        return (this.registers[5] & 0x7f) << 7;
    }

    getSpriteGenerationTable() {
        return (this.registers[6] & 7) << 11;
    }

    getColorTable() {
        if (this.Mode() === 2) {
            return (this.registers[3] & 0x80) << 6;
        }

        return (this.registers[3]) << 6;
    }

    getPatternGenerationTable() {
        if (this.Mode() === 2) {
            return (this.registers[4] & 4) << 11;
        }

        return (this.registers[4] & 7) << 11;
    }

    getPatternNameTable() {
        return (this.registers[2] & 0xf) << 10;
    }

    getTextColor() {
        return (this.registers[7]) >> 4;
    }

    getBackdropColor() {
        return (this.registers[7]) & 0xf;
    }

    getMagnified() {
        return (this.registers[1] & 1) !== 0;
    }

    getSixteen() {
        return (this.registers[1] & 2) !== 0;
    }

    GINT() {
        return (this.registers[1] & 0x20) != 0;
    }

    Mode() {
        let m1 = (this.registers[1] & 0x10) >> 4;
        let m3 = (this.registers[1] & 0x08) >> 1;
        let m2 = (this.registers[0] & 0x02);
        return (m3 | m2 | m1);
    }

    write(mode: boolean, value: number) {
        if (mode) {
            if (!this.hasLatchedData) {

                this.latchedData = value;
                this.hasLatchedData = true;

            } else {

                this.hasLatchedData = false;

                if (value & 0x80) {
                    // Write to register
                    let register = value & 0x7;
                    this.registers[register] = this.latchedData;

                    if (register == 7) {
                        let c = this.palette[this.getBackdropColor()];
                        this.backdropChangedFunc(c);
                    }
                } else if (value & 0x40) {
                    // Setup video write address
                    this.vramAddress = ((value & 0x3f) << 8) + this.latchedData;
                } else {
                    // Setup video read address (internally the same)
                    this.vramAddress = ((value & 0x3f) << 8) + this.latchedData;

                }
            }
        } else {
            this.hasLatchedData = false;
            // Mode = 0 means writing to video memory
            this.vram[this.vramAddress] = value;
            this.vramAddress = (this.vramAddress + 1) % 0x4000;
        }
    }

    read(mode: boolean): number {
        this.hasLatchedData = false;

        if (mode) {
            let value = this.vdpStatus;
            this.vdpStatus &= ~StatusFlags.S_INT;
            return value;
        } else {
            let value = this.vram[this.vramAddress];
            this.vramAddress = (this.vramAddress + 1) % 16384;
            return value;
        }
    }

    checkAndGenerateInterrupt(time: number) {
        //if ((time - this.lastRefresh) > this.refreshRate) {
        this.lastRefresh = time;
        this.render(this.renderedImage);

        //  IF interrupts are enabled set the S_INT flag
        if (this.GINT()) {
            this.vdpStatus |= StatusFlags.S_INT;
        }
        //}

        if (this.vdpStatus & StatusFlags.S_INT) {
            this.interruptFunction();
        }
    }

    render(image: Uint32Array) {
        let c = this.getBackdropColor();
        for (let i = 0; i < image.length; i++) {
            image[i] = this.palette[c];
        }

        if (this.getBlank()) {
            //  Blank done
        } else if (this.Mode() == 1) {
            this.renderScreen0(image);
        } else if (this.Mode() == 0) {
            this.renderScreen1(image);
            this.renderSprites(image);
        } else if (this.Mode() == 2) {
            this.renderScreen2(image);
            this.renderSprites(image);
        }
    }

    private renderScreen0(image: Uint32Array) {
        let PG = this.getPatternGenerationTable();
        let PN = this.getPatternNameTable();
        for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 40; x++) {
                let index = (y * 40) + x;
                // Get Pattern name
                let char = this.vram[PN + index];
                // Get Colors from the Color table
                let fg = this.getTextColor();
                let bg = this.getBackdropColor();
                for (let i = 0; i < 8; i++) {
                    let p = this.vram[PG + (8 * char) + i];
                    for (let j = 0; j < 6; j++) {
                        if (p & (1 << (7 - j))) {
                            image[(256 * ((y * 8) + i) + ((x * 6) + j))] = this.palette[fg];
                        } else {
                            image[(256 * ((y * 8) + i) + ((x * 6) + j))] = this.palette[bg];
                        }
                    }
                }
            }
        }
    }

    private renderScreen1(image: Uint32Array) {
        let PG = this.getPatternGenerationTable();
        let PN = this.getPatternNameTable();
        let CT = this.getColorTable();
        for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 32; x++) {
                let index = (y * 32) + x;
                // Get Pattern name
                let char = this.vram[PN + index];
                // Get Colors from the Color table
                let color = this.vram[CT + (char >>> 3)];
                let fg = color >>> 4;
                let bg = color & 0xf;
                for (let i = 0; i < 8; i++) {
                    let p = this.vram[PG + (8 * char) + i];
                    for (let j = 0; j < 8; j++) {
                        if (p & (1 << (7 - j))) {
                            image[(256 * ((y * 8) + i) + ((x * 8) + j))] = this.palette[fg];
                        } else {
                            image[(256 * ((y * 8) + i) + ((x * 8) + j))] = this.palette[bg];
                        }
                    }
                }
            }
        }
    }

    private renderScreen2(image: Uint32Array) {
        let PG = this.getPatternGenerationTable();
        let PN = this.getPatternNameTable();
        let CT = this.getColorTable();
        let mask = (this.registers[4] & 3) << 8;
        for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 32; x++) {
                let index = (y * 32) + x;
                let table = (index & mask) >> 8;
                // Get Pattern name
                let char = this.vram[PN + index];
                let offset = (table * 256 * 8) + (8 * char);
                for (let i = 0; i < 8; i++) {
                    let p = this.vram[PG + offset + i];
                    let c = this.vram[CT + offset + i];
                    let fg = c >>> 4;
                    let bg = c & 0xf;
                    let imgIndex = 256 * ((y * 8) + i) + ((x * 8));
                    image[imgIndex + 0] = p & 0x80 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 1] = p & 0x40 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 2] = p & 0x20 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 3] = p & 0x10 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 4] = p & 0x08 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 5] = p & 0x04 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 6] = p & 0x02 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 7] = p & 0x01 ? this.palette[fg] : this.palette[bg];
                }
            }
        }
    }

    private renderSprites(image: Uint32Array) {
        // Clear collision detection buffer
        for (let i = 0; i < this.spriteDetectionBuffer.length; i++) {
            this.spriteDetectionBuffer[i] = 0;
        }

        let SA = this.getSprintAttributeTable();
        let SG = this.getSpriteGenerationTable();

        for (let s = 0; s < 32; s++) {
            let y = this.vram[SA + (4 * s)];
            let x = this.vram[SA + (4 * s) + 1];
            let p = this.vram[SA + (4 * s) + 2];
            let c = this.vram[SA + (4 * s) + 3] & 0xf;
            let ec = (this.vram[SA + (4 * s) + 3] & 0x80) !== 0;

            // According to Sean Young its TMS9918 document
            // thie early clock flag will shift the x position
            // by 32 pixels
            if (ec) {
                x += 32;
            }

            if (y === 208) {
                // End of sprite attribute table
                break;
            }

            // Special meaning of the Y position
            // we use 0,0 as origin (top, left) and negative
            // values for offscreen. The TMS9918 uses line 255
            // as zero and 0 as 1, so therefore we substract 255-y
            // if value is bigger then 238 (still a line is rendered in case of 16x16)
            if (y > 238) {
                y = 0 - (255 - y);
            } else {
                y += 1;
            }

            // Get the sprite pattern
            if (this.getSixteen()) {
                for (let i = 0; i < 32; i++) {
                    let sy = (i > 7 && i < 16) || (i > 23) ? 8 : 0;
                    let sx = (i > 15) ? 8 : 0;
                    let s = this.vram[SG + (8 * (p & 0xfc)) + i];
                    for (let j = 0; j < 8; j++) {
                        if (s & (1 << (7 - j))) {
                            let ypos = y + sy + (i % 8);
                            let xpos = x + sx + j;
                            if (ypos >= 0 && ypos < 208 && xpos >= 0 && xpos <= 255) {
                                image[(256 * ypos) + xpos] = this.palette[c];
                                if (this.spriteDetectionBuffer[(256 * ypos) + xpos]) {
                                    this.vdpStatus |= StatusFlags.S_C;
                                } else {
                                    this.spriteDetectionBuffer[(256 * ypos) + xpos] = s + 1;
                                }
                            }
                        }
                    }
                }
            } else {
                for (let i = 0; i < 8; i++) {
                    let s = this.vram[SG + (8 * p) + i];
                    for (let j = 0; j < 8; j++) {
                        if (s & (1 << (7 - j))) {
                            let ypos = y + i;
                            let xpos = x + j;
                            if (ypos >= 0 && ypos < 208 && xpos >= 0 && xpos <= 255) {
                                image[(256 * ypos) + xpos] = this.palette[c];
                                if (this.spriteDetectionBuffer[(256 * ypos) + xpos]) {
                                    this.vdpStatus |= StatusFlags.S_C;
                                } else {
                                    this.spriteDetectionBuffer[(256 * ypos) + xpos] = s + 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    getImage() {
        return this.renderedImage;
    }
}