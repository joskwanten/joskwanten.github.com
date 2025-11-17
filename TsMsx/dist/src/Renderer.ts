export class Renderer {
    private gl: WebGL2RenderingContext;
    private program: WebGLProgram;
    private texture: WebGLTexture;
    private vao: WebGLVertexArrayObject;
    private aspectRatioLocation: WebGLUniformLocation | null;
    private timeLocation: WebGLUniformLocation | null;

    constructor(private canvas: HTMLCanvasElement) {
        // Initialize WebGL2 context
        const gl = canvas.getContext("webgl2");
        if (!gl) throw new Error("WebGL2 not supported");
        this.gl = gl;

        // Compile shaders
        const vertexShaderSource = `#version 300 es
      in vec2 aPosition;
      out vec2 vUV;
      uniform vec2 uAspectRatio;
      uniform float uTime;
  
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
      uniform float uTime;
  
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
        if (!this.aspectRatioLocation) throw new Error("Failed to get uniform location for uAspectRatio");

        // Get uTime if defined
        this.timeLocation = gl.getUniformLocation(this.program, "uTime");

        // Setup buffers and textures
        this.vao = this.setupBuffers();
        this.texture = this.createTexture();
    }

    private compileShader(type: GLenum, source: string): WebGLShader {
        const shader = this.gl.createShader(type);
        if (!shader) throw new Error("Failed to create shader");

        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(`Shader compile error: ${error}`);
        }
        return shader;
    }

    private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
        const program = this.gl.createProgram();
        if (!program) throw new Error("Failed to create program");

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

    private setupBuffers(): WebGLVertexArrayObject {
        const vao = this.gl.createVertexArray();
        if (!vao) throw new Error("Failed to create VAO");

        const positions = new Float32Array([
            -1, -1, // Bottom-left
            1, -1, // Bottom-right
            -1, 1, // Top-left
            1, 1  // Top-right
        ]);

        const positionBuffer = this.gl.createBuffer();
        if (!positionBuffer) throw new Error("Failed to create buffer");

        this.gl.bindVertexArray(vao);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        const positionLocation = this.gl.getAttribLocation(this.program, "aPosition");
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        return vao;
    }

    private createTexture(): WebGLTexture {
        const texture = this.gl.createTexture();
        if (!texture) throw new Error("Failed to create texture");

        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

        return texture;
    }

    private calculateAspectRatio(imageWidth: number, imageHeight: number): [number, number] {
        const canvasAspect = this.canvas.width / this.canvas.height;
        const imageAspect = imageWidth / imageHeight;

        return canvasAspect > imageAspect
            ? [imageAspect / canvasAspect, 1]
            : [1, canvasAspect / imageAspect];
    }

    public render(rgbaData: Uint8Array, width: number, height: number): void {
        const gl = this.gl;
        
        gl.useProgram(this.program);
        if (this.timeLocation) {
            gl.uniform1f(this.timeLocation, performance.now() / 1000);
        }

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