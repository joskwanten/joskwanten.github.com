"use strict";
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        // Initialize WebGL2 context
        const gl = canvas.getContext("webgl2");
        if (!gl)
            throw new Error("WebGL2 not supported");
        this.gl = gl;
        // Compile shaders
        const vertexShaderSource = `#version 300 es
      in vec2 aPosition;
      out vec2 vUV;
      uniform vec2 uAspectRatio;
  
      void main() {
        vec2 scaledPosition = aPosition * uAspectRatio;
        vUV = scaledPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
      `;
        const fragmentShaderSource = `#version 300 es
      precision mediump float;
      in vec2 vUV;
      out vec4 fragColor;
      uniform sampler2D uTexture;
  
      void main() {
        vec2 flippedUV = vec2(vUV.x, 1.0 - vUV.y);
        fragColor = texture(uTexture, flippedUV);
      }
      `;
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);
        // Get uniform locations
        this.aspectRatioLocation = gl.getUniformLocation(this.program, "uAspectRatio");
        if (!this.aspectRatioLocation)
            throw new Error("Failed to get uniform location for uAspectRatio");
        // Setup buffers and textures
        this.vao = this.setupBuffers();
        this.texture = this.createTexture();
    }
    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        if (!shader)
            throw new Error("Failed to create shader");
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(`Shader compile error: ${error}`);
        }
        return shader;
    }
    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        if (!program)
            throw new Error("Failed to create program");
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(program);
            this.gl.deleteProgram(program);
            throw new Error(`Program link error: ${error}`);
        }
        return program;
    }
    setupBuffers() {
        const vao = this.gl.createVertexArray();
        if (!vao)
            throw new Error("Failed to create VAO");
        const positions = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1 // Top-right
        ]);
        const positionBuffer = this.gl.createBuffer();
        if (!positionBuffer)
            throw new Error("Failed to create buffer");
        this.gl.bindVertexArray(vao);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        const positionLocation = this.gl.getAttribLocation(this.program, "aPosition");
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
        return vao;
    }
    createTexture() {
        const texture = this.gl.createTexture();
        if (!texture)
            throw new Error("Failed to create texture");
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        return texture;
    }
    calculateAspectRatio(imageWidth, imageHeight) {
        const canvasAspect = this.canvas.width / this.canvas.height;
        const imageAspect = imageWidth / imageHeight;
        return canvasAspect > imageAspect
            ? [imageAspect / canvasAspect, 1]
            : [1, canvasAspect / imageAspect];
    }
    render(rgbaData, width, height) {
        const gl = this.gl;
        gl.useProgram(this.program);
        // Update texture with new RGBA data
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgbaData);
        // Set aspect ratio
        const aspectRatio = this.calculateAspectRatio(width, height);
        gl.uniform2fv(this.aspectRatioLocation, aspectRatio);
        // Render
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
