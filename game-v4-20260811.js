(() => {
  "use strict";

  const BUILD = "V4-GLOW-SYNC-20260811";

  const SHIP_URL = "https://i.postimg.cc/T2sMCYPC/spaceship.png";
  const LOGO_URL = "https://i.postimg.cc/7h9pMnYV/JIVESHOOTER.png";
  const LEVEL_URL = "https://i.postimg.cc/Bb0wrNCk/new.png";

  const gameCanvas = document.getElementById("gameCanvas");
  const fxCanvas = document.getElementById("fxCanvas");
  const ctx = gameCanvas.getContext("2d", { alpha: true });

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const waveEl = document.getElementById("wave");
  const statusEl = document.getElementById("status");
  const logoEl = document.getElementById("logo");
  const startLogoEl = document.getElementById("startLogo");
  const startPanel = document.getElementById("startPanel");
  const startButton = document.getElementById("start");
  const restartButton = document.getElementById("restart");
  const pauseButton = document.getElementById("pause");

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => Math.random() * (b - a) + a;
  const easeInOut = t => t * t * (3 - 2 * t);

  let vw = innerWidth;
  let vh = innerHeight;
  let dpr = 1;
  let last = performance.now();
  let raf = 0;

  const images = {
    ship: new Image(),
    logo: new Image(),
    level: new Image()
  };

  for (const image of Object.values(images)) {
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
  }

  function loadImage(image, url) {
    return new Promise((resolve, reject) => {
      image.onload = () => {
        const done = () => resolve(image);
        if (image.decode) image.decode().then(done).catch(done);
        else done();
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  const PALETTE = [
    [0.12, 0.92, 1.00],
    [0.72, 0.22, 1.00],
    [1.00, 0.18, 0.72],
    [1.00, 0.62, 0.12],
    [0.22, 1.00, 0.62],
    [0.32, 0.46, 1.00],
    [1.00, 0.92, 0.24],
    [0.15, 1.00, 0.90]
  ];

  const STAR_THEMES = [
    [
      "rgba(40,210,255,0)", "rgba(70,230,255,.12)",
      "rgba(220,255,255,.82)", "rgba(75,225,255,.28)",
      "rgba(30,180,255,0)", "rgba(170,250,255,.58)",
      "rgba(65,225,255,.24)", "rgba(60,190,255,0)"
    ],
    [
      "rgba(120,120,255,0)", "rgba(155,135,255,.12)",
      "rgba(255,245,255,.82)", "rgba(138,120,255,.28)",
      "rgba(95,100,255,0)", "rgba(214,205,255,.58)",
      "rgba(124,110,255,.24)", "rgba(105,96,255,0)"
    ],
    [
      "rgba(255,70,210,0)", "rgba(255,120,230,.12)",
      "rgba(255,245,255,.82)", "rgba(255,90,214,.28)",
      "rgba(255,60,170,0)", "rgba(255,200,245,.58)",
      "rgba(255,108,210,.24)", "rgba(255,80,186,0)"
    ],
    [
      "rgba(255,170,40,0)", "rgba(255,195,82,.12)",
      "rgba(255,255,240,.82)", "rgba(255,178,74,.28)",
      "rgba(255,135,40,0)", "rgba(255,238,185,.58)",
      "rgba(255,172,92,.24)", "rgba(255,146,40,0)"
    ],
    [
      "rgba(80,255,150,0)", "rgba(124,255,170,.12)",
      "rgba(245,255,250,.82)", "rgba(88,255,174,.28)",
      "rgba(55,220,140,0)", "rgba(205,255,226,.58)",
      "rgba(80,245,170,.24)", "rgba(60,214,150,0)"
    ]
  ];

  function rgba(c, a) {
    return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
  }

  function makeStarSprite(theme) {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 220;
    const g = c.getContext("2d");
    const cx = 48;
    const cy = 92;

    g.globalCompositeOperation = "lighter";

    const tail = g.createLinearGradient(cx, 0, cx, 220);
    tail.addColorStop(0, theme[0]);
    tail.addColorStop(0.18, theme[1]);
    tail.addColorStop(0.44, theme[2]);
    tail.addColorStop(0.68, theme[3]);
    tail.addColorStop(1, theme[4]);

    g.strokeStyle = tail;
    g.lineCap = "round";
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(cx, 14);
    g.lineTo(cx, 202);
    g.stroke();

    const halo = g.createRadialGradient(cx, cy, 1, cx, cy, 42);
    halo.addColorStop(0, "rgba(255,255,255,.98)");
    halo.addColorStop(0.18, theme[5]);
    halo.addColorStop(0.52, theme[6]);
    halo.addColorStop(1, theme[7]);

    g.fillStyle = halo;
    g.beginPath();
    g.arc(cx, cy, 42, 0, TAU);
    g.fill();

    g.fillStyle = "rgba(255,255,255,.92)";
    g.beginPath();
    g.arc(cx, cy, 3.2, 0, TAU);
    g.fill();

    return c;
  }

  const starSprites = STAR_THEMES.map(makeStarSprite);

  class GlowRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false
      });

      this.available = !!this.gl;
      this.maxPoints = 48;
      this.points = new Float32Array(this.maxPoints * 4);
      this.colors = new Float32Array(this.maxPoints * 3);
      this.tw = 96;
      this.th = 96;
      this.src = null;
      this.dst = null;

      if (!this.available) return;

      const gl = this.gl;
      const vs = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
          v_uv = a_position * .5 + .5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      const fs = `
        precision mediump float;
        varying vec2 v_uv;
        uniform sampler2D u_buffer;
        uniform vec2 u_resolution;
        uniform vec2 u_texel;
        uniform vec2 u_focus;
        uniform float u_time;
        uniform int u_pass;
        uniform int u_count;
        uniform vec4 u_points[${this.maxPoints}];
        uniform vec3 u_cols[${this.maxPoints}];

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        vec3 hash33(vec3 p) {
          float n = sin(dot(p, vec3(7.0, 157.0, 113.0)));
          return fract(vec3(2097152.0, 262144.0, 32768.0) * n);
        }

        float gauss(vec2 i) {
          float sigma = 2.0;
          return .03978873577 * exp(-dot(i, i) / (2.0 * sigma * sigma));
        }

        vec3 blurTex(vec2 uv) {
          vec2 t = u_texel * 1.55;
          vec3 col = texture2D(u_buffer, uv).rgb * .24;
          col += texture2D(u_buffer, uv + vec2(t.x, 0.0)).rgb * .11;
          col += texture2D(u_buffer, uv - vec2(t.x, 0.0)).rgb * .11;
          col += texture2D(u_buffer, uv + vec2(0.0, t.y)).rgb * .11;
          col += texture2D(u_buffer, uv - vec2(0.0, t.y)).rgb * .11;
          col += texture2D(u_buffer, uv + t).rgb * .08;
          col += texture2D(u_buffer, uv - t).rgb * .08;
          col += texture2D(u_buffer, uv + vec2(t.x, -t.y)).rgb * .08;
          col += texture2D(u_buffer, uv + vec2(-t.x, t.y)).rgb * .08;
          return col;
        }

        void main() {
          vec2 uv = v_uv;

          if (u_pass == 0) {
            vec2 origin = mix(vec2(.5), u_focus, .46);
            vec2 sampleUV = .982 * (uv - origin) + origin;
            sampleUV += vec2(sin((u_time + uv.y * .5) * 10.0) * .0010, -.00018);

            vec3 tex = blurTex(sampleUV) * .935;
            vec3 add = vec3(0.0);
            float asp = u_resolution.x / u_resolution.y;

            for (int i = 0; i < ${this.maxPoints}; i++) {
              if (i >= u_count) break;

              vec4 p = u_points[i];
              vec2 q = (uv - p.xy) * vec2(asp, 1.0);
              float d = length(q);
              float r = max(p.z, .001);
              float core = smoothstep(r, 0.0, d);
              float halo = smoothstep(r * 3.7, 0.0, d) * .22;
              float ring = smoothstep(r * .36, 0.0, abs(d - r * 1.42)) * .075;
              float pulse = .90 + .10 * sin(u_time * 9.0 + float(i) * 1.73);
              vec3 c = u_cols[i];

              add += c * (core * 1.18 + halo + ring) * p.w * pulse;
              add += vec3(1.0) * pow(core, 5.0) * .38 * p.w;
            }

            tex += add;
            gl_FragColor = vec4(tex, 1.0);
          } else {
            vec3 tex = texture2D(u_buffer, uv).rgb;
            vec3 n = hash33(vec3(uv * vec2(340.0, 220.0), u_time * .12));
            tex += n * .09 - .045;

            vec3 cut = vec3(
              smoothstep(.06, .54, tex.r),
              smoothstep(.12, .50, tex.g),
              smoothstep(.02, .46, tex.b)
            );

            vec3 col = tex * 1.06 + cut * .58;
            col = pow(max(col, 0.0), vec3(.84));
            float a = clamp(max(max(col.r, col.g), col.b) * 1.05, 0.0, 1.0);
            gl_FragColor = vec4(col, a);
          }
        }
      `;

      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
        }
        return shader;
      };

      this.program = gl.createProgram();
      gl.attachShader(this.program, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(this.program);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(this.program) || "Shader link failed");
      }

      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      this.loc = {
        pos: gl.getAttribLocation(this.program, "a_position"),
        buf: gl.getUniformLocation(this.program, "u_buffer"),
        res: gl.getUniformLocation(this.program, "u_resolution"),
        tex: gl.getUniformLocation(this.program, "u_texel"),
        focus: gl.getUniformLocation(this.program, "u_focus"),
        time: gl.getUniformLocation(this.program, "u_time"),
        pass: gl.getUniformLocation(this.program, "u_pass"),
        count: gl.getUniformLocation(this.program, "u_count"),
        points: gl.getUniformLocation(this.program, "u_points[0]"),
        cols: gl.getUniformLocation(this.program, "u_cols[0]")
      };

      gl.useProgram(this.program);
      gl.enableVertexAttribArray(this.loc.pos);
      gl.vertexAttribPointer(this.loc.pos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(this.loc.buf, 0);
    }

    makeTarget(width, height) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo };
    }

    resize(width, height, pixelRatio) {
      if (!this.available) return;

      const gl = this.gl;
      this.canvas.width = Math.max(2, Math.floor(width * pixelRatio));
      this.canvas.height = Math.max(2, Math.floor(height * pixelRatio));
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;

      this.tw = Math.max(96, Math.floor(width * pixelRatio * .24));
      this.th = Math.max(96, Math.floor(height * pixelRatio * .24));

      if (this.src) {
        gl.deleteTexture(this.src.tex);
        gl.deleteFramebuffer(this.src.fbo);
      }
      if (this.dst) {
        gl.deleteTexture(this.dst.tex);
        gl.deleteFramebuffer(this.dst.fbo);
      }

      this.src = this.makeTarget(this.tw, this.th);
      this.dst = this.makeTarget(this.tw, this.th);
      this.clear();
    }

    clear() {
      if (!this.available || !this.src || !this.dst) return;
      const gl = this.gl;
      for (const target of [this.src, this.dst]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, this.tw, this.th);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    render(points, focus, now) {
      if (!this.available || !this.src || !this.dst) return;

      const gl = this.gl;
      let n = 0;

      for (const p of points) {
        if (n >= this.maxPoints) break;
        this.points[n * 4] = p.x / vw;
        this.points[n * 4 + 1] = 1 - p.y / vh;
        this.points[n * 4 + 2] = p.r / vh;
        this.points[n * 4 + 3] = p.intensity;

        this.colors[n * 3] = p.color[0];
        this.colors[n * 3 + 1] = p.color[1];
        this.colors[n * 3 + 2] = p.color[2];
        n++;
      }

      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.vertexAttribPointer(this.loc.pos, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.BLEND);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.dst.fbo);
      gl.viewport(0, 0, this.tw, this.th);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.src.tex);

      gl.uniform2f(this.loc.res, this.tw, this.th);
      gl.uniform2f(this.loc.tex, 1 / this.tw, 1 / this.th);
      gl.uniform2f(this.loc.focus, focus.x / vw, 1 - focus.y / vh);
      gl.uniform1f(this.loc.time, now * .001);
      gl.uniform1i(this.loc.pass, 0);
      gl.uniform1i(this.loc.count, n);
      gl.uniform4fv(this.loc.points, this.points);
      gl.uniform3fv(this.loc.cols, this.colors);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      const tmp = this.src;
      this.src = this.dst;
      this.dst = tmp;

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.src.tex);
      gl.uniform2f(this.loc.res, this.canvas.width, this.canvas.height);
      gl.uniform2f(this.loc.tex, 1 / this.tw, 1 / this.th);
      gl.uniform1i(this.loc.pass, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.BLEND);
    }
  }

  const glow = new GlowRenderer(fxCanvas);

  const keys = new Set();
  const pointer = {
    active: false,
    x: 0,
    shoot: false
  };

  const state = {
    running: false,
    paused: true,
    gameOver: false,
    score: 0,
    lives: 5,
    wave: 1,
    invulnerable: 0,
    shootCooldown: 0,
    formationTime: 0,
    attackCycle: 0,
    diveTimer: 1.2,
    enemyShotTimer: 1.5,
    waveFlash: 0,
    waveDelay: 0,
    screenShake: 0
  };

  const player = {
    x: vw / 2,
    y: vh - 95,
    r: 21,
    speed: 445
  };

  const bullets = [];
  const enemyBullets = [];
  const enemies = [];
  const particles = [];
  const blasts = [];
  const stars = [];

  function addParticle(x, y, vx, vy, life, size, color) {
    particles.push({ x, y, vx, vy, life, maxLife: life, size, color });
  }

  function explode(x, y, color, big = false) {
    blasts.push({
      x,
      y,
      life: big ? .88 : .56,
      maxLife: big ? .88 : .56,
      radius: big ? 76 : 44,
      color,
      big
    });

    const count = big ? 72 : 34;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const speed = rand(big ? 130 : 75, big ? 470 : 280);
      addParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        rand(.45, big ? 1.28 : .84),
        rand(big ? 3.2 : 1.6, big ? 10 : 5.8),
        color
      );
    }

    state.screenShake = Math.max(state.screenShake, big ? .24 : .10);
  }

  function createStars() {
    stars.length = 0;
    const count = Math.round(clamp(vw * vh / 11500, 62, 105));
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * vw,
        y: Math.random() * vh,
        size: Math.random() * 1.75 + .72,
        speed: Math.random() * 145 + 85,
        alpha: Math.random() * .38 + .58,
        seed: Math.random() * 7
      });
    }
  }

  class Enemy {
    constructor(row, col, cols, index) {
      this.row = row;
      this.col = col;
      this.cols = cols;
      this.index = index;
      this.alive = true;
      this.mode = "enter";
      this.entryDelay = Math.floor(index / 5) * .14 + row * .02;
      this.entryT = 0;
      this.returnT = 0;
      this.diveT = 0;
      this.diveDuration = 1.28;
      this.seed = Math.random() * 20;
      this.color = PALETTE[(row * 2 + col + state.wave - 1) % PALETTE.length];
      this.type = row === 0 ? "boss" : (row === 1 ? "wing" : "drone");
      this.hp = this.type === "boss" ? 2 : 1;
      this.radius = this.type === "boss" ? 12.5 : this.type === "wing" ? 10.5 : 9.5;
      this.x = vw / 2;
      this.y = -80;
      this.angle = 0;
      this.diveStart = { x: 0, y: 0 };
      this.diveTarget = { x: 0, y: 0 };
      this.shotLatch = false;
      this.value = this.type === "boss" ? 300 : this.type === "wing" ? 150 : 90;
    }

    slotPosition(now) {
      const horizontalSpacing = clamp(vw / 9.4, 62, 92);
      const verticalSpacing = clamp(vh / 12.8, 54, 68);
      const width = horizontalSpacing * (this.cols - 1);

      const sweep = Math.sin(state.formationTime * 2.45) * Math.min(68, Math.max(26, (vw - width - 90) * .30));
      const bob = Math.sin(state.formationTime * 4.90) * 2.2;
      const x = vw / 2 - width / 2 + this.col * horizontalSpacing + sweep;
      const y = clamp(116 + this.row * verticalSpacing, 100, vh * .39) + bob;
      return { x, y };
    }

    update(dt, now) {
      if (!this.alive) return;

      if (this.mode === "enter") {
        if (this.entryDelay > 0) {
          this.entryDelay -= dt;
          return;
        }

        this.entryT += dt * (1.32 + Math.min(.38, state.wave * .018));
        const t = clamp(this.entryT, 0, 1);
        const e = easeInOut(t);
        const slot = this.slotPosition(now);

        const group = Math.floor(this.index / 5);
        const lane = this.index % 5;
        const side = group % 2 === 0 ? -1 : 1;
        const startX = vw / 2 + side * Math.min(vw * .34, 290) + (lane - 2) * 20;
        const startY = -55 - lane * 12;
        const controlX = vw / 2 - side * Math.min(125, vw * .14);
        const controlY = clamp(vh * .18, 88, 150);

        const omt = 1 - e;
        this.x = omt * omt * startX + 2 * omt * e * controlX + e * e * slot.x;
        this.y = omt * omt * startY + 2 * omt * e * controlY + e * e * slot.y;
        this.angle = Math.sin(t * Math.PI) * side * 1.55;

        if (t >= 1) {
          this.mode = "formation";
          this.x = slot.x;
          this.y = slot.y;
          this.angle = 0;
        }
        return;
      }

      if (this.mode === "formation") {
        const slot = this.slotPosition(now);
        this.x = lerp(this.x, slot.x, 1 - Math.pow(.00005, dt));
        this.y = lerp(this.y, slot.y, 1 - Math.pow(.00005, dt));
        this.angle = Math.sin(now * .0025 + this.seed) * .08;
        return;
      }

      if (this.mode === "dive") {
        if (this.diveT < 0) {
          this.diveT += dt;
          return;
        }
        this.diveT += dt / this.diveDuration;
        const t = this.diveT;
        const side = this.diveTarget.x < this.diveStart.x ? -1 : 1;

        if (t <= 1) {
          const p = clamp(t, 0, 1);
          const omt = 1 - p;

          const c1x = this.diveStart.x + side * 118;
          const c1y = this.diveStart.y + 82;
          const c2x = this.diveTarget.x - side * 104;
          const c2y = vh * .62;

          this.x =
            omt * omt * omt * this.diveStart.x +
            3 * omt * omt * p * c1x +
            3 * omt * p * p * c2x +
            p * p * p * this.diveTarget.x;

          this.y =
            omt * omt * omt * this.diveStart.y +
            3 * omt * omt * p * c1y +
            3 * omt * p * p * c2y +
            p * p * p * this.diveTarget.y;

          const dx =
            3 * omt * omt * (c1x - this.diveStart.x) +
            6 * omt * p * (c2x - c1x) +
            3 * p * p * (this.diveTarget.x - c2x);

          const dy =
            3 * omt * omt * (c1y - this.diveStart.y) +
            6 * omt * p * (c2y - c1y) +
            3 * p * p * (this.diveTarget.y - c2y);

          this.angle = Math.atan2(dy, dx) + Math.PI / 2;

          if (!this.shotLatch && p > .42) {
            this.shotLatch = true;
            fireEnemyBullet(this, true);
          }
        } else {
          this.mode = "return";
          this.returnT = 0;
          this.x = clamp(this.x, 30, vw - 30);
          this.y = -65;
          this.angle = Math.PI;
        }
        return;
      }

      if (this.mode === "return") {
        this.returnT += dt * 1.25;
        const t = clamp(this.returnT, 0, 1);
        const e = easeInOut(t);
        const slot = this.slotPosition(now);

        const startX = this.x;
        const cX = vw / 2 + Math.sin(this.seed) * vw * .2;
        const cY = vh * .24;

        const omt = 1 - e;
        this.x = omt * omt * startX + 2 * omt * e * cX + e * e * slot.x;
        this.y = omt * omt * -65 + 2 * omt * e * cY + e * e * slot.y;
        this.angle = (1 - e) * Math.PI;

        if (t >= 1) {
          this.mode = "formation";
          this.shotLatch = false;
          this.angle = 0;
        }
      }
    }

    startDive(delay = 0, targetOffset = 0) {
      if (!this.alive || this.mode !== "formation") return false;
      this.mode = "dive";
      this.diveT = -delay;
      this.diveDuration = Math.max(.92, 1.22 - state.wave * .014);
      this.diveStart = { x: this.x, y: this.y };
      const side = this.x < vw * .5 ? -1 : 1;
      this.diveTarget = {
        x: clamp(player.x + side * 44 + targetOffset, 34, vw - 34),
        y: vh + 64
      };
      this.shotLatch = false;
      return true;
    }

    damage() {
      this.hp--;
      if (this.hp <= 0) {
        this.alive = false;
        state.score += this.value + (this.mode === "dive" ? 80 : 0);
        explode(this.x, this.y, this.color, this.type === "boss");
        updateHud();
        return true;
      }

      explode(this.x, this.y, this.color, false);
      return false;
    }
  }

  function spawnWave() {
    enemies.length = 0;
    enemyBullets.length = 0;
    bullets.length = 0;

    const cols = 5;
    const rows = 2;
    let index = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const enemy = new Enemy(row, col, cols, index++);
        enemies.push(enemy);
      }
    }

    state.formationTime = 0;
    state.attackCycle = 0;
    state.diveTimer = Math.max(.68, 1.18 - state.wave * .018);
    state.enemyShotTimer = 1.2;
    state.waveDelay = 0;
    state.waveFlash = 1.55;
    glow.clear();
    updateHud();
  }

  function firePlayerBullet() {
    const active = bullets.filter(b => b.alive).length;
    if (active >= 2 || state.shootCooldown > 0 || state.paused || state.gameOver) return;

    bullets.push({
      x: player.x,
      y: player.y - 46,
      vx: 0,
      vy: -760,
      r: 5,
      alive: true,
      color: [0.72, 1.0, 1.0]
    });

    state.shootCooldown = .16;
  }

  function fireEnemyBullet(enemy, aimed = false) {
    if (!enemy || !enemy.alive || enemyBullets.length > 3 + Math.min(2, state.wave)) return;

    let angle;
    if (aimed) {
      angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    } else {
      angle = Math.PI / 2 + rand(-.20, .20);
    }

    const speed = 205 + state.wave * 8;
    enemyBullets.push({
      x: enemy.x,
      y: enemy.y + enemy.radius * .7,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 6,
      alive: true,
      color: enemy.color
    });
  }

  function pickDiver() {
    const ready = enemies.filter(e => e.alive && e.mode === "formation" && e.row <= 1);
    if (!ready.length) return;

    state.attackCycle++;
    const sideLeft = state.attackCycle % 2 === 1;
    const preferred = sideLeft ? 0 : 4;

    ready.sort((a, b) => {
      const da = Math.abs(a.col - preferred) + a.row * .22;
      const db = Math.abs(b.col - preferred) + b.row * .22;
      return da - db;
    });

    const squadSize = state.wave >= 5 ? 2 : 1;
    const squad = ready.slice(0, Math.min(squadSize, ready.length));
    const mid = (squad.length - 1) * .5;

    squad.forEach((enemy, i) => {
      enemy.startDive(i * .075, (i - mid) * 34);
    });
  }

  function updateHud() {
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives;
    waveEl.textContent = state.wave;
    pauseButton.textContent = state.paused && state.running && !state.gameOver ? "Resume" : "Pause";
  }

  function hitPlayer() {
    if (state.invulnerable > 0 || state.gameOver) return;

    state.lives--;
    state.invulnerable = 1.65;
    explode(player.x, player.y, [0.1, 0.9, 1.0], true);
    updateHud();

    if (state.lives <= 0) {
      state.lives = 0;
      state.gameOver = true;
      state.paused = true;
      statusEl.textContent = `GAME OVER. Final score: ${state.score}`;
      updateHud();
    }
  }

  function circleHit(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const rr = ar + br;
    return dx * dx + dy * dy < rr * rr;
  }

  function updatePlayer(dt) {
    let dir = 0;
    if (keys.has("arrowleft") || keys.has("a")) dir--;
    if (keys.has("arrowright") || keys.has("d")) dir++;

    if (dir) player.x += dir * player.speed * dt;

    if (pointer.active) {
      const dx = pointer.x - player.x;
      player.x += dx * Math.min(1, dt * 9);
    }

    player.x = clamp(player.x, 38, vw - 38);

    if (keys.has(" ") || keys.has("space") || pointer.shoot) {
      firePlayerBullet();
    }
  }

  function updateGameplay(dt, now) {
    state.shootCooldown -= dt;
    state.invulnerable -= dt;
    state.formationTime += dt;
    state.diveTimer -= dt;
    state.enemyShotTimer -= dt;
    state.waveFlash -= dt;
    state.screenShake -= dt;

    updatePlayer(dt);

    for (const star of stars) {
      star.y += star.speed * dt;
      if (star.y > vh + 38) {
        star.y = -38;
        star.x = Math.random() * vw;
        star.size = Math.random() * 1.75 + .72;
        star.speed = Math.random() * 145 + 85;
        star.alpha = Math.random() * .38 + .58;
        star.seed = Math.random() * 7;
      }
    }

    for (const enemy of enemies) enemy.update(dt, now);

    if (state.diveTimer <= 0) {
      pickDiver();
      state.diveTimer = Math.max(.64, 1.24 - state.wave * .018);
    }

    if (state.enemyShotTimer <= 0) {
      const shooters = enemies.filter(e => e.alive && e.mode === "formation" && e.y < vh * .58);
      if (shooters.length) fireEnemyBullet(shooters[(Math.random() * shooters.length) | 0], false);
      state.enemyShotTimer = Math.max(.72, 1.48 - state.wave * .028);
    }

    for (const bullet of bullets) {
      if (!bullet.alive) continue;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.y < -30) bullet.alive = false;

      for (const enemy of enemies) {
        if (!enemy.alive || enemy.entryDelay > 0) continue;
        if (circleHit(bullet.x, bullet.y, bullet.r, enemy.x, enemy.y, enemy.radius)) {
          bullet.alive = false;
          enemy.damage();
          break;
        }
      }
    }

    for (const bullet of enemyBullets) {
      if (!bullet.alive) continue;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      if (bullet.y > vh + 40 || bullet.x < -40 || bullet.x > vw + 40) {
        bullet.alive = false;
        continue;
      }

      if (circleHit(bullet.x, bullet.y, bullet.r, player.x, player.y, player.r)) {
        bullet.alive = false;
        hitPlayer();
      }
    }

    for (const enemy of enemies) {
      if (!enemy.alive || enemy.entryDelay > 0) continue;
      if (circleHit(enemy.x, enemy.y, enemy.radius * .82, player.x, player.y, player.r)) {
        enemy.alive = false;
        explode(enemy.x, enemy.y, enemy.color, enemy.type === "boss");
        hitPlayer();
      }
    }

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(.955, dt * 60);
      p.vy *= Math.pow(.955, dt * 60);
      p.life -= dt;
    }

    for (const blast of blasts) blast.life -= dt;

    for (let i = bullets.length - 1; i >= 0; i--) {
      if (!bullets[i].alive) bullets.splice(i, 1);
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      if (!enemyBullets[i].alive) enemyBullets.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    for (let i = blasts.length - 1; i >= 0; i--) {
      if (blasts[i].life <= 0) blasts.splice(i, 1);
    }

    const living = enemies.some(e => e.alive);

    if (!living && !state.gameOver) {
      if (state.waveDelay <= 0) {
        state.waveDelay = 1.35;
        state.waveFlash = 1.55;
      } else {
        state.waveDelay -= dt;
        if (state.waveDelay <= 0) {
          state.wave++;
          spawnWave();
        }
      }
    }
  }

  function drawBackground(now) {
    const gradient = ctx.createLinearGradient(0, 0, 0, vh);
    gradient.addColorStop(0, "rgba(0,4,14,.90)");
    gradient.addColorStop(.55, "rgba(0,0,0,.88)");
    gradient.addColorStop(1, "rgba(0,0,0,.94)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, vw, vh);

    const starSprite = starSprites[(Math.max(1, state.wave) - 1) % starSprites.length];

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const star of stars) {
      const pulse = star.alpha * (.86 + .14 * Math.sin(now * .006 + star.seed));
      const len = star.speed * .115 + star.size * 12;
      const width = 12 + star.size * 12;

      ctx.globalAlpha = .78 * pulse;
      ctx.drawImage(starSprite, star.x - width * .5, star.y - len * .43, width, len * 1.72);

      ctx.globalAlpha = .36 * pulse;
      ctx.drawImage(starSprite, star.x - width, star.y - len * .58, width * 2, len * 2.05);
    }

    ctx.restore();
  }

  function drawPlayer(now) {
    const flicker = state.invulnerable > 0 && Math.sin(now / 55) > 0;
    if (flicker) ctx.globalAlpha = .34;

    ctx.save();
    ctx.translate(player.x, player.y);

    ctx.globalCompositeOperation = "lighter";

    ctx.fillStyle = "#ffdf70";
    ctx.beginPath();
    ctx.moveTo(-10, 34);
    ctx.lineTo(0, 58 + Math.random() * 8);
    ctx.lineTo(10, 34);
    ctx.fill();

    ctx.fillStyle = "#ff8a3d";
    ctx.beginPath();
    ctx.moveTo(-5, 34);
    ctx.lineTo(0, 48 + Math.random() * 5);
    ctx.lineTo(5, 34);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";

    if (images.ship.complete && images.ship.naturalWidth) {
      const bw = 92;
      const bh = 112;
      const scale = Math.min(bw / images.ship.naturalWidth, bh / images.ship.naturalHeight);
      const dw = images.ship.naturalWidth * scale;
      const dh = images.ship.naturalHeight * scale;
      ctx.drawImage(images.ship, -dw / 2, -dh / 2 - 7, dw, dh);
    }

    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.globalAlpha = .14 + .08 * Math.sin(now / 140);
    ctx.strokeStyle = "rgba(200,255,255,.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 7, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(enemy, now) {
    if (!enemy.alive || enemy.entryDelay > 0 || glow.available) return;

    const c = enemy.color;
    const pulse = .88 + .12 * Math.sin(now * .009 + enemy.seed);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const halo = ctx.createRadialGradient(
      enemy.x, enemy.y, 1,
      enemy.x, enemy.y, enemy.radius * 2.8
    );
    halo.addColorStop(0, "rgba(255,255,255,.98)");
    halo.addColorStop(.18, rgba(c, .92 * pulse));
    halo.addColorStop(.52, rgba(c, .30 * pulse));
    halo.addColorStop(1, rgba(c, 0));

    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius * 2.8, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.type === "boss" ? 4.8 : 3.1, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const b of bullets) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = "rgba(90,235,255,.95)";
      ctx.fillStyle = "rgba(220,255,255,.98)";
      ctx.fillRect(b.x - 2.4, b.y - 14, 4.8, 24);

      ctx.fillStyle = "rgba(40,190,255,.45)";
      ctx.fillRect(b.x - 4.5, b.y + 4, 9, 24);
    }

    for (const b of enemyBullets) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = rgba(b.color, .95);
      ctx.fillStyle = rgba(b.color, .90);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,.88)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.1, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawExplosions() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const blast of blasts) {
      const k = Math.max(0, blast.life / blast.maxLife);
      const radius = blast.radius * (1 - k) + 8;

      ctx.globalAlpha = .42 * k;
      ctx.fillStyle = rgba(blast.color, .18 * k);
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, radius * .45, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = .88 * k;
      ctx.strokeStyle = rgba(blast.color, .72 * k);
      ctx.lineWidth = blast.big ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, radius, 0, TAU);
      ctx.stroke();

      ctx.globalAlpha = .34 * k;
      ctx.strokeStyle = `rgba(255,255,255,${.72 * k})`;
      ctx.lineWidth = blast.big ? 2 : 1.4;
      ctx.beginPath();
      ctx.arc(blast.x, blast.y, radius * .55, 0, TAU);
      ctx.stroke();
    }

    for (const p of particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = rgba(p.color, .95 * alpha);
      ctx.shadowColor = rgba(p.color, .95);
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.4, p.size * alpha), 0, TAU);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawWaveOverlay(now) {
    if (state.waveFlash <= 0 || state.gameOver) return;

    const k = Math.min(1, state.waveFlash / .9);
    const pulse = 1 + .05 * Math.sin(now / 90);
    const alpha = Math.min(1, state.waveFlash / .18) * Math.min(1, k * 1.25);

    if (images.level.complete && images.level.naturalWidth) {
      const iw = images.level.naturalWidth;
      const ih = images.level.naturalHeight;
      const ww = Math.min(vw * .52, 390) * pulse;
      const hh = ww * ih / iw;
      const x = vw * .5 - ww * .5;
      const y = vh * .34 - hh * .5;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = .26 * alpha;
      ctx.filter = "blur(16px)";
      ctx.drawImage(images.level, x, y, ww, hh);

      ctx.filter = "none";
      ctx.globalAlpha = .98 * alpha;
      ctx.drawImage(images.level, x, y, ww, hh);
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.textAlign = "center";
    ctx.font = "700 18px Courier New";
    ctx.fillStyle = `rgba(190,252,255,${.88 * alpha})`;
    ctx.shadowColor = "rgba(0,235,255,.9)";
    ctx.shadowBlur = 14;
    ctx.fillText(`WAVE ${state.wave}`, vw / 2, vh * .34 + 58);
    ctx.restore();
  }

  function drawPause() {
    if (!state.running || (!state.paused && !state.gameOver)) return;

    ctx.fillStyle = "rgba(0,0,0,.56)";
    ctx.fillRect(0, 0, vw, vh);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 34px Courier New";
    ctx.fillText(state.gameOver ? "GAME OVER" : "PAUSED", vw / 2, vh / 2 - 46);

    ctx.font = "16px Courier New";
    ctx.fillText(
      state.gameOver ? "Press R or tap Restart to play again." : "Press P to continue.",
      vw / 2,
      vh / 2 - 8
    );

    if (state.gameOver) {
      ctx.font = "14px Courier New";
      ctx.fillText(`Final score: ${state.score}`, vw / 2, vh / 2 + 22);
    }
  }

  function collectGlowPoints() {
    const points = [];

    for (const enemy of enemies) {
      if (!enemy.alive || enemy.entryDelay > 0) continue;
      points.push({
        x: enemy.x,
        y: enemy.y,
        r: enemy.radius * (enemy.type === "boss" ? .92 : .78),
        intensity: enemy.type === "boss" ? 1.08 : .84,
        color: enemy.color
      });

      points.push({
        x: enemy.x + Math.sin(performance.now() / 330 + enemy.seed) * enemy.radius * .42,
        y: enemy.y + Math.cos(performance.now() / 410 + enemy.seed) * enemy.radius * .24,
        r: enemy.radius * .34,
        intensity: .38,
        color: enemy.color
      });
    }

    for (const b of bullets) {
      points.push({ x: b.x, y: b.y, r: 4.7, intensity: 1.24, color: b.color });
      points.push({ x: b.x, y: b.y + 14, r: 3.4, intensity: .46, color: [0.18, .8, 1] });
    }

    for (const b of enemyBullets) {
      points.push({ x: b.x, y: b.y, r: 5.5, intensity: .92, color: b.color });
    }

    for (const blast of blasts) {
      const k = Math.max(0, blast.life / blast.maxLife);
      points.push({
        x: blast.x,
        y: blast.y,
        r: (blast.big ? 22 : 14) * (1.1 - k * .1),
        intensity: 1.55 * k,
        color: blast.color
      });
      points.push({
        x: blast.x,
        y: blast.y,
        r: (blast.big ? 10 : 6),
        intensity: 1.9 * k,
        color: [1, 1, 1]
      });
    }

    for (const p of particles) {
      points.push({
        x: p.x,
        y: p.y,
        r: Math.max(1.6, p.size),
        intensity: Math.max(0, p.life * .82),
        color: p.color
      });
      if (points.length >= 88) break;
    }

    points.push({
      x: player.x,
      y: player.y + 40,
      r: 7.4,
      intensity: .78,
      color: [1, .45, .08]
    });

    return points;
  }

  function render(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let shakeX = 0;
    let shakeY = 0;
    if (state.screenShake > 0) {
      const amt = 6 * clamp(state.screenShake / .24, 0, 1);
      shakeX = rand(-amt, amt);
      shakeY = rand(-amt, amt);
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground(now);
    for (const enemy of enemies) drawEnemy(enemy, now);
    drawBullets();
    drawExplosions();
    drawPlayer(now);
    drawWaveOverlay(now);

    ctx.restore();

    drawPause();

    glow.render(collectGlowPoints(), player, now);
  }

  function loop(now) {
    const dt = Math.min(.033, Math.max(0, (now - last) / 1000));
    last = now;

    if (state.running && !state.paused && !state.gameOver) {
      updateGameplay(dt, now);
    } else {
      for (const star of stars) {
        star.y += star.speed * dt * .22;
        if (star.y > vh + 38) {
          star.y = -38;
          star.x = Math.random() * vw;
        }
      }
    }

    render(now);
    raf = requestAnimationFrame(loop);
  }

  function resetGame() {
    state.score = 0;
    state.lives = 5;
    state.wave = 1;
    state.gameOver = false;
    state.paused = false;
    state.running = true;
    state.invulnerable = 1.25;
    state.shootCooldown = 0;
    state.screenShake = 0;

    player.x = vw / 2;
    player.y = vh - 95;

    bullets.length = 0;
    enemyBullets.length = 0;
    particles.length = 0;
    blasts.length = 0;

    spawnWave();
    statusEl.textContent = `${BUILD} · Formation online · 10 glow enemies`;
    startPanel.classList.add("hidden");
    updateHud();
  }

  function togglePause() {
    if (!state.running || state.gameOver) return;
    state.paused = !state.paused;
    statusEl.textContent = state.paused ? `${BUILD} · Paused` : `${BUILD} · Formation online · 10 glow enemies`;
    updateHud();
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    vw = innerWidth;
    vh = innerHeight;

    gameCanvas.width = Math.max(2, Math.floor(vw * dpr));
    gameCanvas.height = Math.max(2, Math.floor(vh * dpr));
    gameCanvas.style.width = `${vw}px`;
    gameCanvas.style.height = `${vh}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    player.x = clamp(player.x, 38, vw - 38);
    player.y = vh - 95;

    createStars();
    glow.resize(vw, vh, dpr);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();

    if (["arrowleft", "arrowright", " ", "p", "r", "a", "d"].includes(key) || event.code === "Space") {
      event.preventDefault();
    }

    if (!event.repeat && key === "p") togglePause();
    if (!event.repeat && key === "r") resetGame();

    if (event.code === "Space") {
      keys.add("space");
      firePlayerBullet();
    }

    keys.add(key);
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
    if (event.code === "Space") keys.delete("space");
  }

  function onPointerDown(event) {
    event.preventDefault();
    pointer.active = true;
    pointer.shoot = true;
    pointer.x = event.clientX;
    gameCanvas.setPointerCapture?.(event.pointerId);
    firePlayerBullet();
  }

  function onPointerMove(event) {
    if (!pointer.active) return;
    event.preventDefault();
    pointer.x = event.clientX;
  }

  function onPointerUp(event) {
    event.preventDefault();
    pointer.active = false;
    pointer.shoot = false;
  }

  startButton.addEventListener("click", resetGame);
  restartButton.addEventListener("click", resetGame);
  pauseButton.addEventListener("click", togglePause);

  addEventListener("resize", resize);
  addEventListener("keydown", onKeyDown, { capture: true });
  addEventListener("keyup", onKeyUp, { capture: true });

  gameCanvas.addEventListener("pointerdown", onPointerDown);
  gameCanvas.addEventListener("pointermove", onPointerMove);
  gameCanvas.addEventListener("pointerup", onPointerUp);
  gameCanvas.addEventListener("pointercancel", onPointerUp);

  async function boot() {
    resize();
    updateHud();

    logoEl.src = LOGO_URL;
    startLogoEl.src = LOGO_URL;

    const results = await Promise.allSettled([
      loadImage(images.ship, SHIP_URL),
      loadImage(images.logo, LOGO_URL),
      loadImage(images.level, LEVEL_URL)
    ]);

    const shipReady = results[0].status === "fulfilled";
    const logoReady = results[1].status === "fulfilled";
    const levelReady = results[2].status === "fulfilled";

    if (!shipReady) {
      statusEl.textContent = "Player ship image could not load.";
    } else if (!logoReady) {
      statusEl.textContent = "Logo image could not load.";
    } else {
      statusEl.textContent = levelReady
        ? `${BUILD} · Ready · 10 glow enemies`
        : `${BUILD} · Ready · level overlay unavailable`;
    }

    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  boot().catch(error => {
    console.error(error);
    statusEl.textContent = `JIVESHOOTER error: ${error.message || error}`;
  });
})();
