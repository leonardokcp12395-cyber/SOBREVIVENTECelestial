    // Variável de depuração global
    const DEBUG_MODE = false; // Altere para true para ver logs no console

    // Variáveis globais que serão inicializadas dentro de window.onload ou initGame
    let player;
    let platforms = []; // Nova variável para todas as plataformas
    let enemies = [];
    let activeVortexes = [];
    let powerUps = [];
    let activeStaticFields = []; // Novo array para campos estáticos
    let activeDamageNumbers = [];
    // ALTERAÇÃO 4b: Partículas de Ambiente
    let ambientParticles = []; 

    // Pools de objetos declarados aqui para que possam ser acessados globalmente,
    // mas inicializados dentro de initGame() para garantir que as classes já foram definidas.
    let particlePool;
    let projectilePool;
    let enemyProjectilePool;
    let xpOrbPool;
    let damageNumberPool;
    let qtree; // Variável global para o Quadtree

    // Variável para calcular o tempo decorrido entre frames
    let lastFrameTime = 0; // Inicializado para 0 para o primeiro deltaTime

    // Contexto do canvas e container do jogo
    let canvas;
    let ctx;
    let gameContainer;

    // Variáveis para o sistema de ondas
    let waveNumber = 0;
    let waveEnemiesRemaining = 0;
    let waveCooldownTimer = 0; // Tempo entre ondas
    let currentWaveConfig = {};
    let enemySpawnTimer = 0; // Mover para escopo global

    // --- MELHORIAS PERMANENTES ---
    const PERMANENT_UPGRADES = {
        'max_health': { name: "Vitalidade", icon: "❤️", levels: [
            { cost: 10, effect: 10 }, { cost: 25, effect: 20 }, { cost: 50, effect: 30 }
        ], desc: (val) => `+${val} Vida Máxima`},
        'damage_boost': { name: "Poder", icon: "💥", levels: [
            { cost: 20, effect: 0.05 }, { cost: 50, effect: 0.10 }, { cost: 100, effect: 0.15 }
        ], desc: (val) => `+${Math.round(val*100)}% Dano`},
        'xp_gain': { name: "Sabedoria", icon: "⭐", levels: [
            { cost: 15, effect: 0.1 }, { cost: 40, effect: 0.2 }, { cost: 80, effect: 0.3 }
        ], desc: (val) => `+${Math.round(val*100)}% Ganho de XP`}
    };
    let playerGems = 0;
    let playerUpgrades = {};

    function loadPermanentData() {
        playerGems = parseInt(localStorage.getItem('playerGems') || '0');
        playerUpgrades = JSON.parse(localStorage.getItem('playerUpgrades') || '{}');
        // Inicializa se não existir
        for(const key in PERMANENT_UPGRADES) {
            if (playerUpgrades[key] === undefined || playerUpgrades[key] === null) {
                playerUpgrades[key] = 0; // Nível 0
            }
        }
    }

    function savePermanentData() {
        localStorage.setItem('playerGems', playerGems);
        localStorage.setItem('playerUpgrades', JSON.stringify(playerUpgrades));
    }

    window.onload = () => {
        const debugStatus = document.getElementById('debug-status');
        if (debugStatus) debugStatus.textContent = "JS Iniciado."; // Primeiro registo visível no ecrã

        try {
            canvas = document.getElementById('gameCanvas');
            ctx = canvas.getContext('2d');
            gameContainer = document.getElementById('game-container');

            // Verificação básica para o canvas e o container
            if (!canvas || !ctx || !gameContainer) {
                console.error("Crítico: Canvas ou container do jogo não encontrados!");
                if (debugStatus) {
                    debugStatus.style.color = 'red';
                    debugStatus.textContent = 'Erro Crítico: Elementos do jogo não encontrados! Verifique a consola.';
                }
                return; // Parar a execução
            }

            // Carrega os dados permanentes do localStorage
            loadPermanentData();

            // --- CONFIGURAÇÕES GLOBAIS DO JOGO ---
            const CONFIG = {
                PLAYER_HEALTH: 120, // Aumentado para diminuir a dificuldade
                PLAYER_SPEED: 3,
                PLAYER_JUMP_FORCE: -10, // Força do salto (negativo para subir)
                PLAYER_DASH_FORCE: 15, // Força do dash
                PLAYER_DASH_DURATION: 10, // Duração do dash em frames
                PLAYER_DASH_COOLDOWN: 60, // Cooldown do dash em frames (1 segundo)
                PLAYER_DOUBLE_JUMP_FORCE: -8, // Força do segundo salto
                GRAVITY: 0.5, // Gravidade reintroduzida para o jogador
                GROUND_HEIGHT_PERCENT: 0.2, // 20% da altura do ecrã para o chão
                XP_TO_NEXT_LEVEL_BASE: 80, // Diminuído para acelerar o leveling
                XP_TO_NEXT_LEVEL_MULTIPLIER: 1.15, // Diminuído para acelerar o leveling
                XP_ORB_ATTRACTION_RADIUS: 120,
                POWERUP_DROP_CHANCE: 0.02, // 2% de chance
                JOYSTICK_RADIUS: 60, // Raio da base do joystick
                JOYSTICK_DEAD_ZONE: 10, // Zona morta para o punho
                CAMERA_LERP_FACTOR: 0.05, // Suavidade da câmara
                ENEMY_KNOCKBACK_FORCE: 20, // Força do recuo do inimigo ao ser atingido
                PLAYER_LANDING_SQUASH_DURATION: 10, // Duração do efeito de squash ao aterrar
                ORB_HIT_COOLDOWN_FRAMES: 12, // Cooldown para orbes atingirem o mesmo inimigo
                TEMPORARY_MESSAGE_DURATION: 120, // Duração das mensagens temporárias em frames (2 segundos)
                // ALTERAÇÃO 1: Mundo Expandido
                WORLD_BOUNDS: { width: 8000, height: 2000 } // Um mundo com 8000px de largura
            };

            // --- BASE DE DADOS DE HABILIDADES ---
            const SKILL_DATABASE = {
                'chain_lightning': { name: "Relâmpago em Cadeia", icon: "↯", type: 'projectile', cooldown: 120, levels: [
                    { desc: "Lança um raio que salta para 2 inimigos.", damage: 25, chains: 2, chainRadius: 150 },
                    { desc: "O raio salta para 3 inimigos.", damage: 30, chains: 3, chainRadius: 160 },
                    { desc: "Aumenta o dano e o número de saltos.", damage: 35, chains: 4, chainRadius: 170 },
                    { desc: "Aumenta ainda mais o dano e os saltos.", damage: 40, chains: 5, chainRadius: 180 },
                    { desc: "O raio é devastador e salta massivamente.", damage: 50, chains: 6, chainRadius: 200 }
                ]},
                'divine_lance': { name: "Lança Divina", icon: "↑", type: 'projectile', cooldown: 50, levels: [
                    { desc: "Dispara uma lança perfurante.", count: 1, damage: 10, pierce: 2, speed: 7 },
                    { desc: "Dispara duas lanças.", count: 2, damage: 12, pierce: 2, speed: 7 },
                    { desc: "Aumenta o dano e a perfuração.", count: 2, damage: 15, pierce: 3, speed: 8 },
                    { desc: "Dispara três lanças.", count: 3, damage: 15, pierce: 3, speed: 8 },
                    { desc: "Lanças mais rápidas e fortes.", count: 3, damage: 20, pierce: 4, speed: 9 }
                ]},
                'orbital_shield': { name: "Escudo Orbital", icon: "O", type: 'orbital', cooldown: 0, levels: [
                    { desc: "Um orbe sagrado gira ao seu redor.", count: 1, damage: 5, radius: 70, speed: 0.05 },
                    { desc: "Adiciona um segundo orbe.", count: 2, damage: 8, radius: 75, speed: 0.05 },
                    { desc: "Aumenta o dano dos orbes.", count: 2, damage: 15, radius: 80, speed: 0.05 },
                    { desc: "Adiciona um terceiro orbe.", count: 3, damage: 15, radius: 85, speed: 0.06 },
                    { desc: "Orbes mais rápidos e fortes.", count: 3, damage: 20, radius: 90, speed: 0.07 }
                ]},
                'vortex': { name: "Vórtice Sagrado", icon: "V", type: 'aura', cooldown: 400, levels: [
                    { desc: "Cria um vórtice que puxa inimigos.", radius: 150, duration: 120, force: 1.5, damage: 1 },
                    { desc: "Aumenta a força de atração.", radius: 160, duration: 120, force: 2.0, damage: 1 },
                    { desc: "Aumenta o raio do vórtice.", radius: 200, duration: 150, force: 2.0, damage: 2 },
                    { desc: "Vórtice mais duradouro e forte.", radius: 220, duration: 180, force: 2.5, damage: 2 },
                ]},
                'magnet': { name: "Íman Divino", icon: "M", type: 'passive', levels: [
                    { desc: "Aumenta o raio de recolha de XP em 25%.", collectRadiusBonus: 0.25 },
                    { desc: "Aumenta o raio de recolha de XP em 50%.", collectRadiusBonus: 0.50 },
                    { desc: "Aumenta o raio de recolha de XP em 75%.", collectRadiusBonus: 0.75 },
                ]},
                'heal': { name: "Cura Divina", icon: "+", type: 'utility', desc: "Restaura 25% da sua vida máxima.", instant: true },
                'health_regen': { name: "Regeneração Divina", icon: "♥", type: 'passive', levels: [
                    { desc: "Regenera 0.5 de vida por segundo.", regenPerSecond: 0.5 },
                    { desc: "Regenera 1 de vida por segundo.", regenPerSecond: 1 },
                    { desc: "Regenera 1.5 de vida por segundo.", regenPerSecond: 1.5 },
                    { desc: "Regenera 2 de vida por segundo.", regenPerSecond: 2 },
                ]},
                'particle_burst': { name: "Explosão de Partículas", icon: "✹", type: 'aura', cooldown: 240, levels: [
                    { desc: "Liberta uma explosão de partículas que causa 10 de dano.", radius: 80, damage: 10, particleCount: 30 },
                    { desc: "Aumenta o raio e o dano da explosão.", radius: 100, damage: 15, particleCount: 40 },
                    { desc: "Aumenta ainda mais o dano e as partículas.", radius: 120, damage: 25, particleCount: 50 },
                ]},
                'dash': { name: "Carga Astral", icon: "»", type: 'utility', cooldown: CONFIG.PLAYER_DASH_COOLDOWN, levels: [
                    { desc: `Realiza uma esquiva rápida na direção do movimento (cooldown: ${CONFIG.PLAYER_DASH_COOLDOWN/60}s).`, duration: CONFIG.PLAYER_DASH_DURATION, force: CONFIG.PLAYER_DASH_FORCE }
                ]},
                'double_jump': { name: "Salto Duplo", icon: "▲", type: 'passive', levels: [
                    { desc: "Permite um segundo salto no ar.", jumps: 2 }
                ]},
                // ALTERAÇÃO 2: Nova Habilidade - Raio Celestial
                'celestial_ray': { name: "Raio Celestial", icon: "→", type: 'projectile', cooldown: 90, levels: [
                    { desc: "Dispara um raio poderoso na última direção de movimento.", damage: 30, speed: 10, width: 10, length: 150, pierce: 5 }
                ]},
                'static_field': { name: "Campo Estático", icon: "⚡", type: 'aura', cooldown: 300, levels: [
                    { desc: "Cria um campo que abranda inimigos em 50%.", radius: 100, duration: 180, slowFactor: 0.5 }
                ]},
                'black_hole': { name: "Buraco Negro", icon: "⚫", type: 'utility', cooldown: 900, levels: [ // 15 segundos de cooldown
                    { desc: "Invoca um buraco negro que destrói todos os inimigos no ecrã.", damage: 99999 }
                ]},
                'aegis_shield': { name: "Égide Divina", icon: "🛡️", type: 'utility', cooldown: 600, levels: [ // 10s cooldown
                    { desc: "Cria um escudo temporário que absorve um golpe.", duration: 300 } // 5 segundos de duração
                ]},
                'scorched_earth': { name: "Rastro Ardente", icon: "🔥", type: 'passive', levels: [
                    { desc: "Deixa um rasto de chamas enquanto dá um dash, causando dano.", damagePerFrame: 0.5 }
                ]}
            };

            // --- CONFIGURAÇÃO DE ONDAS ---
            const WAVE_CONFIGS = [
                // Wave 1: Início suave
                { duration: 30, enemies: [{ type: 'chaser', count: 5, spawnInterval: 60 }], eliteChance: 0 },
                // Wave 2: Mais chasers e speeders
                { duration: 45, enemies: [{ type: 'chaser', count: 8, spawnInterval: 50 }, { type: 'speeder', count: 4, spawnInterval: 70 }], eliteChance: 0.01 },
                // Wave 3: Tanques introduzidos
                { duration: 60, enemies: [{ type: 'chaser', count: 10, spawnInterval: 45 }, { type: 'speeder', count: 6, spawnInterval: 60 }, { type: 'tank', count: 3, spawnInterval: 100 }], eliteChance: 0.02 },
                // Wave 4: Atiradores introduzidos
                { duration: 75, enemies: [{ type: 'chaser', count: 12, spawnInterval: 40 }, { type: 'speeder', count: 8, spawnInterval: 50 }, { type: 'tank', count: 4, spawnInterval: 90 }, { type: 'shooter', count: 2, spawnInterval: 120 }], eliteChance: 0.03 },
                // Wave 5: Bombardeiros introduzidos (pre-boss)
                { duration: 90, enemies: [{ type: 'chaser', count: 15, spawnInterval: 35 }, { type: 'speeder', count: 10, spawnInterval: 45 }, { type: 'tank', count: 5, spawnInterval: 80 }, { type: 'shooter', count: 3, spawnInterval: 100 }, { type: 'bomber', count: 2, spawnInterval: 150 }], eliteChance: 0.04 },
                // Wave 6: Curandeiros introduzidos
                { duration: 100, enemies: [{ type: 'chaser', count: 15, spawnInterval: 30 }, { type: 'healer', count: 1, spawnInterval: 200 }, { type: 'tank', count: 5, spawnInterval: 90 }], eliteChance: 0.05 },
                // Wave 7: Invocadores introduzidos
                { duration: 110, enemies: [{ type: 'speeder', count: 15, spawnInterval: 30 }, { type: 'summoner', count: 1, spawnInterval: 250 }, { type: 'shooter', count: 4, spawnInterval: 100 }], eliteChance: 0.06 },
            ];

            // --- VARIÁVEIS GLOBAIS DE ESTADO ---
            let gameState = 'menu'; // 'menu', 'playing', 'paused', 'levelUp', 'gameOver', 'guide', 'rank', 'upgrades'
            let keys = {}; // Para controlos de teclado
            let gameTime = 0; // Tempo em segundos (agora baseado em deltaTime)
            let frameCount = 0; // Contador de frames
            let score = {
                kills: 0,
                time: 0 // Tempo em segundos
            };
            let screenShake = { intensity: 0, duration: 0 };
            const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // --- CONTROLO MÓVEL DINÂMICO ---
            let activeTouches = new Map(); // Armazena touch.identifier -> { joystickType: 'move', startX: ..., ... }
            let movementVector = { x: 0, y: 0 }; // Vetor de movimento do jogador (apenas para o joystick de movimento)

            // --- CÂMARA ---
            let camera = {
                x: 0,
                y: 0,
                targetX: 0,
                targetY: 0,
                update() {
                    // Suaviza o movimento da câmara em direção ao jogador
                    this.x += (this.targetX - this.x) * CONFIG.CAMERA_LERP_FACTOR;
                    this.y += (this.targetY - this.y) * CONFIG.CAMERA_LERP_FACTOR;

                    // Limita a câmara para não mostrar fora do "mundo" (se houver um limite)
                    // Por enquanto, centraliza no jogador
                }
            };

            // --- GESTOR DE SOM (VERSÃO MELHORADA) ---
            const SoundManager = {
                initialized: false,
                sfx: {},
                bgm: null,

                init() {
                    if (this.initialized) return;
                    this.initialized = true;

                    const masterVolume = new Tone.Volume(-10).toDestination();
                    const sfxVolume = new Tone.Volume(-5).connect(masterVolume);
                    const bgmVolumeNode = new Tone.Volume(-20).connect(masterVolume);

                    // SFX de XP (mais melódico)
                    this.sfx.xp = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.2 }, volume: -12 }).connect(sfxVolume);
                    
                    // SFX de Subir de Nível (acorde ascendente)
                    this.sfx.levelUp = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.3 }, volume: -8 }).connect(sfxVolume);

                    // SFX de Dano (mais agressivo) - NoiseSynth
                    this.sfx.damage = new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }, volume: -3 }).connect(sfxVolume);

                    // SFX de Lança (mais nítido) - MembraneSynth
                    this.sfx.lance = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 8, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 }, volume: -15 }).connect(sfxVolume);

                    // SFX de Nuke (explosão massiva) - NoiseSynth
                    this.sfx.nuke = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.01, decay: 0.8, sustain: 0, release: 1 }, volume: 0 }).connect(sfxVolume);

                    // SFX de Disparo de Inimigo (novo) - Synth
                    this.sfx.enemyShot = new Tone.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }, volume: -10 }).connect(sfxVolume);

                    // SFX de Explosão de Partículas (novo) - NoiseSynth
                    this.sfx.particleBurst = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 }, volume: -5 }).connect(sfxVolume);

                    // SFX de UI Click (novo)
                    this.sfx.uiClick = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.1 }, volume: -20 }).connect(sfxVolume);

                    // SFX de Aterragem do Jogador (novo)
                    this.sfx.land = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }, volume: -15 }).connect(sfxVolume);

                    // Música de Fundo (BGM)
                    this.bgm = new Tone.Loop(time => {
                        const notes = ["C3", "E3", "G3", "A3", "F3", "D3"];
                        const synth = new Tone.Synth().connect(bgmVolumeNode);
                        synth.triggerAttackRelease(notes[Math.floor(Math.random() * notes.length)], "2n", time);
                    }, "2n").start(0);
                    
                    // Inicialmente, a BGM está em mute até o contexto de áudio começar
                    Tone.Transport.pause();
                },

                async startAudioContext() {
                    if (Tone.context.state !== 'running') {
                        try {
                            await Tone.start();
                            Tone.Transport.start(); // Inicia o transporte da BGM
                        } catch (e) {
                            if (DEBUG_MODE) console.error("Falha ao iniciar/resumir o contexto de áudio:", e);
                            // Se falhar, não há muito o que fazer além de registrar o erro.
                        }
                    }
                },
                
                play(effectName, noteOrDuration = null) { // Renamed parameter for clarity
                    this.startAudioContext(); // Ensures audio context is running
                    const sfx = this.sfx[effectName];
                    if (sfx) {
                        try {
                            // Check if the instrument is a NoiseSynth or similar that expects duration as first arg
                            if (sfx instanceof Tone.NoiseSynth) {
                                // For NoiseSynth, the first argument is duration, second is time (optional)
                                sfx.triggerAttackRelease(noteOrDuration || "8n"); // Use '8n' as default duration if none provided
                            } else if (sfx instanceof Tone.MembraneSynth) {
                                // MembraneSynth can take note, duration, time
                                sfx.triggerAttackRelease(noteOrDuration || "C4", "8n"); // Default note C4, duration 8n
                            }
                            else {
                                // For pitched synths (Synth, PolySynth), first arg is note, second is duration
                                sfx.triggerAttackRelease(noteOrDuration || "C5", "8n"); // Default note C5, duration 8n
                            }
                        } catch (e) {
                            if (DEBUG_MODE) console.error(`Erro ao reproduzir o efeito sonoro '${effectName}':`, e);
                        }
                    }
                }
            };
            
            // Inicializa os instrumentos assim que o script corre
            SoundManager.init();

            // --- AGRUPAMENTO DE OBJETOS ---
            // Funções genéricas para gerir agrupamentos de objetos
            const createPool = (ClassRef, initialSize = 100) => {
                const pool = [];
                for (let i = 0; i < initialSize; i++) {
                    const obj = new ClassRef();
                    obj.active = false;
                    pool.push(obj);
                }
                return pool;
            };

            const getFromPool = (pool, ...args) => {
                for (let i = 0; i < pool.length; i++) {
                    if (!pool[i].active) {
                        pool[i].active = true;
                        if (pool[i].init) pool[i].init(...args); // Chamar init se disponível
                        return pool[i];
                    }
                }
                // Se nenhum objeto inativo, criar um novo (e adicionar ao agrupamento para reutilização futura)
                const newObj = new pool[0].constructor(); // Assume que o construtor está disponível a partir do primeiro elemento
                newObj.active = true;
                if (newObj.init) newObj.init(...args);
                pool.push(newObj);
                return newObj;
            };

            const releaseToPool = (obj) => {
                obj.active = false;
                // Reiniciar qualquer estado que possa interferir com a reutilização futura
                if (obj.reset) obj.reset();
            };

            // --- CLASSES DO JOGO ---
            class Entity {
                constructor(x = 0, y = 0, radius = 0) { // Valores predefinidos para agrupamento
                    this.x = x;
                    this.y = y;
                    this.radius = radius;
                    this.isDead = false; // Usado para filtragem, ativo para agrupamento
                    this.active = true; // Para agrupamento de objetos
                }
                draw(ctx) {}
                update() {}
                // Método de reinicialização para agrupamento
                reset() {
                    this.x = 0;
                    this.y = 0;
                    this.radius = 0;
                    this.isDead = false;
                }
            }

            class DamageNumber extends Entity {
                constructor() {
                    super();
                }
                init(x, y, amount) {
                    super.reset();
                    this.x = x;
                    this.y = y;
                    this.amount = Math.round(amount); // Arredonda para um número inteiro
                    this.alpha = 1;
                    this.velocityY = -2; // Movimento para cima
                    this.life = 60; // Duração em frames (1 segundo)
                }

                update() {
                    this.y += this.velocityY;
                    this.alpha -= 0.015;
                    this.life--;
                    if (this.life <= 0) {
                        this.isDead = true;
                        releaseToPool(this);
                    }
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x - camera.x, this.y - camera.y);
                    ctx.globalAlpha = this.alpha;
                    ctx.fillStyle = '#FFF';
                    ctx.font = 'bold 20px "Courier New", Courier, monospace';
                    ctx.textAlign = 'center';
                    // OTIMIZAÇÃO: shadowBlur removido para desempenho
                    // ctx.shadowColor = 'orange';
                    // ctx.shadowBlur = 5;
                    ctx.fillText(this.amount, 0, 0);
                    ctx.restore();
                }

                reset() {
                    super.reset();
                    this.amount = 0;
                }
            }

            class Platform extends Entity {
                constructor(x, y, width, height, color = '#2E8B57') {
                    super(x, y, 0); // Raio 0 pois é um retângulo
                    this.width = width;
                    this.height = height;
                    this.color = color;
                }

                draw(ctx) {
                    // Otimização: Só desenha a plataforma se ela estiver visível na tela
                    const screenLeft = camera.x;
                    const screenRight = camera.x + canvas.width;
                    if (this.x + this.width < screenLeft || this.x > screenRight) {
                        return; // Fora da tela, não desenha
                    }

                    ctx.save();
                    ctx.translate(-camera.x, -camera.y); // Aplica o deslocamento da câmara

                    const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
                    gradient.addColorStop(0, '#3CB371');
                    gradient.addColorStop(0.5, this.color);
                    gradient.addColorStop(1, '#1E593F');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(this.x, this.y, this.width, this.height);

                    // OTIMIZAÇÃO: shadowBlur removido para desempenho
                    // ctx.shadowColor = 'rgba(0, 255, 0, 0.5)';
                    // ctx.shadowBlur = 10;
                    ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(this.x + this.width, this.y);
                    ctx.stroke();
                    
                    ctx.restore();
                }
            }
            
            class Player extends Entity {
                constructor() {
                    super(0, 0, 15);
                    // Aplica melhorias permanentes
                    const healthUpgradeLevel = playerUpgrades.max_health;
                    const damageUpgradeLevel = playerUpgrades.damage_boost;
                    const xpUpgradeLevel = playerUpgrades.xp_gain;

                    this.baseHealth = CONFIG.PLAYER_HEALTH + (healthUpgradeLevel > 0 ? PERMANENT_UPGRADES.max_health.levels[healthUpgradeLevel - 1].effect : 0);
                    this.damageModifier = 1 + (damageUpgradeLevel > 0 ? PERMANENT_UPGRADES.damage_boost.levels[damageUpgradeLevel - 1].effect : 0);
                    this.xpModifier = 1 + (xpUpgradeLevel > 0 ? PERMANENT_UPGRADES.xp_gain.levels[xpUpgradeLevel - 1].effect : 0);
                    
                    this.maxHealth = this.baseHealth;
                    this.health = this.maxHealth;
                    this.speed = CONFIG.PLAYER_SPEED;
                    this.xp = 0;
                    this.level = 1;
                    this.xpToNextLevel = CONFIG.XP_TO_NEXT_LEVEL_BASE;
                    this.skills = {};
                    this.collectRadius = CONFIG.XP_ORB_ATTRACTION_RADIUS;
                    this.facingRight = true;
                    this.hitTimer = 0;
                    this.animationFrame = 0;
                    this.velocityY = 0;
                    this.onGround = false;
                    this.jumpsAvailable = 1; // Para salto duplo
                    this.isDashing = false;
                    this.dashTimer = 0;
                    this.dashCooldown = 0;
                    this.lastMoveDirection = { x: 1, y: 0 }; // Para Raio Celestial
                    this.squashStretchTimer = 0; // Para animação de squash
                    this.x = canvas.width / 2;
                    this.y = canvas.height * (1 - CONFIG.GROUND_HEIGHT_PERCENT) - this.radius;
                    this.onGround = true;
                    this.shielded = false; // Para a habilidade Égide Divina
                    this.shieldTimer = 0; // Duração do escudo
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x - camera.x, this.y - camera.y); // Aplica o deslocamento da câmara

                    // Squash and Stretch
                    let scaleX = 1;
                    let scaleY = 1;
                    if (this.squashStretchTimer > 0) {
                        const progress = this.squashStretchTimer / CONFIG.PLAYER_LANDING_SQUASH_DURATION;
                        scaleY = 1 - (0.3 * Math.sin(Math.PI * progress)); // Achata e volta
                        scaleX = 1 + (0.3 * Math.sin(Math.PI * progress)); // Alarga e volta
                        this.squashStretchTimer--;
                    }
                    ctx.scale(this.facingRight ? scaleX : -scaleX, scaleY); // Vira e aplica squash

                    // Feedback de dano
                    if (this.hitTimer > 0) {
                        ctx.fillStyle = 'red';
                        // OTIMIZAÇÃO: shadowBlur removido
                        // ctx.shadowColor = 'red';
                        // ctx.shadowBlur = 20;
                        this.hitTimer--;
                    } else {
                        ctx.fillStyle = 'white';
                        // OTIMIZAÇÃO: Animação de pulso com shadowBlur removida
                        // ctx.shadowColor = 'cyan';
                        // const pulse = Math.sin(this.animationFrame * 0.1) * 5 + 10;
                        // ctx.shadowBlur = pulse;
                    }

                    // Desenha o corpo principal (triângulo base)
                    ctx.beginPath();
                    ctx.moveTo(0, -this.radius * 1.5); // Ponta mais alta
                    ctx.lineTo(this.radius * 1.2, this.radius * 0.8);
                    ctx.lineTo(-this.radius * 1.2, this.radius * 0.8);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = 'cyan';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Desenha as "asas" (formas adicionais)
                    ctx.beginPath();
                    ctx.moveTo(this.radius * 0.8, -this.radius * 0.5);
                    ctx.quadraticCurveTo(this.radius * 2, -this.radius * 1.5, this.radius * 1.5, this.radius * 0.5);
                    ctx.lineTo(this.radius * 0.8, this.radius * 0.8);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(-this.radius * 0.8, -this.radius * 0.5);
                    ctx.quadraticCurveTo(-this.radius * 2, -this.radius * 1.5, -this.radius * 1.5, this.radius * 0.5);
                    ctx.lineTo(-this.radius * 0.8, this.radius * 0.8);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    // Desenha o escudo se ativo
                    if (this.shielded) {
                        ctx.beginPath();
                        ctx.arc(0, 0, this.radius * 1.5, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + 0.5 * Math.sin(this.animationFrame * 0.1)})`;
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    }

                    ctx.restore();
                    // ctx.shadowBlur = 0; // Desnecessário pois foi removido
                    this.animationFrame++;
                }

                update() {
                    this.handleMovement();
                    this.applyGravity(); // Aplica gravidade ao jogador
                    this.updateSkills();

                    // Aplica regeneração de vida se a habilidade estiver ativa
                    if (this.skills['health_regen']) {
                        const regenLevelData = SKILL_DATABASE['health_regen'].levels[this.skills['health_regen'].level - 1];
                        this.health = Math.min(this.maxHealth, this.health + regenLevelData.regenPerSecond / 60); // Regeneração por frame
                    }

                    // Atualiza o alvo da câmara para a posição do jogador
                    camera.targetX = this.x - canvas.width / 2;
                    camera.targetY = this.y - canvas.height / 2;
                }

                handleMovement() {
                    if (this.isDashing) {
                        this.x += this.dashDirection.x * CONFIG.PLAYER_DASH_FORCE;
                        this.y += this.dashDirection.y * CONFIG.PLAYER_DASH_FORCE;
                        this.dashTimer--;
                        if (this.dashTimer <= 0) {
                            this.isDashing = false;
                        }
                        return; // Pára outros movimentos durante o dash
                    }
                
                    let dx = 0;
                    let dy_input = 0; // Input vertical separado
                
                    if (isMobile) {
                        dx = movementVector.x;
                        dy_input = movementVector.y;
                    } else {
                        dx = (keys['d'] || keys['ArrowRight']) ? 1 : ((keys['a'] || keys['ArrowLeft']) ? -1 : 0);
                        dy_input = (keys['s'] || keys['ArrowDown']) ? 1 : ((keys['w'] || keys['ArrowUp']) ? -1 : 0); // Para direção do dash
                    }
                
                    // Guarda a última direção de movimento se houver input
                    if (dx !== 0 || dy_input !== 0) {
                        const magnitude = Math.hypot(dx, dy_input);
                        this.lastMoveDirection = { x: dx / magnitude, y: dy_input / magnitude };
                    }
                    if (dx !== 0) {
                        this.facingRight = dx > 0;
                    }
                
                    // Aplica o movimento horizontal
                    this.x += dx * this.speed;
                
                    // Lógica de Salto unificada
                    const jumpPressed = isMobile ? (movementVector.y < -0.5) : (keys['w'] || keys['ArrowUp'] || keys[' ']);
                    if (jumpPressed && this.jumpsAvailable > 0) {
                        const isFirstJump = this.onGround || this.jumpsAvailable === (this.skills['double_jump'] ? 2 : 1);
                        this.velocityY = isFirstJump ? CONFIG.PLAYER_JUMP_FORCE : CONFIG.PLAYER_DOUBLE_JUMP_FORCE;
                        this.jumpsAvailable--;
                        this.onGround = false;
                        if (!isMobile) keys['w'] = keys['ArrowUp'] = keys[' '] = false;
                    }
                    
                    // Ativar Dash no PC
                    if (!isMobile && keys['shift']) {
                        this.dash();
                        keys['shift'] = false; // Previne múltiplos dashes com uma tecla premida
                    }
                
                    // Gestão do Cooldown do Dash
                    if (this.dashCooldown > 0) {
                        this.dashCooldown--;
                        if (isMobile) ui.dashButtonMobile.classList.add('on-cooldown');
                    } else {
                        if (isMobile) ui.dashButtonMobile.classList.remove('on-cooldown');
                    }
                }

                dash() {
                    if (this.dashCooldown > 0 || this.isDashing) return;
                
                    this.isDashing = true;
                    this.dashTimer = CONFIG.PLAYER_DASH_DURATION;
                    this.dashCooldown = CONFIG.PLAYER_DASH_COOLDOWN;
                    
                    // A direção já foi guardada em handleMovement, por isso basta usá-la
                    this.dashDirection = { x: this.lastMoveDirection.x, y: this.lastMoveDirection.y };
                
                    // Fallback: se por alguma razão não houver direção, usa a que está virado
                    if (this.dashDirection.x === 0 && this.dashDirection.y === 0) {
                        this.dashDirection.x = this.facingRight ? 1 : -1;
                    }
                
                    SoundManager.play('uiClick', 'F5');
                
                    // Lógica para Rastro Ardente
                    if (this.skills['scorched_earth']) {
                        const damage = SKILL_DATABASE['scorched_earth'].levels[0].damagePerFrame;
                        // Cria a área de dano
                        activeVortexes.push(new Vortex(this.x, this.y, { radius: 20, duration: 60, damage: damage, isExplosion: true, force: 0 }));
                        // ADICIONE: Cria partículas visuais de fogo
                        for (let i = 0; i < 5; i++) {
                            getFromPool(particlePool, this.x, this.y, 'orange', 2.5);
                        }
                    }
                }

                // ALTERAÇÃO 2: Evitar que o jogador caia pelo chão (MÉTODO REATORIZADO)
                applyGravity() {
                    const wasOnGround = this.onGround;
                    this.velocityY += CONFIG.GRAVITY;
                    this.y += this.velocityY;

                    this.onGround = false; // Assume que está no ar por padrão

                    // Verifica a colisão com todas as plataformas
                    for (const p of platforms) {
                        // A verificação de colisão verifica se o jogador estava acima no frame anterior e está abaixo (ou dentro) agora
                        if (this.x > p.x && this.x < p.x + p.width &&
                            (this.y - this.velocityY) <= p.y - this.radius && // Posição Y anterior
                            this.y >= p.y - this.radius) {                  // Posição Y atual
                            
                            this.y = p.y - this.radius;
                            this.velocityY = 0;
                            this.onGround = true;

                            if (!wasOnGround) { // Acabou de aterrar
                                this.jumpsAvailable = (this.skills['double_jump'] ? SKILL_DATABASE['double_jump'].levels[0].jumps : 1);
                                this.squashStretchTimer = CONFIG.PLAYER_LANDING_SQUASH_DURATION;
                                SoundManager.play('land', '16n');
                            }
                            break; // Encontrou uma plataforma, não precisa de verificar as outras
                        }
                    }

                    // --- SEÇÃO DE SEGURANÇA (Safety Net) ---
                    // Garante que o jogador não caia através da plataforma principal (chão).
                    if (platforms.length > 0) {
                        const groundPlatform = platforms[0]; // Assume que a primeira plataforma é sempre o chão principal.
                        const groundTopY = groundPlatform.y;

                        if (this.y > groundTopY - this.radius) {
                            // Se o jogador estiver abaixo do topo do chão por qualquer motivo, força-o de volta para cima.
                            this.y = groundTopY - this.radius;
                            if (this.velocityY > 0) this.velocityY = 0;
                            if (!this.onGround) { // Se ele não estava no chão, agora está.
                               this.onGround = true;
                               this.jumpsAvailable = (this.skills['double_jump'] ? SKILL_DATABASE['double_jump'].levels[0].jumps : 1);
                            }
                        }
                        
                        // O jogador morre se cair muito para fora do mundo
                        if (this.y > groundTopY + 200) { 
                            this.takeDamage(9999);
                        }
                    }
                    // --- FIM DA SEÇÃO DE SEGURANÇA ---
                }


                takeDamage(amount) {
                    if (this.shielded) {
                        this.shielded = false;
                        // Efeito visual de quebra de escudo
                        for(let i=0; i<20; i++) getFromPool(particlePool, this.x, this.y, 'cyan', 3);
                        return; // Bloqueia o dano
                    }
                    this.health -= amount;
                    this.hitTimer = 30; // Pisca por 30 frames
                    SoundManager.play('damage', '8n'); // Passa uma duração para o NoiseSynth
                    screenShake = { intensity: 5, duration: 15 };
                    if (this.health <= 0) {
                        this.health = 0;
                        this.isDead = true;
                        setGameState('gameOver');
                    }
                }

                addXp(amount) {
                    this.xp += amount * this.xpModifier; // Aplica o bónus de XP
                    SoundManager.play('xp', 'C5'); // Som de XP
                    // Partículas de XP ao recolher - REDUZIDO PARA OTIMIZAÇÃO
                    for (let i = 0; i < 4; i++) { 
                        getFromPool(particlePool, this.x, this.y, 'cyan', 2); // Usa o agrupamento
                    }

                    while (this.xp >= this.xpToNextLevel) {
                        this.level++;
                        this.xp -= this.xpToNextLevel;
                        this.xpToNextLevel = Math.floor(this.xpToNextLevel * CONFIG.XP_TO_NEXT_LEVEL_MULTIPLIER);
                        SoundManager.play('levelUp', ['C6', 'E6', 'G6']); // Som de Subir de Nível
                        setGameState('levelUp');
                    }
                }
                
                addSkill(skillId) {
                    const skillData = SKILL_DATABASE[skillId];
                    if (skillData.type === 'utility' && skillData.instant) {
                        if (skillId === 'heal') this.health = Math.min(this.maxHealth, this.health + this.maxHealth * 0.25);
                        if (skillId === 'black_hole') { // Habilidade Buraco Negro
                            SoundManager.play('nuke', '8n'); // Som de nuke para o buraco negro
                            screenShake = { intensity: 15, duration: 30 };
                            enemies.forEach(e => {
                                e.takeDamage(SKILL_DATABASE['black_hole'].levels[0].damage * this.damageModifier); // Aplica modificador de dano
                                e.applyKnockback(this.x, this.y, CONFIG.ENEMY_KNOCKBACK_FORCE * 5); // Forte knockback
                            });
                            showTemporaryMessage("BURACO NEGRO!", "gold");
                        }
                        return;
                    }
                
                    if (!this.skills[skillId]) { // Adquirindo pela primeira vez
                        this.skills[skillId] = { level: 1, timer: 0, hudElement: null }; // OTIMIZAÇÃO HUD: Adicionado hudElement
                        if (skillData.type === 'orbital') {
                            this.skills[skillId].orbs = Array.from({ length: skillData.levels[0].count }, (_, i) => ({ angle: (Math.PI * 2 / skillData.levels[0].count) * i, lastHitFrame: 0 }));
                        }
                
                        // OTIMIZAÇÃO HUD: Criar o ícone no HUD
                        if (skillData.type !== 'passive') {
                            const container = document.getElementById('skills-hud');
                            const div = document.createElement('div');
                            div.className = 'skill-hud-icon';
                            div.id = `hud-skill-${skillId}`;
                            div.innerHTML = `${skillData.icon}<sub>1</sub>`;
                            container.appendChild(div);
                            this.skills[skillId].hudElement = div; // Guarda a referência
                        }
                
                    } else { // Subindo de nível
                        this.skills[skillId].level++;
                        // OTIMIZAÇÃO HUD: Apenas atualizar o texto do nível
                        if (this.skills[skillId].hudElement) {
                            this.skills[skillId].hudElement.querySelector('sub').textContent = this.skills[skillId].level;
                        }
                    }
                    
                    // Aplicar passivas
                    if (skillData.type === 'passive') {
                        if(skillId === 'magnet') {
                            const levelData = skillData.levels[this.skills[skillId].level - 1];
                            this.collectRadius = CONFIG.XP_ORB_ATTRACTION_RADIUS * (1 + levelData.collectRadiusBonus);
                        }
                        if(skillId === 'double_jump') {
                            this.jumpsAvailable = SKILL_DATABASE['double_jump'].levels[0].jumps;
                        }
                    }
                }

                updateSkills() {
                    for (const skillId in this.skills) {
                        const skillState = this.skills[skillId];
                        const skillData = SKILL_DATABASE[skillId];
                        const levelData = skillData.levels[skillState.level - 1];

                        // Cooldowns para habilidades ativas/projéteis
                        if (skillData.type !== 'passive' && skillData.type !== 'orbital') {
                            skillState.timer--;
                            if(skillState.timer > 0) continue;
                        }

                        if (skillData.type === 'projectile') {
                            if (skillId === 'divine_lance') {
                                const targetEnemy = this.findNearestEnemy(); // Sempre procura o inimigo mais próximo
                                
                                if(targetEnemy) {
                                    let angle = Math.atan2(targetEnemy.y - this.y, targetEnemy.x - this.x);
                                    for (let i = 0; i < levelData.count; i++) {
                                        const spreadAngle = (i - (levelData.count - 1) / 2) * 0.1;
                                        // Aplica o modificador de dano do jogador
                                        const projectileDamage = levelData.damage * this.damageModifier;
                                        const newProjectile = getFromPool(projectilePool, this.x, this.y, angle + spreadAngle, { ...levelData, damage: projectileDamage });
                                        if (!newProjectile) {
                                            if (DEBUG_MODE) console.warn("Falha ao obter projétil do pool!"); 
                                        }
                                    }
                                    SoundManager.play('lance', 'C4'); // Som de lança
                                    skillState.timer = skillData.cooldown;
                                } else {
                                    skillState.timer = 10; // Tenta a cada 10 frames
                                }
                            // ALTERAÇÃO 2: Lógica de ativação do Raio Celestial
                            } else if (skillId === 'celestial_ray') { 
                                const rayAngle = Math.atan2(this.lastMoveDirection.y, this.lastMoveDirection.x);
                                // Aplica o modificador de dano do jogador
                                const rayDamage = levelData.damage * this.damageModifier;
                                getFromPool(projectilePool, this.x, this.y, rayAngle, { ...levelData, damage: rayDamage }, 'celestial_ray');
                                SoundManager.play('lance', 'E5'); // Som diferente para o raio
                                skillState.timer = skillData.cooldown;
                            } else if (skillId === 'chain_lightning') { // NOVA HABILIDADE
                                const targetEnemy = this.findNearestEnemy();
                                if (targetEnemy) {
                                    SoundManager.play('lance', 'A5'); // Som agudo
                                    chainLightningEffect(this, targetEnemy, levelData);
                                    skillState.timer = skillData.cooldown;
                                } else {
                                    skillState.timer = 10;
                                }
                            }
                        } else if (skillData.type === 'aura' && skillId === 'vortex') {
                            // Aplica o modificador de dano do jogador
                            const vortexDamage = levelData.damage * this.damageModifier;
                            activeVortexes.push(new Vortex(this.x, this.y, { ...levelData, damage: vortexDamage }));
                            skillState.timer = skillData.cooldown;
                        } else if (skillData.type === 'aura' && skillId === 'particle_burst') { // Nova habilidade
                            SoundManager.play('particleBurst', '8n'); // Passa uma duração para o NoiseSynth
                            enemies.forEach(enemy => {
                                if (Math.hypot(this.x - enemy.x, this.y - enemy.y) < levelData.radius) {
                                    enemy.takeDamage(levelData.damage * this.damageModifier); // Aplica modificador de dano
                                    enemy.applyKnockback(this.x, this.y, CONFIG.ENEMY_KNOCKBACK_FORCE * 1.5); // Mais knockback
                                }
                            });
                            // Partículas da explosão - REDUZIDO PARA OTIMIZAÇÃO
                            for (let i = 0; i < Math.floor(levelData.particleCount / 2); i++) {
                                getFromPool(particlePool, this.x, this.y, 'magenta', 3); 
                            }
                            skillState.timer = skillData.cooldown;
                        } else if (skillData.type === 'aura' && skillId === 'static_field') { // Campo Estático
                            activeStaticFields.push(new StaticField(this.x, this.y, levelData));
                            skillState.timer = skillData.cooldown;
                        } else if (skillId === 'aegis_shield') { // Égide Divina
                            if (skillState.timer <= 0) { // Se o cooldown acabou
                                this.shielded = true;
                                this.shieldTimer = levelData.duration;
                                skillState.timer = skillData.cooldown; // Reinicia o cooldown da habilidade
                            }
                            if (this.shieldTimer > 0) {
                                this.shieldTimer--;
                            } else {
                                this.shielded = false; // Desativa o escudo se o tempo acabar
                            }
                        }
                    }
                    // Habilidades orbitais atualizam sempre (não têm cooldown de ativação)
                    if (this.skills['orbital_shield']) {
                        const skillState = this.skills['orbital_shield'];
                        const levelData = SKILL_DATABASE['orbital_shield'].levels[skillState.level - 1];
                        // Se o número de orbes mudou, recria-os para que apareçam imediatamente
                        if (skillState.orbs.length !== levelData.count) {
                            skillState.orbs = Array.from({ length: levelData.count }, (_, i) => ({ angle: (Math.PI * 2 / levelData.count) * i, lastHitFrame: 0 }));
                        }

                        skillState.orbs.forEach(orb => {
                            orb.angle += levelData.speed;
                            const orbX = this.x + Math.cos(orb.angle) * levelData.radius;
                            const orbY = this.y + Math.sin(orb.angle) * levelData.radius;
                            
                            // Otimização: Usar Quadtree para verificar inimigos próximos ao orbe
                            const orbSearchRadius = 10 + 20; // Raio do orbe + margem
                            const orbSearchArea = new Rectangle(
                                orbX - orbSearchRadius, 
                                orbY - orbSearchRadius, 
                                orbSearchRadius * 2, 
                                orbSearchRadius * 2
                            );
                            const nearbyEnemiesForOrb = qtree.query(orbSearchArea);

                            nearbyEnemiesForOrb.forEach(enemy => {
                                if (Math.hypot(orbX - enemy.x, orbY - enemy.y) < 10 + enemy.radius) { // 10 é o raio do orbe
                                    // CORREÇÃO: Usar orbHitCooldown no inimigo em vez de setTimeout
                                    if(frameCount - orb.lastHitFrame > CONFIG.ORB_HIT_COOLDOWN_FRAMES && enemy.orbHitCooldown <= 0) { 
                                        enemy.takeDamage(levelData.damage * this.damageModifier); // Aplica modificador de dano
                                        enemy.applyKnockback(orbX, orbY, CONFIG.ENEMY_KNOCKBACK_FORCE * 0.5); // Pequeno knockback
                                        orb.lastHitFrame = frameCount; // Atualiza o último frame de acerto do orbe
                                        enemy.orbHitCooldown = CONFIG.ORB_HIT_COOLDOWN_FRAMES; // Define cooldown no inimigo
                                    }
                                }
                            });
                        });
                    }
                }

                findNearestEnemy() {
                    let nearest = null;
                    let nearestDistSq = Infinity; // Usar distância ao quadrado é mais rápido (evita raiz quadrada)

                    // Define uma área de busca grande e fixa em volta do jogador
                    const searchRadius = 2000; // Raio de busca aumentado para um mundo maior
                    const searchArea = new Rectangle(
                        this.x - searchRadius, 
                        this.y - searchRadius, 
                        searchRadius * 2, 
                        searchRadius * 2
                    );
                    
                    // Pede ao Quadtree GLOBAL apenas os inimigos que estão nesta área
                    const candidates = qtree.query(searchArea);

                    // Agora, só precisamos de verificar a distância para os candidatos
                    for (const enemy of candidates) {
                        const dx = this.x - enemy.x;
                        const dy = this.y - enemy.y;
                        const distSq = dx * dx + dy * dy; // Distância ao quadrado

                        if (distSq < nearestDistSq) {
                            nearestDistSq = distSq;
                            nearest = enemy;
                        }
                    }
                    return nearest;
                }
            }
            
            class Enemy extends Entity {
                constructor(x, y, type = 'chaser', isElite = false) { // Adicionado isElite
                    super(x, y, 10);
                    this.type = type;
                    this.isElite = isElite; // Propriedade para inimigos de elite
                    this.hitTimer = 0;
                    this.hitBy = new Set(); // Para dano por tick
                    this.animationFrame = 0; // Para animações de pulso
                    this.attackTimer = 0; // Para inimigos atiradores
                    this.knockbackVelocity = { x: 0, y: 0 }; // Para efeito de recuo
                    this.orbHitCooldown = 0; // Cooldown para ser atingido por orbes
                    this.explodesOnDeath = false; // Propriedade para Ceifador/Bomber

                    switch(type) {
                        // ALTERAÇÃO 3: Novo Inimigo - Ceifador
                        case 'reaper': 
                            this.radius = 10; this.speed = 2.5 + (gameTime / 180) + (waveNumber * 0.02);
                            this.health = 15 + Math.floor(gameTime / 20) * 2 + waveNumber; this.color = '#7DF9FF'; // Ciano pálido
                            this.shape = 'diamond'; this.damage = 30; // Dano alto da explosão
                            this.xpValue = 15;
                            this.explodesOnDeath = true; 
                            break;
                        case 'tank':
                            this.radius = 18; this.speed = 0.7 + (gameTime / 200) + (waveNumber * 0.005);
                            this.health = 70 + Math.floor(gameTime / 10) * 7 + (waveNumber * 3); this.color = '#FFA500';
                            this.shape = 'square'; this.damage = 12; this.xpValue = 40;
                            break;
                        case 'speeder':
                            this.radius = 8; this.speed = 2.2 + (gameTime / 100) + (waveNumber * 0.015);
                            this.health = 12 + Math.floor(gameTime / 15) * 2 + waveNumber; this.color = '#FFFF00';
                            this.shape = 'triangle'; this.damage = 7; this.xpValue = 12;
                            break;
                        case 'bomber':
                            this.radius = 12; this.speed = 0.9 + (gameTime / 220) + (waveNumber * 0.008);
                            this.health = 45 + Math.floor(gameTime / 10) * 4 + (waveNumber * 2); this.color = '#9400D3'; // Roxo
                            this.shape = 'pentagon'; this.damage = 9; this.xpValue = 25;
                            this.explodesOnDeath = true; // Bomber também explode
                            break;
                        case 'shooter': 
                            this.radius = 15; this.speed = 0.4 + (gameTime / 280) + (waveNumber * 0.004);
                            this.health = 35 + Math.floor(gameTime / 10) * 4 + (waveNumber * 2); this.color = '#FF00FF'; // Magenta
                            this.shape = 'star'; this.damage = 4; this.xpValue = 35;
                            this.attackCooldown = 150; // Ataca a cada 2.5 segundos
                            this.attackTimer = this.attackCooldown;
                            this.projectileSpeed = 3.5;
                            this.projectileDamage = 8;
                            break;
                        case 'healer': 
                            this.radius = 14; this.speed = 0.3 + (gameTime / 300) + (waveNumber * 0.003);
                            this.health = 60 + Math.floor(gameTime / 10) * 6 + (waveNumber * 3); this.color = '#00FF00'; // Verde
                            this.shape = 'cross'; this.damage = 0; this.xpValue = 50;
                            this.healCooldown = 180; // Cura a cada 3 segundos
                            this.healTimer = this.healCooldown;
                            this.healAmount = 5 + Math.floor(gameTime / 20);
                            this.healRadius = 100;
                            break;
                        case 'summoner':
                            this.radius = 20; this.speed = 0.2 + (gameTime / 350) + (waveNumber * 0.002);
                            this.health = 80 + Math.floor(gameTime / 10) * 8 + (waveNumber * 4); this.color = '#8B4513'; // Marrom
                            this.shape = 'pyramid'; this.damage = 0; this.xpValue = 70;
                            this.summonCooldown = 240; // Invoca a cada 4 segundos
                            this.summonTimer = this.summonCooldown;
                            break;
                        default: // chaser
                            this.radius = 12; this.speed = 1.3 + (gameTime / 150) + (waveNumber * 0.01);
                            this.health = 25 + Math.floor(gameTime / 10) * 3 + (waveNumber * 1.5); this.color = '#FF4D4D';
                            this.shape = 'circle'; this.damage = 8; this.xpValue = 20;
                            break;
                    }
                    if (this.isElite) { // Ajustes para inimigos de elite
                        this.radius *= 1.5;
                        this.health *= 2.5;
                        this.damage *= 1.5;
                        this.xpValue *= 2;
                        this.color = 'gold'; // Cor de elite
                    }
                    this.maxHealth = this.health;
                }

                draw(ctx) {
                    // Otimização: Só desenha se estiver na tela
                    const screenLeft = camera.x;
                    const screenRight = camera.x + canvas.width;
                    const screenTop = camera.y;
                    const screenBottom = camera.y + canvas.height;
                    if (this.x + this.radius < screenLeft || this.x - this.radius > screenRight ||
                        this.y + this.radius < screenTop || this.y - this.radius > screenBottom) {
                        return;
                    }

                    ctx.save();
                    ctx.translate(this.x - camera.x, this.y - camera.y); // Aplica o deslocamento da câmara

                    const color = this.hitTimer > 0 ? 'white' : this.color;
                    ctx.fillStyle = color;
                    
                    // OTIMIZAÇÃO: Animação de pulso com shadowBlur removida
                    // ctx.shadowColor = color;
                    // const pulse = Math.sin(this.animationFrame * 0.1) * 3 + 7;
                    // ctx.shadowBlur = pulse;

                    ctx.beginPath();
                    if (this.shape === 'square') {
                        ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
                    // ALTERAÇÃO 3: Desenho do Ceifador
                    } else if (this.shape === 'diamond') { 
                        ctx.moveTo(0, -this.radius);
                        ctx.lineTo(this.radius * 0.7, 0);
                        ctx.lineTo(0, this.radius);
                        ctx.lineTo(-this.radius * 0.7, 0);
                        ctx.closePath();
                    } else if (this.shape === 'triangle') {
                        // Triângulo aponta para o jogador (relativo ao inimigo)
                        const angle = Math.atan2(player.y - this.y, player.x - this.x);
                        ctx.moveTo(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
                        ctx.lineTo(Math.cos(angle + 2*Math.PI/3) * this.radius, Math.sin(angle + 2*Math.PI/3) * this.radius);
                        ctx.lineTo(Math.cos(angle + 4*Math.PI/3) * this.radius, Math.sin(angle + 4*Math.PI/3) * this.radius);
                    } else if (this.shape === 'pentagon') {
                        for(let i=0; i<5; i++) ctx.lineTo(Math.cos(i*2*Math.PI/5) * this.radius, Math.sin(i*2*Math.PI/5) * this.radius);
                    } else if (this.shape === 'star') { // Desenha uma estrela para o atirador
                        const numPoints = 5;
                        const outerRadius = this.radius;
                        const innerRadius = this.radius / 2;
                        ctx.rotate(this.animationFrame * 0.02);
                        for (let i = 0; i < numPoints * 2; i++) {
                            const radius = i % 2 === 0 ? outerRadius : innerRadius;
                            const angle = Math.PI / numPoints * i - Math.PI/2;
                            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
                        }
                    } else if (this.shape === 'cross') { // Curandeiro
                        ctx.rect(-this.radius / 3, -this.radius, this.radius * 2 / 3, this.radius * 2);
                        ctx.rect(-this.radius, -this.radius / 3, this.radius * 2, this.radius * 2 / 3);
                    } else if (this.shape === 'pyramid') { // Invocador
                        ctx.moveTo(0, -this.radius);
                        ctx.lineTo(this.radius, this.radius);
                        ctx.lineTo(-this.radius, this.radius);
                        ctx.closePath();
                    } else {
                        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                    }
                    ctx.closePath();
                    ctx.fill();
                    
                    if (this.hitTimer > 0) this.hitTimer--;
                    this.animationFrame++;

                    // Desenha aura de elite
                    if (this.isElite) {
                        ctx.beginPath();
                        ctx.arc(0, 0, this.radius * 1.2, 0, Math.PI * 2);
                        ctx.strokeStyle = 'gold';
                        ctx.lineWidth = 3;
                        ctx.stroke();

                        // Adiciona a barra de vida para elites
                        const healthBarWidth = this.radius * 2;
                        const healthPercentage = this.health / this.maxHealth;
                        ctx.fillStyle = '#333';
                        ctx.fillRect(-healthBarWidth / 2, this.radius + 10, healthBarWidth, 5);
                        ctx.fillStyle = 'red';
                        ctx.fillRect(-healthBarWidth / 2, this.radius + 10, healthBarWidth * healthPercentage, 5);
                    }

                    ctx.restore();
                }

                update() {
                    // Aplica knockback primeiro
                    this.x += this.knockbackVelocity.x;
                    this.y += this.knockbackVelocity.y;
                    this.knockbackVelocity.x *= 0.9; // Reduz o knockback
                    this.knockbackVelocity.y *= 0.9;
                    if (Math.hypot(this.knockbackVelocity.x, this.knockbackVelocity.y) < 0.1) {
                        this.knockbackVelocity.x = 0;
                        this.knockbackVelocity.y = 0;
                    }
                    
                    // Decrementa o cooldown de acerto por orbe
                    if (this.orbHitCooldown > 0) {
                        this.orbHitCooldown--;
                    }

                    // ALTERAÇÃO 3: Lógica de explosão para o Ceifador
                    if (this.type === 'reaper' && Math.hypot(player.x - this.x, player.y - this.y) < this.radius + 40) {
                        this.health = 0; // Força a morte, que aciona a explosão
                        this.takeDamage(1); // Aciona a lógica de morte
                        return; // Para de se mover
                    }

                    // Inimigos voadores movem-se em direção ao jogador em X e Y, a menos que estejam em knockback forte
                    if (Math.hypot(this.knockbackVelocity.x, this.knockbackVelocity.y) < 5) { // Só se move se o knockback for pequeno
                        const angle = Math.atan2(player.y - this.y, player.x - this.x);
                        let currentSpeed = this.speed;

                        // Aplica lentidão se estiver num campo estático
                        for (const field of activeStaticFields) {
                            if (Math.hypot(field.x - this.x, field.y - this.y) < field.radius) {
                                currentSpeed *= (1 - field.slowFactor);
                                break; // Apenas um campo por vez
                            }
                        }

                        this.x += Math.cos(angle) * currentSpeed;
                        this.y += Math.sin(angle) * currentSpeed;
                    }

                    // Lógica de ataque para atiradores
                    if (this.type === 'shooter') {
                        this.attackTimer--;
                        if (this.attackTimer <= 0) {
                            const angle = Math.atan2(player.y - this.y, player.x - this.x);
                            getFromPool(enemyProjectilePool, this.x, this.y, angle, this.projectileSpeed, this.projectileDamage); // Usa o agrupamento
                            SoundManager.play('enemyShot', 'D4'); // Som de disparo do inimigo
                            this.attackTimer = this.attackCooldown;
                        }
                    }
                    // Lógica de cura para curandeiros
                    if (this.type === 'healer') {
                        this.healTimer--;
                        if (this.healTimer <= 0) {
                            enemies.forEach(otherEnemy => {
                                if (otherEnemy !== this && Math.hypot(this.x - otherEnemy.x, this.y - otherEnemy.y) < this.healRadius) {
                                    otherEnemy.health = Math.min(otherEnemy.maxHealth, otherEnemy.health + this.healAmount);
                                    // Partículas de cura
                                    for (let i = 0; i < 3; i++) { getFromPool(particlePool, otherEnemy.x, otherEnemy.y, 'lime', 1); }
                                }
                            });
                            this.healTimer = this.healCooldown;
                        }
                    }
                    // Lógica de invocação para invocadores
                    if (this.type === 'summoner') {
                        this.summonTimer--;
                        if (this.summonTimer <= 0) {
                            // Invoca um chaser ou speeder pequeno
                            const summonedType = Math.random() < 0.5 ? 'chaser' : 'speeder';
                            enemies.push(new Enemy(this.x + (Math.random()-0.5)*50, this.y + (Math.random()-0.5)*50, summonedType));
                            for (let i = 0; i < 5; i++) { getFromPool(particlePool, this.x, this.y, 'brown', 2); }
                            this.summonTimer = this.summonCooldown;
                        }
                    }

                    // Verificação de segurança para remover inimigos perdidos
                    const worldEdge = CONFIG.WORLD_BOUNDS.width / 2 + 200;
                    if (this.x < -worldEdge || this.x > worldEdge) {
                        this.isDead = true;
                        waveEnemiesRemaining--; // Garante que a contagem da onda seja corrigida
                    }
                }

                takeDamage(amount) {
                    if(this.isDead) return;
                    this.health -= amount;
                    this.hitTimer = 5;

                    // Gera o número de dano
                    activeDamageNumbers.push(getFromPool(damageNumberPool, this.x, this.y, amount));

                    // Partículas de dano - REDUZIDO PARA OTIMIZAÇÃO
                    for (let i = 0; i < 5; i++) { 
                        getFromPool(particlePool, this.x, this.y, this.color, 1.8); // Usa o agrupamento
                    }
                    if (this.health <= 0) {
                        this.isDead = true;
                        // Garante que o XP Orb é criado e adicionado ao pool
                        getFromPool(xpOrbPool, this.x, this.y, this.xpValue); 
                        score.kills++; // Contabiliza a morte
                        // Partículas de morte do inimigo
                        for (let i = 0; i < 10; i++) {
                            getFromPool(particlePool, this.x, this.y, this.color, 3); 
                        }
                        
                        // ALTERAÇÃO 3: Efeito de explosão para inimigos explosivos
                        if(this.explodesOnDeath) {
                            const explosionRadius = this.type === 'reaper' ? 70 : 90;
                            activeVortexes.push(new Vortex(this.x, this.y, {radius: explosionRadius, duration: 30, damage: this.damage, isExplosion:true, force: 0}));
                            // Efeito visual maior para a explosão
                            for (let i = 0; i < 20; i++) { getFromPool(particlePool, this.x, this.y, this.color, 4); }
                        }
                        
                        if(Math.random() < CONFIG.POWERUP_DROP_CHANCE){
                            powerUps.push(new PowerUp(this.x, this.y, 'nuke'));
                            showTemporaryMessage("NUKE!", "yellow"); // Feedback para power-up
                        }
                        if (this.isElite) { // Larga gemas se for inimigo de elite
                            const gemsDropped = Math.floor(Math.random() * 3) + 1; // 1 a 3 gemas
                            playerGems += gemsDropped;
                            showTemporaryMessage(`+${gemsDropped} Gemas!`, 'violet');
                            savePermanentData(); // Salva os dados permanentes
                        }
                        waveEnemiesRemaining--; // Decrementa inimigos da onda
                    }
                }

                applyKnockback(sourceX, sourceY, force) {
                    const angle = Math.atan2(this.y - sourceY, this.x - sourceX);
                    this.knockbackVelocity.x = Math.cos(angle) * force;
                    this.knockbackVelocity.y = Math.sin(angle) * force;
                }
            }

            class BossEnemy extends Entity {
                constructor(x, y) {
                    super(x, y, 40); // Raio grande
                    this.maxHealth = 1000 + (waveNumber * 150);
                    this.health = this.maxHealth;
                    this.speed = 0.5 + (waveNumber * 0.02);
                    this.damage = 25;
                    this.xpValue = 500;
                    this.color = '#8A2BE2'; // Roxo azulado
                    this.animationFrame = 0;
                    this.phase = 1;
                    this.attackPatternTimer = 0;
                    this.currentAttack = 'chase';
                    this.hitTimer = 0; // Para feedback visual de dano
                    this.orbHitCooldown = 0; // Para orbes orbitais
                    this.knockbackVelocity = { x: 0, y: 0 };
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x - camera.x, this.y - camera.y);
                    
                    const color = this.hitTimer > 0 ? 'white' : this.color;
                    ctx.fillStyle = color;
                    // OTIMIZAÇÃO: shadowBlur removido
                    // ctx.shadowColor = 'magenta';
                    // ctx.shadowBlur = 30;

                    // Corpo principal rotativo
                    ctx.rotate(this.animationFrame * 0.01);
                    ctx.beginPath();
                    for(let i=0; i<6; i++) {
                        const angle = i * Math.PI / 3;
                        ctx.lineTo(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
                    }
                    ctx.closePath();
                    ctx.fill();
                    
                    // Núcleo pulsante
                    const pulse = Math.sin(this.animationFrame * 0.05) * 5 + (this.radius / 2);
                    ctx.fillStyle = 'white';
                    ctx.beginPath();
                    ctx.arc(0, 0, pulse, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Adiciona a barra de vida para o Boss
                    const healthBarWidth = this.radius * 3;
                    const healthPercentage = this.health / this.maxHealth;
                    ctx.fillStyle = '#333';
                    ctx.fillRect(-healthBarWidth / 2, this.radius + 15, healthBarWidth, 10);
                    ctx.fillStyle = '#FF00FF'; // Cor magenta para a vida do boss
                    ctx.fillRect(-healthBarWidth / 2, this.radius + 15, healthBarWidth * healthPercentage, 10);
                    
                    ctx.restore();
                    if (this.hitTimer > 0) this.hitTimer--;
                }

                update() {
                    this.animationFrame++;
                    this.attackPatternTimer--;
                    
                    // Aplica knockback
                    this.x += this.knockbackVelocity.x;
                    this.y += this.knockbackVelocity.y;
                    this.knockbackVelocity.x *= 0.95; 
                    this.knockbackVelocity.y *= 0.95;

                    if (this.health < this.maxHealth / 2 && this.phase === 1) {
                        this.phase = 2;
                        this.speed *= 1.5; // Fica mais rápido na segunda fase
                        this.currentAttack = 'barrage'; // Muda para um ataque mais agressivo
                        this.attackPatternTimer = 0;
                        showTemporaryMessage("FÚRIA DO BOSS!", "red");
                    }
                    
                    if (this.attackPatternTimer <= 0) {
                        this.chooseNextAttack();
                    }
                    this.executeAttack();

                    // Decrementa o cooldown de acerto por orbe
                    if (this.orbHitCooldown > 0) {
                        this.orbHitCooldown--;
                    }
                }

                chooseNextAttack() {
                    const attacks = (this.phase === 1) ? ['chase', 'shoot_ring'] : ['chase', 'barrage', 'summon'];
                    this.currentAttack = attacks[Math.floor(Math.random() * attacks.length)];
                    this.attackPatternTimer = 180; // Duração do padrão de ataque (3 segundos)
                }

                executeAttack() {
                    const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
                    
                    if (this.currentAttack === 'chase') {
                        this.x += Math.cos(angleToPlayer) * this.speed;
                        this.y += Math.sin(angleToPlayer) * this.speed;
                    } else if (this.currentAttack === 'shoot_ring' && frameCount % 30 === 0) {
                        for(let i=0; i<8; i++) {
                            const angle = i * Math.PI / 4;
                            getFromPool(enemyProjectilePool, this.x, this.y, angle, 3, 10);
                        }
                    } else if (this.currentAttack === 'barrage' && frameCount % 10 === 0) {
                        getFromPool(enemyProjectilePool, this.x, this.y, angleToPlayer + (Math.random() - 0.5) * 0.5, 5, 15);
                    } else if (this.currentAttack === 'summon' && this.attackPatternTimer === 100) {
                        enemies.push(new Enemy(this.x + (Math.random()-0.5)*50, this.y + (Math.random()-0.5)*50, 'speeder', true));
                        enemies.push(new Enemy(this.x + (Math.random()-0.5)*50, this.y + (Math.random()-0.5)*50, 'chaser', true));
                    }
                }

                takeDamage(amount) {
                    if(this.isDead) return;
                    this.health -= amount;
                    this.hitTimer = 5; // Feedback visual de dano

                    // Gera o número de dano
                    activeDamageNumbers.push(getFromPool(damageNumberPool, this.x, this.y, amount));

                    // Partículas de dano
                    for (let i = 0; i < 10; i++) { 
                        getFromPool(particlePool, this.x, this.y, this.color, 2.5); 
                    }
                    if (this.health <= 0) {
                        this.isDead = true;
                        getFromPool(xpOrbPool, this.x, this.y, this.xpValue);
                        score.kills++;
                        waveEnemiesRemaining--; // Conta o boss como 1 inimigo para a onda
                        showTemporaryMessage("BOSS DERROTADO!", "gold");
                        screenShake = { intensity: 20, duration: 60 };
                        // Partículas de morte do boss
                        for (let i = 0; i < 50; i++) {
                            getFromPool(particlePool, this.x, this.y, this.color, 5); 
                        }
                        // Bosses largam mais gemas
                        const gemsDropped = Math.floor(Math.random() * 10) + 5; // 5 a 14 gemas
                        playerGems += gemsDropped;
                        showTemporaryMessage(`+${gemsDropped} Gemas!`, 'violet');
                        savePermanentData(); // Salva os dados permanentes
                    }
                }

                applyKnockback(sourceX, sourceY, force) {
                    const angle = Math.atan2(this.y - sourceY, this.x - sourceX);
                    this.knockbackVelocity.x = Math.cos(angle) * force;
                    this.knockbackVelocity.y = Math.sin(angle) * force;
                }
            }
            
            // ALTERAÇÃO 2: Classe de Projétil modificada para lidar com o Raio Celestial
            class Projectile extends Entity {
                constructor() {
                    super();
                    this.piercedEnemies = new Set();
                    this.trailParticles = []; // Para efeito de rasto
                    this.type = 'normal'; // 'normal' ou 'celestial_ray'
                }

                // método init para agrupamento
                init(x, y, angle, levelData, type = 'normal') {
                    super.reset(); 
                    this.x = x; 
                    this.y = y;
                    this.type = type;

                    if (this.type === 'celestial_ray') {
                        this.radius = levelData.width / 2;
                        this.length = levelData.length;
                        this.velocity = { x: Math.cos(angle) * levelData.speed, y: Math.sin(angle) * levelData.speed };
                        this.damage = levelData.damage; // Já vem com o modificador
                        this.pierce = levelData.pierce;
                        this.angle = angle; // Para desenhar o raio
                    } else { // Normal projectile (Divine Lance)
                        this.radius = 5; // Raio fixo para projétil
                        this.velocity = { x: Math.cos(angle) * levelData.speed, y: Math.sin(angle) * levelData.speed };
                        this.damage = levelData.damage; // Já vem com o modificador
                        this.pierce = levelData.pierce;
                    }
                    this.piercedEnemies.clear(); // Limpar conjunto para reutilização
                    this.trailParticles = []; // Reiniciar partículas de rasto
                    this.active = true; // Garante que o projétil está ativo ao ser inicializado
                    this.isDead = false; // Garante que não está morto
                }

                draw(ctx) {
                    // Otimização: Só desenha se estiver na tela
                    const screenLeft = camera.x;
                    const screenRight = camera.x + canvas.width;
                    const screenTop = camera.y;
                    const screenBottom = camera.y + canvas.height;
                    const largerDimension = this.type === 'celestial_ray' ? this.length : this.radius;
                    if (this.x + largerDimension < screenLeft || this.x - largerDimension > screenRight ||
                        this.y + largerDimension < screenTop || this.y - largerDimension > screenBottom) {
                        return;
                    }

                    ctx.save(); 
                    ctx.translate(this.x - camera.x, this.y - camera.y); 

                    // Desenha o rasto
                    this.trailParticles.forEach(p => {
                        ctx.save();
                        ctx.globalAlpha = p.alpha;
                        ctx.beginPath();
                        ctx.arc(p.x - this.x, p.y - this.y, p.radius, 0, Math.PI * 2);
                        ctx.fillStyle = p.color;
                        ctx.fill();
                        ctx.restore();
                    });

                    // Desenha o projétil principal
                    if (this.type === 'celestial_ray') {
                        ctx.save();
                        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
                        ctx.rotate(this.angle); 
                        ctx.fillRect(-this.length / 2, -this.radius, this.length, this.radius * 2);
                        ctx.restore();
                    } else { // Projétil normal (Lança Divina)
                        ctx.fillStyle = 'yellow';
                        ctx.beginPath();
                        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    
                    ctx.restore();
                }
                
                update() {
                    if (!this.active) { 
                        return;
                    }
                    this.x += this.velocity.x;
                    this.y += this.velocity.y;

                    // Adiciona partículas ao rasto
                    if (frameCount % 3 === 0) { 
                        this.trailParticles.push({
                            x: this.x,
                            y: this.y,
                            radius: this.radius * (Math.random() * 0.3 + 0.2),
                            color: `rgba(255, 255, ${Math.floor(Math.random() * 255)}, 0.5)`,
                            alpha: 1
                        });
                    }
                    
                    // Otimização: Atualiza e remove partículas do rasto sem usar .filter()
                    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
                        const p = this.trailParticles[i];
                        p.alpha -= 0.08;
                        p.radius *= 0.9;
                        if (p.alpha <= 0.05) {
                            this.trailParticles.splice(i, 1); // Remove a partícula
                        }
                    }

                    // Verifica se o projétil saiu dos limites do mundo
                    const worldEdge = CONFIG.WORLD_BOUNDS.width / 2 + 200;
                    if (this.x < -worldEdge || this.x > worldEdge || this.y < -worldEdge || this.y > worldEdge) {
                        this.isDead = true;
                        releaseToPool(this);
                    }
                }

                reset() { // Método de reinicialização para agrupamento
                    super.reset();
                    this.velocity = { x: 0, y: 0 };
                    this.damage = 0;
                    this.pierce = 0;
                    this.piercedEnemies.clear();
                    this.trailParticles = [];
                    this.type = 'normal';
                    this.length = 0; 
                    this.angle = 0; 
                }
            }

            class EnemyProjectile extends Entity {
                constructor() {
                    super();
                    this.color = 'red';
                    this.trailParticles = [];
                }

                init(x, y, angle, speed, damage) {
                    super.reset(); 
                    this.x = x; 
                    this.y = y;
                    this.radius = 7; // Raio do projétil inimigo
                    this.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
                    this.damage = damage;
                    this.color = 'red';
                    this.trailParticles = [];
                }

                draw(ctx) {
                    // Otimização: Só desenha se estiver na tela
                    const screenLeft = camera.x;
                    const screenRight = camera.x + canvas.width;
                    if (this.x + this.radius < screenLeft || this.x - this.radius > screenRight) {
                        return;
                    }

                    ctx.save();
                    ctx.translate(-camera.x, -camera.y);

                    // Desenha o rasto
                    this.trailParticles.forEach(p => {
                        ctx.save();
                        ctx.globalAlpha = p.alpha;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                        ctx.fillStyle = p.color;
                        ctx.fill();
                        ctx.restore();
                    });

                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                
                update() {
                    this.x += this.velocity.x;
                    this.y += this.velocity.y;

                    // Adiciona partículas ao rasto
                    if (frameCount % 3 === 0) {
                        this.trailParticles.push({
                            x: this.x,
                            y: this.y,
                            radius: this.radius * (Math.random() * 0.3 + 0.2),
                            color: `rgba(255, 0, 0, 0.5)`, // Rasto vermelho
                            alpha: 1
                        });
                    }
                    
                    // Otimização: Atualiza e remove partículas do rasto
                    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
                        const p = this.trailParticles[i];
                        p.alpha -= 0.08;
                        p.radius *= 0.9;
                        if (p.alpha <= 0.05) {
                            this.trailParticles.splice(i, 1);
                        }
                    }

                    // Verifica se o projétil saiu da tela
                    if (this.x < camera.x - 100 || this.x > camera.x + canvas.width + 100 || this.y < camera.y - 100 || this.y > camera.y + canvas.height + 100) {
                        this.isDead = true;
                        releaseToPool(this);
                    }
                }

                reset() { // Método de reinicialização para agrupamento
                    super.reset();
                    this.velocity = { x: 0, y: 0 };
                    this.damage = 0;
                    this.color = 'red'; // Cor predefinida
                    this.trailParticles = [];
                }
            }
            
            class XPOrb extends Entity {
                constructor() {
                    super();
                }
                init(x, y, value) {
                    super.reset();
                    this.x = x; 
                    this.y = y;
                    this.radius = 5; // Raio fixo para XPOrb
                    this.value = value;
                }
                draw(ctx) {
                    // Otimização: Só desenha se estiver na tela
                    const screenLeft = camera.x;
                    const screenRight = camera.x + canvas.width;
                    if (this.x + this.radius < screenLeft || this.x - this.radius > screenRight) {
                        return;
                    }

                    ctx.save();
                    ctx.translate(-camera.x, -camera.y); // Aplica o deslocamento da câmara
                    ctx.fillStyle = 'cyan';
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                update() {
                    if (!this.active) return; // Garante que apenas orbes ativos são atualizados

                    const dist = Math.hypot(player.x - this.x, player.y - this.y);

                    if (dist < player.collectRadius) {
                        const angle = Math.atan2(player.y - this.y, player.x - this.x);
                        this.x += Math.cos(angle) * 8; // Velocidade de atração
                        this.y += Math.sin(angle) * 8;
                    }
                    if (dist < player.radius + this.radius) { // Verificar colisão real para recolha
                        player.addXp(this.value);
                        this.isDead = true; // Marcar para remoção
                        releaseToPool(this);
                    }
                }
                reset() { // Método de reinicialização para agrupamento
                    super.reset();
                    this.value = 0;
                }
            }
            
            class Particle extends Entity {
                constructor() {
                    super();
                }
                init(x, y, color = 'white', scale = 1) { // Adicionado um fator de escala
                    super.reset();
                    this.x = x; 
                    this.y = y;
                    this.radius = (Math.random() * 3 + 1) * scale;
                    this.velocity = { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 }; // Velocidade inicial maior
                    this.alpha = 1;
                    this.friction = 0.95;
                    this.color = color; // Cor da partícula
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(-camera.x, -camera.y); // Aplica o deslocamento da câmara
                    ctx.globalAlpha = this.alpha;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                    ctx.fillStyle = this.color;
                    ctx.fill();
                    ctx.restore();
                }

                update() {
                    this.velocity.x *= this.friction;
                    this.velocity.y *= this.friction;
                    this.x += this.velocity.x;
                    this.y += this.velocity.y;
                    this.alpha -= 0.05; // Desaparece mais rapidamente para otimização
                    if (this.alpha <= 0) {
                        this.isDead = true; // Marcar para remoção
                        releaseToPool(this); // Libertar para o agrupamento
                    }
                }
                reset() { // Método de reinicialização para agrupamento
                    super.reset();
                    this.velocity = { x: 0, y: 0 };
                    this.alpha = 1;
                    this.friction = 0.95;
                    this.color = 'white';
                }
            }

            class PowerUp extends Entity {
                constructor(x, y, type) {
                    super(x, y, 10);
                    this.type = type;
                }
                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x - camera.x, this.y - camera.y); // Aplica o deslocamento da câmara
                    ctx.rotate(frameCount * 0.05);
                    ctx.fillStyle = 'yellow';
                    ctx.beginPath();
                    // Desenha uma estrela
                    for (let i = 0; i < 5; i++) {
                        const angle = i * (Math.PI * 2 / 5) - Math.PI / 2; // Começa a apontar para cima
                        const xOuter = Math.cos(angle) * this.radius;
                        const yOuter = Math.sin(angle) * this.radius;
                        ctx.lineTo(xOuter, yOuter);

                        const innerAngle = angle + Math.PI / 5;
                        const xInner = Math.cos(innerAngle) * (this.radius / 2); // Raio interno menor
                        const yInner = Math.sin(innerAngle) * (this.radius / 2);
                        ctx.lineTo(xInner, yInner);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
                update() {
                    if (Math.hypot(player.x - this.x, player.y - this.y) < player.radius + this.radius) {
                        this.applyEffect();
                        this.isDead = true;
                    }
                }
                applyEffect() {
                    if(this.type === 'nuke'){
                        enemies.forEach(e => {
                            e.takeDamage(10000); // Dano massivo
                            e.applyKnockback(this.x, this.y, CONFIG.ENEMY_KNOCKBACK_FORCE * 5); // Forte knockback
                        });
                        SoundManager.play('nuke', '8n'); // Passa uma duração para o NoiseSynth
                        screenShake = { intensity: 15, duration: 30 }; // Grande agitação
                    }
                }
            }
            
            class Vortex extends Entity {
                constructor(x, y, levelData) {
                    super(x, y, 10);
                    this.duration = levelData.duration;
                    this.initialDuration = levelData.duration;
                    this.force = levelData.force;
                    this.damage = levelData.damage;
                    this.maxRadius = levelData.radius;
                    this.isExplosion = levelData.isExplosion || false;
                    this.animationFrame = 0;
                    this.enemiesHitByExplosion = new Set(); // Armazena inimigos atingidos pela explosão
                }

                update() {
                    this.duration--;
                    if (this.duration <= 0) {
                        this.isDead = true;
                        // Limpeza: Ao morrer, remove a si mesmo do "hitBy" dos inimigos
                        this.enemiesHitByExplosion.forEach(enemy => {
                             if(enemy.hitBy) enemy.hitBy.delete(this);
                        });
                        return; // Para a execução aqui
                    }

                    // A lógica de puxar/danificar inimigos continua aqui
                    enemies.forEach(enemy => {
                        const dist = Math.hypot(this.x - enemy.x, this.y - enemy.y);
                        if(dist < this.maxRadius){
                            if(this.isExplosion){
                                if(!enemy.hitBy.has(this)){ 
                                    enemy.takeDamage(this.damage * player.damageModifier); // Explosões também escalam com dano do jogador
                                    enemy.applyKnockback(this.x, this.y, CONFIG.ENEMY_KNOCKBACK_FORCE * 2);
                                    enemy.hitBy.add(this); // Adiciona este vórtice ao conjunto do inimigo
                                    this.enemiesHitByExplosion.add(enemy); // Lembra quem foi atingido
                                }
                            } else { 
                                const angle = Math.atan2(this.y - enemy.y, this.x - enemy.x);
                                enemy.x += Math.cos(angle) * this.force;
                                enemy.y += Math.sin(angle) * this.force;
                                if(frameCount % 60 === 0) enemy.takeDamage(this.damage * player.damageModifier);
                            }
                        }
                    });
                    this.animationFrame++;
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x - camera.x, this.y - camera.y);

                    const lifeRatio = this.duration / this.initialDuration;
                    const currentRadius = this.maxRadius * (this.isExplosion ? (1-lifeRatio) : 1);

                    ctx.rotate(this.animationFrame * 0.05);

                    ctx.fillStyle = `rgba(150, 0, 255, ${this.isExplosion ? lifeRatio * 0.8 : 0.2})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = `rgba(100, 0, 200, ${this.isExplosion ? lifeRatio * 0.6 : 0.1})`;
                    ctx.beginPath();
                    ctx.arc(0, 0, currentRadius * 0.8, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                }
            }

            class StaticField extends Entity {
                constructor(x, y, levelData) {
                    super(x, y, levelData.radius);
                    this.duration = levelData.duration;
                    this.slowFactor = levelData.slowFactor;
                    this.animationFrame = 0;
                }

                update() {
                    this.duration--;
                    if (this.duration <= 0) this.isDead = true;
                    this.animationFrame++;
                }

                draw(ctx) {
                    ctx.save();
                    ctx.translate(this.x - camera.x, this.y - camera.y);

                    const lifeRatio = this.duration / SKILL_DATABASE['static_field'].levels[0].duration;
                    const currentRadius = this.radius * (0.5 + 0.5 * (1 - lifeRatio)); // Pulsa um pouco

                    ctx.strokeStyle = `rgba(0, 255, 255, ${lifeRatio * 0.5})`; // Ciano transparente
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.strokeStyle = `rgba(0, 255, 255, ${lifeRatio * 0.2})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(0, 0, currentRadius * 0.8, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.restore();
                }
            }

            class DemoPlayer extends Entity {
                constructor(x, y) {
                    super(x, y, 25); // Um pouco maior que o jogador normal
                    this.animationFrame = 0;
                    this.angle = 0;
                }
                update() {
                    this.animationFrame++;
                    this.y += Math.sin(this.animationFrame * 0.02) * 0.5; // Movimento suave para cima e para baixo
                }
                draw(ctx) {
                    // Reutiliza o código de desenho do jogador normal, mas com algumas alterações
                    ctx.save();
                    ctx.translate(this.x, this.y); // Sem câmara
                    ctx.fillStyle = 'white';
                    ctx.strokeStyle = 'cyan';
                    ctx.lineWidth = 3;

                    ctx.beginPath();
                    ctx.moveTo(0, -this.radius * 1.5);
                    ctx.lineTo(this.radius * 1.2, this.radius * 0.8);
                    ctx.lineTo(-this.radius * 1.2, this.radius * 0.8);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // --- ESTRUTURA DE DADOS PARA OTIMIZAR COLISÕES ---
            class Quadtree {
                constructor(bounds, capacity = 4) {
                    this.bounds = bounds; // { x, y, width, height }
                    this.capacity = capacity; // Quantos objetos antes de subdividir
                    this.points = []; // Objetos neste nó
                    this.divided = false;
                }

                subdivide() {
                    let { x, y, width, height } = this.bounds;
                    let w2 = width / 2;
                    let h2 = height / 2;

                    // Criar os 4 novos quadrantes
                    let ne = new Quadtree(new Rectangle(x + w2, y, w2, h2), this.capacity);
                    let nw = new Quadtree(new Rectangle(x, y, w2, h2), this.capacity);
                    let se = new Quadtree(new Rectangle(x + w2, y + h2, w2, h2), this.capacity);
                    let sw = new Quadtree(new Rectangle(x, y + h2, w2, h2), this.capacity);

                    this.northeast = ne;
                    this.northwest = nw;
                    this.southeast = se;
                    this.southwest = sw;

                    this.divided = true;
                }

                // Insere um objeto (que deve ter propriedades x, y)
                insert(point) {
                    if (!this.bounds.contains(point)) {
                        return false; // Simplesmente não insere se estiver fora dos limites
                    }

                    if (this.points.length < this.capacity) {
                        this.points.push(point);
                        return true;
                    }
                    
                    if (!this.divided) {
                        this.subdivide();
                    }
                    
                    // Tenta inserir nos filhos e retorna true se bem-sucedido em qualquer um deles
                    if (this.northeast.insert(point) || 
                        this.northwest.insert(point) || 
                        this.southeast.insert(point) || 
                        this.southwest.insert(point)) {
                        return true;
                    }

                    // Se não couber em nenhum filho (caso raro de estar exatamente na fronteira)
                    return false;
                }

                // Retorna todos os objetos dentro de um certo alcance (range)
                query(range, found = []) {
                    if (!this.bounds.intersects(range)) {
                        return found;
                    }
                    
                    for (let p of this.points) {
                        if (range.contains(p)) { 
                            found.push(p);
                        }
                    }
                    
                    if (this.divided) {
                        this.northwest.query(range, found);
                        this.northeast.query(range, found);
                        this.southwest.query(range, found);
                        this.southeast.query(range, found);
                    }
                    
                    return found;
                }
            }

            // Funções de ajuda para os limites do Quadtree
            function Rectangle(x, y, w, h) {
                this.x = x;
                this.y = y;
                this.width = w;
                this.height = h;
            }

            Rectangle.prototype.contains = function(point) {
                // Para um ponto (x,y)
                return (point.x >= this.x &&
                        point.x < this.x + this.width &&
                        point.y >= this.y &&
                        point.y < this.y + this.height);
            };

            Rectangle.prototype.intersects = function(range) {
                // Para outro retângulo (range)
                return !(range.x > this.x + this.width ||
                         range.x + range.width < this.x ||
                         range.y > this.y + this.height ||
                         range.y + range.height < this.y);
            };

            // --- LÓGICA DO JOGO ---
            function initGame() {
                // ALTERAÇÃO 1: Geração de plataformas aprimorada para um mundo maior
                platforms = [];
                const groundLevel = canvas.height * (1 - CONFIG.GROUND_HEIGHT_PERCENT);

                // O chão principal, estendido para o novo tamanho do mundo
                platforms.push(new Platform(
                    -CONFIG.WORLD_BOUNDS.width, 
                    groundLevel,
                    CONFIG.WORLD_BOUNDS.width * 2,
                    CONFIG.WORLD_BOUNDS.height
                ));

                // Geração de plataformas flutuantes
                const platformCount = 35; // Aumentado para preencher o mundo maior
                const minGapX = 50;  
                const minGapY = 40;  
                let attempts = 0;

                for (let i = 0; i < platformCount && attempts < 1000; i++) {
                    const pWidth = Math.random() * 150 + 100;
                    const pHeight = 20;
                    const pX = (Math.random() - 0.5) * (CONFIG.WORLD_BOUNDS.width - pWidth);
                    const pY = groundLevel - (Math.random() * 400 + 80); 

                    let overlaps = false;
                    for (const existingPlatform of platforms) {
                        if (pX < existingPlatform.x + existingPlatform.width + minGapX &&
                            pX + pWidth > existingPlatform.x - minGapX &&
                            pY < existingPlatform.y + existingPlatform.height + minGapY &&
                            pY + pHeight > existingPlatform.y - minGapY) {
                            overlaps = true;
                            break;
                        }
                    }

                    if (!overlaps) {
                        platforms.push(new Platform(pX, pY, pWidth, pHeight));
                    } else {
                        i--; 
                    }
                    attempts++;
                }

                // ALTERAÇÃO 4b: Gerar partículas de ambiente para o mundo expandido
                ambientParticles = [];
                for(let i=0; i < 100; i++) {
                    ambientParticles.push({
                        x: Math.random() * CONFIG.WORLD_BOUNDS.width - (CONFIG.WORLD_BOUNDS.width/2),
                        y: Math.random() * CONFIG.WORLD_BOUNDS.height,
                        radius: Math.random() * 1.5,
                        vx: (Math.random() - 0.5) * 0.1,
                        vy: (Math.random() - 0.5) * 0.1,
                        alpha: Math.random() * 0.5 + 0.1
                    });
                }


                player = new Player();
                
                // Inicializa os agrupamentos de objetos
                particlePool = createPool(Particle, 200);
                projectilePool = createPool(Projectile, 50);
                enemyProjectilePool = createPool(EnemyProjectile, 50);
                xpOrbPool = createPool(XPOrb, 100);
                damageNumberPool = createPool(DamageNumber, 50);

                player.addSkill('divine_lance'); 

                // Limpa todas as entidades ativas
                enemies = []; 
                activeVortexes = [];
                powerUps = [];
                activeStaticFields = [];
                activeDamageNumbers = [];

                // Limpa o HTML do HUD
                document.getElementById('skills-hud').innerHTML = '';

                // Liberta todos os objetos de volta para os seus agrupamentos
                particlePool.forEach(p => releaseToPool(p));
                projectilePool.forEach(p => releaseToPool(p));
                enemyProjectilePool.forEach(p => releaseToPool(p));
                xpOrbPool.forEach(o => releaseToPool(o));
                damageNumberPool.forEach(dn => releaseToPool(dn));

                gameTime = 0; frameCount = 0;
                score = { kills: 0, time: 0 };
                screenShake = { intensity: 0, duration: 0 };
                
                waveNumber = 0;
                waveEnemiesRemaining = 0;
                waveCooldownTimer = 0;
                startNextWave();

                setGameState('playing');
            }

            function startNextWave() {
                waveNumber++;

                // A CADA 5 ONDAS, UMA ONDA DE BOSS
                if (waveNumber > 0 && waveNumber % 5 === 0) {
                    showTemporaryMessage(`BOSS - ONDA ${waveNumber}`, "red");
                    enemies.push(new BossEnemy(player.x + canvas.width / 2 + 100, player.y - 100));
                    waveEnemiesRemaining = 1;
                    currentWaveConfig = { enemies: [], eliteChance: 0 };
                    return;
                }

                // Ondas pré-definidas
                if (waveNumber <= WAVE_CONFIGS.length) {
                    const waveIndex = waveNumber - 1;
                    currentWaveConfig = JSON.parse(JSON.stringify(WAVE_CONFIGS[waveIndex]));
                } else { // Geração de Ondas Infinitas
                    showTemporaryMessage(`ONDA ${waveNumber}! (Infinita)`, "cyan");
                    // ALTERAÇÃO 3: Adicionado 'reaper' ao pool de inimigos infinitos
                    const enemyTypes = ['chaser', 'speeder', 'tank', 'shooter', 'bomber', 'healer', 'summoner', 'reaper']; 
                    const typesInThisWave = Math.min(2 + Math.floor(waveNumber / 7), 5);
                    
                    currentWaveConfig = { enemies: [], eliteChance: Math.min(0.05 + (waveNumber - WAVE_CONFIGS.length) * 0.01, 0.25) };

                    let typesAdded = new Set();
                    for(let i = 0; i < typesInThisWave; i++) {
                        let enemyType;
                        do {
                           enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
                        } while (typesAdded.has(enemyType));
                        typesAdded.add(enemyType);

                        const baseCount = 5;
                        const enemyCount = baseCount + Math.floor(waveNumber * 0.8); 
                        
                        currentWaveConfig.enemies.push({
                            type: enemyType,
                            count: enemyCount,
                            spawnInterval: Math.max(20, 100 - waveNumber * 2)
                        });
                    }
                }

                waveEnemiesRemaining = 0;
                currentWaveConfig.enemies.forEach(enemyType => {
                    waveEnemiesRemaining += enemyType.count;
                });

                enemySpawnTimer = 0;
                if (waveNumber <= WAVE_CONFIGS.length) {
                    showTemporaryMessage(`ONDA ${waveNumber}!`, "gold");
                }
                if (DEBUG_MODE) console.log(`Iniciando Onda ${waveNumber}. Total de inimigos: ${waveEnemiesRemaining}`);
            }

            function spawnEnemies() {
                if (waveEnemiesRemaining <= 0 && enemies.length === 0) {
                    if (waveCooldownTimer <= 0) {
                        waveCooldownTimer = 180; // 3 segundos de pausa entre ondas
                        showTemporaryMessage("PAUSA ENTRE ONDAS", "white");
                        if (DEBUG_MODE) console.log("Onda concluída! Próxima onda em 3 segundos...");
                    } else {
                        waveCooldownTimer--;
                        if (waveCooldownTimer <= 0) {
                            startNextWave();
                        }
                    }
                    return; // Não spawna inimigos se a onda acabou e está em cooldown
                }

                enemySpawnTimer--;
                if (enemySpawnTimer <= 0 && waveEnemiesRemaining > 0) {
                    let x, y;
                    const spawnSide = Math.floor(Math.random() * 4); // 0: Esquerda, 1: Direita, 2: Topo, 3: Fundo

                    const spawnMargin = 50; // Distância extra da borda da tela
                    const camX = camera.x;
                    const camY = camera.y;
                    const camW = canvas.width;
                    const camH = canvas.height;

                    if (spawnSide === 0) { // Esquerda
                        x = camX - spawnMargin;
                        y = camY + Math.random() * camH;
                    } else if (spawnSide === 1) { // Direita
                        x = camX + camW + spawnMargin;
                        y = camY + Math.random() * camH;
                    } else if (spawnSide === 2) { // Topo
                        x = camX + Math.random() * camW;
                        y = camY - spawnMargin;
                    } else { // Fundo
                        x = camX + Math.random() * camW;
                        y = camY + camH + spawnMargin;
                    }
                    
                    const availableEnemyTypes = currentWaveConfig.enemies.filter(e => e.count > 0);
                    if (availableEnemyTypes.length === 0) {
                        return;
                    }
                    const selectedEnemyConfig = availableEnemyTypes[Math.floor(Math.random() * availableEnemyTypes.length)];
                    let enemyType = selectedEnemyConfig.type;
                    
                    const isElite = Math.random() < currentWaveConfig.eliteChance;

                    enemies.push(new Enemy(x, y, enemyType, isElite));
                    selectedEnemyConfig.count--;

                    enemySpawnTimer = selectedEnemyConfig.spawnInterval;
                }
            }

            function chainLightningEffect(source, initialTarget, levelData) {
                let currentTarget = initialTarget;
                let targetsHit = new Set([currentTarget]);
                let lastPosition = { x: source.x, y: source.y };

                for (let i = 0; i <= levelData.chains; i++) {
                    if (!currentTarget) break;

                    // Causa dano e cria o efeito visual
                    currentTarget.takeDamage(levelData.damage * player.damageModifier);
                    createLightningBolt(lastPosition, currentTarget);

                    lastPosition = { x: currentTarget.x, y: currentTarget.y };
                    let nextTarget = null;
                    let nearestDistSq = Infinity;

                    // Encontra o próximo alvo mais próximo que ainda não foi atingido
                    for (const enemy of enemies) {
                        if (!targetsHit.has(enemy) && !enemy.isDead) {
                            const distSq = Math.hypot(currentTarget.x - enemy.x, currentTarget.y - enemy.y);
                            if (distSq < levelData.chainRadius * levelData.chainRadius && distSq < nearestDistSq) {
                                nearestDistSq = distSq;
                                nextTarget = enemy;
                            }
                        }
                    }
                    
                    currentTarget = nextTarget;
                    if(currentTarget) targetsHit.add(currentTarget);
                }
            }

            function createLightningBolt(startPos, endPos) {
                // Cria partículas para simular o raio
                const dx = endPos.x - startPos.x;
                const dy = endPos.y - startPos.y;
                const dist = Math.hypot(dx, dy);
                const segments = Math.floor(dist / 10);
                for (let i = 0; i < segments; i++) {
                    const t = i / segments;
                    const x = startPos.x + dx * t + (Math.random() - 0.5) * 10;
                    const y = startPos.y + dy * t + (Math.random() - 0.5) * 10;
                    getFromPool(particlePool, x, y, '#ADD8E6', 1.5); // Azul claro
                }
            }

            function handleCollisions() {
                handlePlayerProjectiles(qtree);
                handlePlayerCollisions(qtree);
                handleEnemyProjectiles();
            }

            function handlePlayerProjectiles(qtree) { 
                if (!projectilePool) return;

                for (const proj of projectilePool) {
                    if (!proj.active) continue;

                    let searchRadius = proj.radius + 30;
                    let range = new Rectangle(proj.x - searchRadius, proj.y - searchRadius, searchRadius * 2, searchRadius * 2);
                    let nearbyEnemies = qtree.query(range);

                    for (let enemy of nearbyEnemies) {
                        if (proj.isDead || proj.piercedEnemies.has(enemy)) continue;

                        if (Math.hypot(proj.x - enemy.x, proj.y - enemy.y) < proj.radius + enemy.radius) {
                            enemy.takeDamage(proj.damage);
                            enemy.applyKnockback(proj.x, proj.y, CONFIG.ENEMY_KNOCKBACK_FORCE);
                            proj.piercedEnemies.add(enemy);
                            if (proj.piercedEnemies.size >= proj.pierce + 1) {
                                proj.isDead = true;
                                releaseToPool(proj);
                                break;
                            }
                        }
                    }
                }
            }

            function handlePlayerCollisions(qtree) {
                if (!player) return;

                let searchRadius = player.radius + 50;
                let range = new Rectangle(player.x - searchRadius, player.y - searchRadius, searchRadius * 2, searchRadius * 2);
                let nearbyEnemies = qtree.query(range);
                
                for (let enemy of nearbyEnemies) {
                    if (enemy.isDead) continue;
                    if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < player.radius + enemy.radius) {
                        player.takeDamage(enemy.damage);
                        const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
                        enemy.x += Math.cos(angle) * 15;
                        enemy.y += Math.sin(angle) * 15;
                    }
                }
            }

            function handleEnemyProjectiles() {
                if (!enemyProjectilePool || !player) return;

                for (const eProj of enemyProjectilePool) {
                    if (!eProj.active) continue;
                    if (Math.hypot(player.x - eProj.x, player.y - eProj.y) < player.radius + eProj.radius) {
                        player.takeDamage(eProj.damage);
                        for (let i = 0; i < 10; i++) {
                            if (particlePool) getFromPool(particlePool, eProj.x, eProj.y, 'orange', 1.5);
                        }
                        eProj.isDead = true;
                        releaseToPool(eProj);
                    }
                }
            }
            
            let demoPlayer;

            // OTIMIZAÇÃO: Função genérica para remover entidades mortas de forma eficiente
            function removeDeadEntities(array) {
                for (let i = array.length - 1; i >= 0; i--) {
                    if (array[i].isDead) {
                        array.splice(i, 1);
                    }
                }
            }

            function updateGame(deltaTime) {
                gameTime += deltaTime; 
                frameCount++;

                // Redefinir e preencher o Quadtree em cada frame
                const worldBounds = new Rectangle(-CONFIG.WORLD_BOUNDS.width, -CONFIG.WORLD_BOUNDS.height, CONFIG.WORLD_BOUNDS.width * 2, CONFIG.WORLD_BOUNDS.height * 2);
                qtree = new Quadtree(worldBounds, 4); 

                for (const enemy of enemies) {
                    if (!enemy.isDead) {
                        qtree.insert(enemy);
                    }
                }

                if (player) player.update();
                if (camera) camera.update();
                
                enemies.forEach(e => e.update());
                for (const p of projectilePool) { if (p.active) p.update(); }
                for (const p of enemyProjectilePool) { if (p.active) p.update(); }
                for (const o of xpOrbPool) { if (o.active) o.update(); }
                for (const p of particlePool) { if (p.active) p.update(); }
                activeDamageNumbers.forEach(dn => dn.update());

                powerUps.forEach(p => p.update());
                activeVortexes.forEach(v => v.update());
                activeStaticFields.forEach(sf => sf.update());

                spawnEnemies(); 
                handleCollisions(); 
                
                // OTIMIZAÇÃO: Substituindo .filter() por loops `for` reversos com `splice()`
                removeDeadEntities(enemies);
                removeDeadEntities(powerUps);
                removeDeadEntities(activeVortexes);
                removeDeadEntities(activeStaticFields);
                removeDeadEntities(activeDamageNumbers);

                if (screenShake.duration > 0) {
                    screenShake.duration--;
                    if (screenShake.duration <= 0) screenShake.intensity = 0;
                }
            }
            
            function drawGame() {
                // ALTERAÇÃO 4a: Lógica do Parallax melhorada
                if (player) {
                    // Camada 1 (nebulosa) - movimento muito lento
                    const parallaxX1 = -camera.x * 0.02;
                    const parallaxY1 = -camera.y * 0.02;

                    // Camada 2 (estrelas médias) - movimento médio
                    const parallaxX2 = -camera.x * 0.05;
                    const parallaxY2 = -camera.y * 0.05;

                    // Camada 3 (estrelas próximas) - movimento mais rápido
                    const parallaxX3 = -camera.x * 0.1;
                    const parallaxY3 = -camera.y * 0.1;

                    // Combina todas as posições numa única string
                    gameContainer.style.backgroundPosition = 
                        `${parallaxX1}px ${parallaxY1}px, ` + // Nebulosa
                        `${parallaxX2}px ${parallaxY2}px, ` + // Estrelas 1
                        `${parallaxX3}px ${parallaxY3}px, ` + // Estrelas 2
                        `${parallaxX3 * 1.5}px ${parallaxY3 * 1.5}px`; // Estrelas 3 (ainda mais rápidas)
                }
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                
                // ALTERAÇÃO 4b: Desenhar Partículas de Ambiente
                ctx.save();
                ctx.translate(-camera.x * 0.5, -camera.y * 0.5); // Um parallax mais lento para elas
                ambientParticles.forEach(p => {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
                    ctx.fill();
                });
                ctx.restore();


                if (screenShake.intensity > 0) {
                    ctx.translate((Math.random() - 0.5) * screenShake.intensity, (Math.random() - 0.5) * screenShake.intensity);
                }
                
                platforms.forEach(p => p.draw(ctx));

                for (const o of xpOrbPool) { if (o.active) o.draw(ctx); }
                powerUps.forEach(p => p.draw(ctx));
                activeVortexes.forEach(v => v.update());
                activeStaticFields.forEach(sf => sf.update());
                enemies.forEach(e => e.draw(ctx));
                for (const p of projectilePool) { if (p.active) p.draw(ctx); }
                for (const p of enemyProjectilePool) { if (p.active) p.draw(ctx); }
                for (const p of particlePool) { if (p.active) p.draw(ctx); }
                
                activeDamageNumbers.forEach(dn => dn.draw(ctx));
                
                if (player) player.draw(ctx);
                
                if (player && player.skills && player.skills['orbital_shield']) {
                    const skillState = player.skills['orbital_shield'];
                    const levelData = SKILL_DATABASE['orbital_shield'].levels[skillState.level - 1];
                    skillState.orbs.forEach(orb => {
                        const orbX = player.x + Math.cos(orb.angle) * levelData.radius;
                        const orbY = player.y + Math.sin(orb.angle) * levelData.radius;
                        const screenLeft = camera.x;
                        const screenRight = camera.x + canvas.width;
                        if (orbX + 10 < screenLeft || orbX - 10 > screenRight) {
                            return;
                        }
                        ctx.save();
                        ctx.translate(orbX - camera.x, orbY - camera.y);
                        ctx.beginPath();
                        ctx.arc(0, 0, 10, 0, Math.PI * 2);
                        ctx.fillStyle = 'lightblue';
                        ctx.fill();
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                        ctx.restore();
                    });
                }

                ctx.restore();
                updateHUD();
            }
            
            function gameLoop(currentTime) {
                requestAnimationFrame(gameLoop);

                if (!lastFrameTime) lastFrameTime = currentTime;
                const deltaTime = (currentTime - lastFrameTime) / 1000.0;
                lastFrameTime = currentTime;

                if (gameState === 'menu') {
                    if (!demoPlayer) { 
                        demoPlayer = new DemoPlayer(canvas.width / 2, canvas.height / 2);
                    }
                    demoPlayer.update();
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    demoPlayer.draw(ctx);
                }
                
                if (gameState === 'playing') {
                    try {
                        updateGame(deltaTime);
                    } catch (error) {
                        if (DEBUG_MODE) console.error("Erro em updateGame:", error);
                        setGameState('paused');
                    }
                }
                
                if (gameState !== 'menu') {
                     try {
                        drawGame();
                    } catch (error) {
                        if (DEBUG_MODE) console.error("Erro em drawGame:", error);
                    }
                }
            }

            // --- UI E GESTÃO DE ESTADO DO JOGO ---
            const ui = {
                layer: document.getElementById('ui-layer'),
                mainMenu: document.getElementById('main-menu'),
                pauseMenu: document.getElementById('pause-menu'),
                gameOverScreen: document.getElementById('game-over-screen'),
                levelUpScreen: document.getElementById('level-up-screen'),
                guideScreen: document.getElementById('guide-screen'),
                rankScreen: document.getElementById('rank-screen'),
                upgradesMenu: document.getElementById('upgrades-menu'),
                hud: document.getElementById('hud'),
                temporaryMessage: document.getElementById('temporary-message'),
                dashButtonMobile: document.getElementById('dash-button-mobile')
            };

            for (const key in ui) {
                if (!ui[key]) {
                    console.error(`Crítico: Elemento da UI '${key}' não encontrado!`);
                    if (debugStatus) {
                        debugStatus.style.color = 'red';
                        debugStatus.textContent = `Erro Crítico: Elementos do jogo '${key}' não encontrado! Verifique a consola.`;
                    }
                    return;
                }
            }

            function setGameState(newState) {
                if (['menu', 'paused', 'levelUp', 'gameOver', 'guide', 'rank', 'upgrades'].includes(newState) && newState !== gameState) {
                    SoundManager.play('uiClick', 'C6'); 
                }

                if (newState === 'playing' && demoPlayer) {
                    demoPlayer = null; 
                }
                
                gameState = newState;
                
                if (newState === 'playing' && debugStatus) {
                    debugStatus.style.display = 'none';
                } else if (debugStatus) {
                    debugStatus.style.display = 'block';
                }

                const isMenuState = ['menu', 'levelUp', 'gameOver', 'guide', 'rank', 'upgrades'].includes(newState);
                
                ui.layer.style.backgroundColor = (newState === 'menu') ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.7)';
                ui.layer.classList.toggle('active-menu', isMenuState || newState === 'paused');
                ui.hud.classList.toggle('hidden', isMenuState || newState !== 'playing');
                ui.dashButtonMobile.classList.toggle('hidden', !isMobile || isMenuState || gameState !== 'playing');

                for (const panelKey in ui) {
                    if (ui[panelKey] && ui[panelKey].classList && panelKey !== 'layer' && panelKey !== 'hud' && panelKey !== 'temporaryMessage' && panelKey !== 'dashButtonMobile') {
                        ui[panelKey].classList.add('hidden');
                    }
                }

                if (newState === 'menu') {
                    ui.mainMenu.classList.remove('hidden');
                    updateGemDisplay();
                } else if (newState === 'paused') {
                    ui.pauseMenu.classList.remove('hidden');
                    ui.hud.classList.remove('hidden');
                } else if (newState === 'gameOver') {
                    // ALTERAÇÃO 3: Usar gameTime para o tempo final (corrigido para usar a variável global correta)
                    document.getElementById('final-time').innerText = formatTime(Math.floor(gameTime / (1000 / 60)));
                    document.getElementById('final-kills').innerText = score.kills;
                    ui.gameOverScreen.classList.remove('hidden');
                    saveScore();
                } else if (newState === 'levelUp') {
                    populateLevelUpOptions();
                    ui.levelUpScreen.classList.remove('hidden');
                } else if (newState === 'guide') {
                    ui.guideScreen.classList.remove('hidden');
                } else if (newState === 'rank') {
                    showRank();
                    ui.rankScreen.classList.remove('hidden');
                } else if (newState === 'upgrades') {
                    populateUpgradesMenu();
                    ui.upgradesMenu.classList.remove('hidden');
                }
            }

            function updateHUD() {
                if (player) {
                    document.getElementById('health-bar').style.width = `${(player.health / player.maxHealth) * 100}%`;
                    document.getElementById('xp-bar').style.width = `${(player.xp / player.xpToNextLevel) * 100}%`;
                }
                // Converte o tempo do jogo de "delta-time-frames" para segundos
                const gameTimeInSeconds = gameTime / (1000.0 / 60.0);
                document.getElementById('timer').innerText = formatTime(Math.floor(gameTimeInSeconds));
                
                updateSkillsHUD();
            }

            function updateGemDisplay() {
                document.getElementById('gem-counter').textContent = playerGems;
            }

            function formatTime(totalSeconds) {
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }

            function showTemporaryMessage(message, color = "white") {
                const tempMsg = ui.temporaryMessage;
                tempMsg.textContent = message;
                tempMsg.style.color = color;
                tempMsg.classList.add('show');
                setTimeout(() => {
                    tempMsg.classList.remove('show');
                }, CONFIG.TEMPORARY_MESSAGE_DURATION / 60 * 1000);
            }

            function populateLevelUpOptions() {
                const container = document.getElementById('skill-options');
                container.innerHTML = '';
                
                let options = [];
                for(const skillId in player.skills){
                    const skillData = SKILL_DATABASE[skillId];
                    if(player.skills[skillId].level < skillData.levels.length) options.push(skillId);
                }
                for(const skillId in SKILL_DATABASE){
                    if(!player.skills[skillId] && SKILL_DATABASE[skillId].type !== 'utility' && !options.includes(skillId)) {
                        options.push(skillId);
                    }
                }
                options.sort(() => 0.5 - Math.random());
                if (options.length > 0 && options.length < 3 && !options.includes('heal')) {
                    options.push('heal');
                }
                
                options.slice(0, 3).forEach(skillId => {
                    const skill = SKILL_DATABASE[skillId]; 
                    const card = document.createElement('div');
                    card.className = 'skill-card';
                    const currentLevel = player.skills[skillId]?.level || 0;
                    let levelText = skill.type !== 'utility' || (skill.levels && skill.levels.length > 1) ? ` (Nível ${currentLevel + 1})` : '';
                    let descText = skill.desc || (skill.levels && skill.levels[currentLevel] ? skill.levels[currentLevel].desc : '');

                    card.innerHTML = `<h3>${skill.name}${levelText}</h3><p>${descText}</p>`;
                    card.onclick = (event) => {
                        event.stopPropagation();
                        player.addSkill(skillId);
                        setGameState('playing');
                        lastFrameTime = 0;
                    };
                    container.appendChild(card);
                });
            }
            
            function updateSkillsHUD() {
                if (!player || !player.skills) return;
            
                for (const skillId in player.skills) {
                    const skillState = player.skills[skillId];
                    const skillData = SKILL_DATABASE[skillId];
            
                    if (!skillState.hudElement) continue; 
            
                    if (skillData.type !== 'passive' && skillData.type !== 'orbital' && skillState.timer > 0) {
                        skillState.hudElement.classList.add('on-cooldown');
                    } else {
                        skillState.hudElement.classList.remove('on-cooldown');
                    }
                }
            }
            
            function saveScore() {
                const currentTimeInSeconds = Math.floor(gameTime / (1000.0 / 60.0));
                const bestTime = parseInt(localStorage.getItem('bestTime') || '0');
                const totalKills = parseInt(localStorage.getItem('totalKills') || '0');

                if (currentTimeInSeconds > bestTime) {
                    localStorage.setItem('bestTime', currentTimeInSeconds);
                }
                localStorage.setItem('totalKills', totalKills + score.kills);
            }


            function showRank() {
                document.getElementById('rank-time').innerText = formatTime(parseInt(localStorage.getItem('bestTime') || '0'));
                document.getElementById('rank-total-kills').innerText = parseInt(localStorage.getItem('totalKills') || '0');
            }

            function populateUpgradesMenu() {
                const container = document.getElementById('upgrades-options');
                container.innerHTML = '';
                document.getElementById('gem-counter-upgrades').textContent = playerGems;

                for (const key in PERMANENT_UPGRADES) {
                    const upgrade = PERMANENT_UPGRADES[key];
                    const currentLevel = playerUpgrades[key] || 0;
                    const maxLevel = upgrade.levels.length;
                    
                    const card = document.createElement('div');
                    card.className = 'skill-card';
                    
                    if (currentLevel < maxLevel) {
                        const nextLevelData = upgrade.levels[currentLevel];
                        card.innerHTML = `<h3>${upgrade.name} (Nível ${currentLevel}/${maxLevel})</h3>
                                          <p>${upgrade.desc(nextLevelData.effect)}</p>
                                          <p>Custo: <strong>${nextLevelData.cost} Gemas</strong></p>`;
                        if (playerGems >= nextLevelData.cost) {
                            card.style.cursor = 'pointer';
                            card.onclick = () => {
                                playerGems -= nextLevelData.cost;
                                playerUpgrades[key]++;
                                savePermanentData();
                                SoundManager.play('levelUp', ['C5', 'G5']); // Som de sucesso
                                populateUpgradesMenu();
                                updateGemDisplay();
                            };
                        } else {
                            card.style.opacity = 0.5;
                            card.style.cursor = 'not-allowed';
                        }
                    } else {
                        card.innerHTML = `<h3>${upgrade.name} (Nível MÁXIMO)</h3>`;
                        card.style.opacity = 0.7;
                        card.style.cursor = 'default';
                    }
                    container.appendChild(card);
                }
            }

            // --- CONTROLOS MÓVEIS (JOYSTICKS DINÂMICOS) ---
            function handleMobileInput() {
                const existingJoysticks = gameContainer.querySelectorAll('.joystick-base');
                existingJoysticks.forEach(joy => joy.remove());
                activeTouches.clear();

                gameContainer.addEventListener('touchstart', (e) => {
                    if (e.target.classList.contains('ui-button')) {
                        return; 
                    }
                    if (gameState !== 'playing') return;
                    e.preventDefault();

                    Array.from(e.changedTouches).forEach(touch => {
                        const joystickType = 'move'; 
                        
                        let existingJoystick = false;
                        for (let [id, joy] of activeTouches) {
                            if (joy.joystickType === joystickType) {
                                existingJoystick = true;
                                break;
                            }
                        }
                        if (existingJoystick) {
                            return; 
                        }

                        const base = document.createElement('div');
                        base.className = 'joystick-base';
                        const handle = document.createElement('div');
                        handle.className = 'joystick-handle';
                        base.appendChild(handle);
                        
                        base.style.left = `${touch.clientX - CONFIG.JOYSTICK_RADIUS}px`;
                        base.style.top = `${touch.clientY - CONFIG.JOYSTICK_RADIUS}px`;
                        gameContainer.appendChild(base);

                        activeTouches.set(touch.identifier, {
                            joystickType: joystickType,
                            startX: touch.clientX,
                            startY: touch.clientY,
                            baseElement: base,
                            handleElement: handle,
                        });
                    });
                }, { passive: false });

                gameContainer.addEventListener('touchmove', (e) => {
                    if (gameState !== 'playing') return;
                    e.preventDefault();

                    Array.from(e.touches).forEach(touch => {
                        const joy = activeTouches.get(touch.identifier);
                        if (!joy) return;

                        const dx = touch.clientX - joy.startX;
                        const dy = touch.clientY - joy.startY;
                        const dist = Math.hypot(dx, dy);
                        const angle = Math.atan2(dy, dx);
                        
                        const limitedDist = Math.min(dist, CONFIG.JOYSTICK_RADIUS);
                        const handleX = Math.cos(angle) * limitedDist;
                        const handleY = Math.sin(angle) * limitedDist;

                        joy.handleElement.style.transform = `translate(${handleX}px, ${handleY}px)`;
                        
                        const normalizedDx = limitedDist > CONFIG.JOYSTICK_DEAD_ZONE ? dx / CONFIG.JOYSTICK_RADIUS : 0;
                        const normalizedDy = limitedDist > CONFIG.JOYSTICK_DEAD_ZONE ? dy / CONFIG.JOYSTICK_RADIUS : 0;

                        movementVector = { x: normalizedDx, y: normalizedDy };
                    });
                }, { passive: false });

                gameContainer.addEventListener('touchend', (e) => {
                    Array.from(e.changedTouches).forEach(touch => {
                        const joy = activeTouches.get(touch.identifier);
                        if (joy) {
                            joy.baseElement.remove();
                            activeTouches.delete(touch.identifier);
                            movementVector = { x: 0, y: 0 };
                        }
                    });
                });
                gameContainer.addEventListener('touchcancel', (e) => {
                    Array.from(e.changedTouches).forEach(touch => {
                        const joy = activeTouches.get(touch.identifier);
                        if (joy) {
                            joy.baseElement.remove();
                            activeTouches.delete(touch.identifier);
                            movementVector = { x: 0, y: 0 };
                        }
                    });
                });
            }

            // --- FUNÇÃO DE ECRÃ INTEIRO ---
            function toggleFullscreen() {
                const elem = document.documentElement;
                try {
                    if (!document.fullscreenElement) {
                        if (elem.requestFullscreen) {
                            elem.requestFullscreen();
                        } else if (elem.mozRequestFullScreen) { /* Firefox */
                            elem.mozRequestFullScreen();
                        } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari e Opera */
                            elem.webkitRequestFullscreen();
                        } else if (elem.msRequestFullscreen) { /* IE/Edge */
                            elem.msRequestFullscreen();
                        }
                    } else {
                        if (document.exitFullscreen) {
                            document.exitFullscreen();
                        } else if (document.mozCancelFullScreen) { /* Firefox */
                            document.mozCancelFullScreen();
                        } else if (document.webkitExitFullscreen) { /* Chrome, Safari e Opera */
                            document.webkitExitFullscreen();
                        } else if (document.msExitFullscreen) { /* IE/Edge */
                            document.msExitFullscreen();
                        }
                    }
                } catch (e) {
                    if (DEBUG_MODE) console.error("Erro ao tentar alternar ecrã inteiro:", e);
                }
            }

            // --- LISTENERS DE EVENTOS GERAIS ---
            function setupEventListeners() {
                window.addEventListener('resize', () => {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                });
                window.dispatchEvent(new Event('resize'));

                if (isMobile) {
                    handleMobileInput();
                    ui.dashButtonMobile.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        if (gameState === 'playing' && player) {
                            player.dash();
                        }
                    });
                } else { 
                    window.addEventListener('keydown', (e) => {
                        const key = e.key.toLowerCase();
                        keys[key] = true;
                        if(key === 'shift') keys['shift'] = true;

                        if (e.key === 'Escape' && gameState === 'playing') {
                            setGameState('paused');
                        } else if (e.key === 'Escape' && gameState === 'paused') {
                            lastFrameTime = 0;
                            setGameState('playing');
                        }
                    });
                    window.addEventListener('keyup', (e) => {
                        const key = e.key.toLowerCase();
                        keys[key] = false;
                        if(key === 'shift') keys['shift'] = false;
                    });
                }
                window.addEventListener('blur', () => {
                    if(gameState === 'playing') setGameState('paused');
                });
                
                const startGame = () => {
                    initGame();
                    lastFrameTime = 0; 
                };
                
                document.getElementById('play-button').onclick = startGame;
                document.getElementById('restart-button-pause').onclick = startGame;
                document.getElementById('restart-button-gameover').onclick = startGame;

                document.getElementById('resume-button').onclick = () => {
                    lastFrameTime = 0; 
                    setGameState('playing');
                };

                document.getElementById('back-to-menu-button-pause').onclick = () => setGameState('menu');
                document.getElementById('back-to-menu-button-gameover').onclick = () => setGameState('menu');
                document.getElementById('guide-button').onclick = () => setGameState('guide');
                document.getElementById('back-from-guide-button').onclick = () => setGameState('menu');
                document.getElementById('rank-button').onclick = () => {
                    showRank();
                    setGameState('rank');
                };
                document.getElementById('back-from-rank-button').onclick = () => setGameState('menu');
                document.getElementById('pause-button').onclick = () => { if(gameState === 'playing') setGameState('paused'); };
                document.getElementById('fullscreen-button').onclick = toggleFullscreen;
                
                document.getElementById('upgrades-button').onclick = () => {
                    populateUpgradesMenu();
                    setGameState('upgrades');
                };
                document.getElementById('back-from-upgrades-button').onclick = () => setGameState('menu');
            }

            setupEventListeners();
            setGameState('menu');

            // Inicia o game loop principal
            let initialTime = performance.now();
            lastFrameTime = initialTime;
            requestAnimationFrame(gameLoop);


            if (debugStatus) debugStatus.textContent = "Jogo Carregado. Clique para jogar!";

        } catch (initializationError) {
            console.error("Erro Crítico na Inicialização:", initializationError);
            const debugStatus = document.getElementById('debug-status');
            if (debugStatus) {
                debugStatus.style.color = 'red';
                debugStatus.textContent = 'Erro Crítico na Inicialização! Verifique a consola.';
            }
        }
    };