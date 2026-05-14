const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const MAP_WIDTH = 1600;
const MAP_HEIGHT = 900;
const HEX_SIZE = 35;
const TICK_MS = 50;
const ACTIONS_PER_TURN = 10;

const FACCIONES = [
    { id: 'blue', nombre: 'Federacion Azul' },
    { id: 'red', nombre: 'Imperio Rojo' },
    { id: 'green', nombre: 'Reino Verde' },
    { id: 'yellow', nombre: 'Union Amarilla' },
    { id: 'purple', nombre: 'Sultanato Purpura' },
    { id: 'orange', nombre: 'Emirato Naranja' },
    { id: 'cyan', nombre: 'Liga Cian' },
    { id: 'pink', nombre: 'Dominion Rosa' }
];

const tecnologias = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'public', 'tecnologias.json'), 'utf8')
).tecnologias;
const BUILD_BASE_TECH_ID = tecnologias.find(t => String(t.nombre).toLowerCase().includes('alba'))?.id;
const TECH_EFFECTS = {
    agricultura: { goldMult: 1.0, desc: 'Duplica el oro ganado por turno.' },
    irrigacion: { scienceMult: 0.75, desc: 'Aumenta la ciencia ganada por turno.' },
    siderurgia: { damageMult: 0.4, desc: '+40% dano de tropas.' },
    infanteria_ligera: { speedMult: 0.08, desc: '+8% velocidad de tropas.' },
    escudos_bronce: { hpMult: 0.12, desc: '+12% vida de tropas.' },
    formacion_falange: { hpMult: 0.15, damageMult: 0.08, desc: '+15% vida y +8% dano.' },
    espadas_acero: { damageMult: 0.18, desc: '+18% dano de tropas.' },
    ballestas: { attackRange: 18, damageMult: 0.08, desc: '+18 alcance y +8% dano.' },
    polvora: { attackRange: 35, damageMult: 0.18, desc: 'Desbloquea artilleros y mejora el dano.' },
    mosquetes: { attackRange: 30, damageMult: 0.2, desc: 'Desbloquea mosqueteros y mejora alcance.' },
    bayonetas: { hpMult: 0.08, damageMult: 0.16, desc: '+8% vida y +16% dano.' },
    rifles_repeticion: { attackRange: 35, damageMult: 0.2, desc: '+35 alcance y +20% dano.' },
    blindaje_personal: { hpMult: 0.35, desc: '+35% vida de tropas.' },

    domesticacion: { speedMult: 0.1, desc: '+10% velocidad de tropas.' },
    estribos: { speedMult: 0.12, desc: '+12% velocidad de tropas.' },
    caballeria_pesada: { hpMult: 0.12, damageMult: 0.12, desc: '+12% vida y dano.' },
    rueda_dentada: { production: 0.15, desc: '+15% produccion de unidades.' },
    motor_vapor: { speedMult: 0.15, production: 0.1, desc: '+15% velocidad y +10% produccion.' },
    chasis_hierro: { hpMult: 0.16, desc: '+16% vida de tropas.' },
    combustion_interna: { speedMult: 0.18, desc: '+18% velocidad de tropas.' },
    blindaje_tanque: { hpMult: 0.45, damageMult: 0.2, desc: 'Desbloquea tanques, +45% vida y +20% dano.' },
    traccion_oruga: { speedMult: 0.2, desc: '+20% velocidad de tanques/tropas.' },
    blindaje_reactivo: { hpMult: 0.45, desc: '+45% vida de tropas.' },

    navegacion_costera: { goldMult: 0.15, vision: 20, desc: '+15% oro y +20 vision.' },
    velas_latinas: { speedMult: 0.08, goldMult: 0.1, desc: '+8% velocidad y +10% oro.' },
    astilleros: { production: 0.2, buildCostMult: -0.08, desc: '+20% produccion y bases mas baratas.' },
    carabelas: { vision: 35, goldMult: 0.15, desc: '+35 vision y +15% oro.' },
    'cañones_navales': { damageMult: 0.25, attackRange: 20, desc: '+25% dano y +20 alcance.' },
    fragatas: { speedMult: 0.12, damageMult: 0.12, desc: '+12% velocidad y dano.' },
    acorazados: { hpMult: 0.25, damageMult: 0.18, desc: '+25% vida y +18% dano.' },
    motores_diesel_marinos: { goldMult: 0.2, speedMult: 0.12, desc: '+20% oro y +12% velocidad.' },
    sonar: { vision: 80, desc: '+80 vision.' },
    propulsion_nuclear: { speedMult: 0.2, goldMult: 0.25, desc: '+20% velocidad y +25% oro.' },

    trueque: { goldMult: 0.2, desc: '+20% oro por turno.' },
    moneda: { goldMult: 0.25, desc: '+25% oro por turno.' },
    mercados: { goldMult: 0.3, recruitCostMult: -0.05, desc: '+30% oro y reclutar mas barato.' },
    rutas_comerciales: { goldMult: 0.35, speedMult: 0.1, desc: '+35% oro y +10% velocidad.' },
    banca: { goldMult: 0.45, desc: '+45% oro por turno.' },
    sociedades_anonimas: { goldMult: 0.35, buildCostMult: -0.08, desc: '+35% oro y construir mas barato.' },
    bolsa_valores: { goldMult: 0.5, desc: '+50% oro por turno.' },
    patron_oro: { goldMult: 0.6, desc: '+60% oro por turno.' },
    banca_digital: { goldMult: 0.7, researchCostMult: -0.04, desc: '+70% oro e investigar mas barato.' },
    criptoeconomia: { goldMult: 1.0, researchCostMult: -0.06, desc: '+100% oro e investigar mas barato.' },

    escritura: { scienceMult: 0.2, desc: '+20% ciencia por turno.' },
    alfabeto: { scienceMult: 0.25, desc: '+25% ciencia por turno.' },
    bibliotecas: { scienceMult: 0.35, desc: '+35% ciencia por turno.' },
    universidades: { scienceMult: 0.45, researchCostMult: -0.04, desc: '+45% ciencia e investigar mas barato.' },
    imprenta: { scienceMult: 0.5, desc: '+50% ciencia por turno.' },
    metodo_cientifico: { scienceMult: 0.6, researchCostMult: -0.05, desc: '+60% ciencia e investigar mas barato.' },
    laboratorios: { scienceMult: 0.75, desc: '+75% ciencia por turno.' },
    computacion_analogica: { scienceMult: 0.9, researchCostMult: -0.06, desc: '+90% ciencia e investigar mas barato.' },
    microchips: { scienceMult: 1.1, production: 0.15, desc: '+110% ciencia y +15% produccion.' },
    ia_cuantica: { scienceMult: 1.5, researchCostMult: -0.1, desc: '+150% ciencia e investigar mas barato.' },

    'albañileria': { buildBase: 1, baseHpMult: 0.15, desc: 'Permite construir bases y +15% vida de bases.' },
    acueductos: { baseHpMult: 0.2, scienceMult: 0.1, desc: '+20% vida de bases y +10% ciencia.' },
    calzadas: { speedMult: 0.15, buildCostMult: -0.05, desc: '+15% velocidad y bases mas baratas.' },
    puentes_arco: { baseHpMult: 0.25, speedMult: 0.08, desc: '+25% vida de bases y +8% velocidad.' },
    arquitectura_gotica: { baseHpMult: 0.35, desc: '+35% vida de bases.' },
    estructuras_acero: { baseHpMult: 0.45, buildCostMult: -0.05, desc: '+45% vida de bases y construir mas barato.' },
    hormigon_armado: { baseHpMult: 0.55, desc: '+55% vida de bases.' },
    rascacielos: { goldMult: 0.35, baseHpMult: 0.35, desc: '+35% oro y vida de bases.' },
    ciudades_inteligentes: { scienceMult: 0.45, goldMult: 0.25, desc: '+45% ciencia y +25% oro.' },
    arcologias: { scienceMult: 0.75, goldMult: 0.5, baseHpMult: 0.5, desc: '+75% ciencia, +50% oro y bases.' },

    mensajeria_caballo: { vision: 25, speedMult: 0.06, desc: '+25 vision y +6% velocidad.' },
    correo_postal: { scienceMult: 0.12, vision: 25, desc: '+12% ciencia y +25 vision.' },
    telegrafo: { vision: 40, speedMult: 0.08, desc: '+40 vision y +8% velocidad.' },
    telefono: { production: 0.12, vision: 35, desc: '+12% produccion y +35 vision.' },
    radio: { vision: 55, attackRange: 10, desc: '+55 vision y +10 alcance.' },
    television: { scienceMult: 0.2, goldMult: 0.15, desc: '+20% ciencia y +15% oro.' },
    satelites: { vision: 120, attackRange: 20, desc: '+120 vision y +20 alcance.' },
    internet: { scienceMult: 0.45, production: 0.15, desc: '+45% ciencia y +15% produccion.' },
    redes_5g: { speedMult: 0.18, vision: 80, desc: '+18% velocidad y +80 vision.' },
    telepatia_digital: { scienceMult: 0.9, speedMult: 0.25, vision: 140, desc: '+90% ciencia, +25% velocidad y +140 vision.' },

    aerostatica: { vision: 45, desc: '+45 vision.' },
    planeadores: { speedMult: 0.08, vision: 35, desc: '+8% velocidad y +35 vision.' },
    biplanos: { speedMult: 0.25, vision: 80, desc: 'Desbloquea tropas aereas, +25% velocidad y +80 vision.' },
    monoplanos_metal: { hpMult: 0.12, speedMult: 0.15, desc: '+12% vida y +15% velocidad.' },
    motores_reaccion: { speedMult: 0.3, damageMult: 0.12, desc: '+30% velocidad y +12% dano.' },
    aviacion_supersonica: { speedMult: 0.35, attackRange: 20, desc: '+35% velocidad y +20 alcance.' },
    sigilo_radar: { vision: 90, hpMult: 0.12, desc: '+90 vision y +12% vida.' },
    drones_autonomos: { production: 0.35, damageMult: 0.18, desc: '+35% produccion y +18% dano.' },
    motores_plasma: { speedMult: 0.45, damageMult: 0.25, desc: '+45% velocidad y +25% dano.' },
    anti_gravedad: { speedMult: 0.6, hpMult: 0.2, desc: '+60% velocidad y +20% vida.' },

    coheteria_basica: { attackRange: 45, damageMult: 0.25, desc: '+45 alcance y +25% dano.' },
    cohetes_multietapa: { attackRange: 55, vision: 40, desc: '+55 alcance y +40 vision.' },
    orbita_terrestre: { vision: 100, scienceMult: 0.25, desc: '+100 vision y +25% ciencia.' },
    alunizaje: { scienceMult: 0.35, goldMult: 0.15, desc: '+35% ciencia y +15% oro.' },
    estaciones_espaciales: { vision: 130, scienceMult: 0.45, desc: '+130 vision y +45% ciencia.' },
    mineria_asteroides: { goldMult: 0.9, desc: '+90% oro por turno.' },
    colonizacion_marte: { production: 0.55, baseHpMult: 0.35, desc: '+55% produccion y +35% bases.' },
    esfera_dyson: { goldMult: 1.5, scienceMult: 0.9, desc: '+150% oro y +90% ciencia.' },
    viaje_interestelar: { speedMult: 0.8, scienceMult: 1.2, desc: '+80% velocidad y +120% ciencia.' },
    ascension_estelar: { damageMult: 1.0, hpMult: 0.8, goldMult: 2.0, scienceMult: 2.0, desc: '+100% dano, +80% vida, +200% oro y ciencia.' },

    herboristeria: { hpRegen: 0.03, desc: 'Las tropas regeneran vida lentamente.' },
    anatomia: { hpMult: 0.12, hpRegen: 0.03, desc: '+12% vida y mas regeneracion.' },
    vacunas: { hpMult: 0.18, desc: '+18% vida de tropas.' },
    antibioticos: { hpRegen: 0.08, desc: 'Regeneracion de tropas mejorada.' },
    rayos_x: { hpMult: 0.12, vision: 45, desc: '+12% vida y +45 vision.' },
    genetica: { hpMult: 0.25, desc: '+25% vida de tropas.' },
    secuenciacion_adn: { hpMult: 0.22, hpRegen: 0.08, desc: '+22% vida y regeneracion.' },
    nanomedicina: { hpRegen: 0.18, hpMult: 0.18, desc: 'Gran regeneracion y +18% vida.' },
    clonacion_organos: { production: 0.45, hpMult: 0.25, desc: '+45% produccion y +25% vida.' },
    inmortalidad_digital: { hpRegen: 0.35, hpMult: 0.45, desc: 'Regeneracion extrema y +45% vida.' },

    fisica_nuclear: { damageMult: 0.35, nukeRadius: 40, desc: '+35% dano y mejora la bomba nuclear.' },
    bomba_nuclear: { nuke: 1, nukeRadius: 80, desc: 'Entrega una bomba nuclear.' }
};

const rooms = new Map();

function cleanRoomCode(code) {
    const value = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return value.slice(0, 8) || createRoomCode();
}

function createRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
}

function makeInv() {
    const inv = {};
    FACCIONES.forEach(f => inv[f.id] = []);
    return inv;
}

function makeCiencias() {
    const ciencias = {};
    FACCIONES.forEach(f => ciencias[f.id] = 0);
    return ciencias;
}

function makeRecursos() {
    const recursos = {};
    FACCIONES.forEach(f => recursos[f.id] = { oro: 150, tieneBomba: false });
    return recursos;
}

function makeRelaciones() {
    const relaciones = {};
    FACCIONES.forEach(f1 => {
        relaciones[f1.id] = {};
        FACCIONES.forEach(f2 => {
            if (f1.id === f2.id) relaciones[f1.id][f2.id] = 'Mismo';
            else relaciones[f1.id][f2.id] = 'Neutral';
        });
    });
    return relaciones;
}

function makeInvasionTargets() {
    const targets = {};
    FACCIONES.forEach(f => targets[f.id] = null);
    return targets;
}

function createRoom(code) {
    const room = {
        code,
        players: new Map(),
        socketFactions: new Map(),
        nextUnitId: 1,
        nextBaseId: 1,
        turno: 1,
        unidades: [],
        bases: [],
        territorios: {},
        relaciones: makeRelaciones(),
        invasionTargets: makeInvasionTargets(),
        inv: makeInv(),
        ciencias: makeCiencias(),
        recursos: makeRecursos(),
        lastSpawn: Date.now(),
        logs: [`Partida ${code} creada.`],
        loop: null
    };

    FACCIONES.forEach(f => {
        const centerX = 180 + Math.random() * (MAP_WIDTH - 360);
        const centerY = 120 + Math.random() * (MAP_HEIGHT - 240);
        for (let i = 0; i < 3; i++) {
            const x = centerX + Math.random() * 150 - 75;
            const y = centerY + Math.random() * 150 - 75;
            const base = {
                id: room.nextBaseId++,
                x,
                y,
                hp: 500,
                maxHp: 500,
                fId: f.id
            };
            room.bases.push(base);
            for (let j = 0; j < 2; j++) addUnit(room, base.x + 25 + j * 12, base.y + 25, f.id);
        }
    });

    generateTerritories(room);
    room.loop = setInterval(() => tickRoom(room), TICK_MS);
    rooms.set(code, room);
    return room;
}

function addLog(room, msg) {
    room.logs.unshift(msg);
    room.logs = room.logs.slice(0, 30);
}

function addUnit(room, x, y, fId) {
    const stats = unitStats(room, fId);
    const unit = {
        id: room.nextUnitId++,
        x,
        y,
        targetX: x,
        targetY: y,
        orderX: x,
        orderY: y,
        hasOrder: false,
        fId,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        attackCooldown: 0,
        type: stats.type
    };
    room.unidades.push(unit);
    return unit;
}

function hasTech(room, fId, techId) {
    return room.inv[fId].includes(techId);
}

function techTotals(room, fId) {
    const totals = {
        goldMult: 0,
        scienceMult: 0,
        damageMult: 0,
        hpMult: 0,
        speedMult: 0,
        baseHpMult: 0,
        recruitCostMult: 0,
        buildCostMult: 0,
        researchCostMult: 0,
        production: 0,
        attackRange: 0,
        vision: 0,
        hpRegen: 0,
        nukeRadius: 0
    };

    room.inv[fId].forEach(techId => {
        const effect = TECH_EFFECTS[techId];
        if (!effect) return;
        Object.keys(totals).forEach(key => {
            if (typeof effect[key] === 'number') totals[key] += effect[key];
        });
    });

    totals.recruitCostMult = Math.max(totals.recruitCostMult, -0.6);
    totals.buildCostMult = Math.max(totals.buildCostMult, -0.6);
    totals.researchCostMult = Math.max(totals.researchCostMult, -0.5);
    return totals;
}

function modifiedCost(baseCost, multiplier) {
    return Math.max(1, Math.ceil(baseCost * (1 + multiplier)));
}

function turnIncome(room, fId) {
    const effects = techTotals(room, fId);
    return {
        oro: Math.round(50 * ACTIONS_PER_TURN * (1 + effects.goldMult)),
        ciencia: Math.round(20 * ACTIONS_PER_TURN * (1 + effects.scienceMult))
    };
}

function setInvasionTarget(room, fId, targetFId) {
    FACCIONES.forEach(f => {
        if (f.id === fId) return;
        if (room.relaciones[fId]?.[f.id]) room.relaciones[fId][f.id] = 'Neutral';
        if (room.relaciones[f.id]?.[fId]) room.relaciones[f.id][fId] = 'Neutral';
    });

    room.invasionTargets[fId] = targetFId || null;
    if (targetFId) {
        room.relaciones[fId][targetFId] = 'Guerra';
        room.relaciones[targetFId][fId] = 'Guerra';
    }
}

function unitStats(room, fId) {
    const effects = techTotals(room, fId);
    let type = 'combatiente';
    if (hasTech(room, fId, 'biplanos')) type = 'aereo';
    else if (hasTech(room, fId, 'blindaje_tanque')) type = 'tanque';
    else if (hasTech(room, fId, 'mosquetes')) type = 'mosquetero';
    else if (hasTech(room, fId, 'polvora')) type = 'artillero';

    const stats = {
        combatiente: { speed: 2.0, maxHp: 100, damage: 2.0, attackRange: 48, vision: 260 },
        mosquetero: { speed: 1.7, maxHp: 80, damage: 3.0, attackRange: 120, vision: 300 },
        artillero: { speed: 1.2, maxHp: 60, damage: 5.0, attackRange: 200, vision: 350 },
        tanque: { speed: 1.5, maxHp: 200, damage: 7.0, attackRange: 80, vision: 280 },
        aereo: { speed: 3.0, maxHp: 70, damage: 9.5, attackRange: 60, vision: 400 }
    }[type];

    const result = {
        ...stats,
        type,
        speed: stats.speed * (1 + effects.speedMult),
        maxHp: Math.round(stats.maxHp * (1 + effects.hpMult)),
        damage: stats.damage * (1 + effects.damageMult),
        attackRange: stats.attackRange + effects.attackRange,
        vision: stats.vision + effects.vision,
        hpRegen: effects.hpRegen
    };
    return result;
/*
    if (hasTech(room, fId, 'calzadas') || hasTech(room, fId, 'rutas_comerciales')) result.speed *= 1.25;
    if (hasTech(room, fId, 'blindaje_personal') || hasTech(room, fId, 'blindaje_reactivo')) result.maxHp *= 1.35;
    if (hasTech(room, fId, 'siderurgia')) result.damage *= 1.4;
    if (hasTech(room, fId, 'coheteria_basica') || hasTech(room, fId, 'cañones_navales')) result.damage *= 1.6;
    if (type === 'tanque' && hasTech(room, fId, 'traccion_oruga')) result.speed *= 1.2;
    if (type === 'aereo' && hasTech(room, fId, 'motores_reaccion')) result.speed *= 1.3;
*/
}

function hexToPixel(q, r) {
    return {
        x: HEX_SIZE * (1.5 * q) + MAP_WIDTH / 2,
        y: HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r) + MAP_HEIGHT / 2
    };
}

function pixelToHex(px, py) {
    px -= MAP_WIDTH / 2;
    py -= MAP_HEIGHT / 2;
    const q = (2 / 3 * px) / HEX_SIZE;
    const r = (-1 / 3 * px + Math.sqrt(3) / 3 * py) / HEX_SIZE;
    return roundHex(q, r);
}

function roundHex(q, r) {
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(-q - r);
    const qDiff = Math.abs(rq - q);
    const rDiff = Math.abs(rr - r);
    const sDiff = Math.abs(rs - (-q - r));
    if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
    else if (rDiff > sDiff) rr = -rq - rs;
    return { q: rq, r: rr };
}

function generateTerritories(room) {
    room.territorios = {};
    for (let q = -25; q <= 25; q++) {
        for (let r = -18; r <= 18; r++) {
            const p = hexToPixel(q, r);
            if (p.x < -100 || p.x > MAP_WIDTH + 100 || p.y < -100 || p.y > MAP_HEIGHT + 100) continue;
            let closest = null;
            let minDist = Infinity;
            room.bases.forEach(base => {
                const d = Math.hypot(base.x - p.x, base.y - p.y);
                if (d < minDist) {
                    minDist = d;
                    closest = base.fId;
                }
            });
            room.territorios[`${q},${r}`] = closest;
        }
    }
}

function claimTerritory(room, unit) {
    const hex = pixelToHex(unit.x, unit.y);
    const key = `${hex.q},${hex.r}`;
    if (room.territorios[key] && room.territorios[key] !== unit.fId) room.territorios[key] = unit.fId;
}

function conquerFactionTerritory(room, oldFId, newFId) {
    Object.keys(room.territorios).forEach(key => {
        if (room.territorios[key] === oldFId) room.territorios[key] = newFId;
    });
}

function tickRoom(room) {
    const now = Date.now();
    if (now - room.lastSpawn > 5000) {
        spawnForAllFactions(room);
        room.lastSpawn = now;
    }

    room.unidades.forEach(unit => updateUnit(room, unit));
    room.unidades = room.unidades.filter(unit => unit.hp > 0);
    io.to(room.code).emit('state', snapshotRoom(room));
}

function updateUnit(room, unit) {
    if (unit.hp <= 0) return;
    const stats = unitStats(room, unit.fId);
    unit.type = stats.type;
    unit.maxHp = Math.max(unit.maxHp, stats.maxHp);
    if (stats.hpRegen > 0) unit.hp = Math.min(unit.maxHp, unit.hp + stats.hpRegen);
    claimTerritory(room, unit);
    if (unit.attackCooldown > 0) unit.attackCooldown--;

    if (!unit.hasOrder) {
        unit.targetX = unit.x;
        unit.targetY = unit.y;
        return;
    }

    const invasionTarget = room.invasionTargets[unit.fId];
    let targetUnit = null;
    let targetDist = Infinity;
    for (const other of room.unidades) {
        if (other.hp <= 0 || other.id === unit.id) continue;
        if (!invasionTarget || other.fId !== invasionTarget) continue;
        if (room.relaciones[unit.fId]?.[other.fId] !== 'Guerra') continue;
        const d = Math.hypot(other.x - unit.x, other.y - unit.y);
        if (d < stats.vision && d < targetDist) {
            targetDist = d;
            targetUnit = other;
        }
    }

    let targetBase = null;
    let baseDist = Infinity;
    for (const base of room.bases) {
        if (base.hp <= 0) continue;
        if (!invasionTarget || base.fId !== invasionTarget) continue;
        if (room.relaciones[unit.fId]?.[base.fId] !== 'Guerra') continue;
        const d = Math.hypot(base.x - unit.x, base.y - unit.y);
        if (d < stats.vision && d < baseDist) {
            baseDist = d;
            targetBase = base;
        }
    }

    if (targetUnit) {
        unit.targetX = targetUnit.x;
        unit.targetY = targetUnit.y;
        if (targetDist < stats.attackRange && unit.attackCooldown === 0) {
            targetUnit.hp -= stats.damage;
            unit.attackCooldown = 20;
        }
    } else if (targetBase) {
        unit.targetX = targetBase.x;
        unit.targetY = targetBase.y;
        if (baseDist < 60 && unit.attackCooldown === 0) {
            targetBase.hp -= stats.damage * 0.75;
            unit.attackCooldown = 25;
            if (targetBase.hp <= 0) conquerBase(room, targetBase, unit.fId);
        }
    } else {
        unit.targetX = unit.orderX;
        unit.targetY = unit.orderY;
    }

    const dx = unit.targetX - unit.x;
    const dy = unit.targetY - unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) {
        unit.x += dx / dist * stats.speed;
        unit.y += dy / dist * stats.speed;
    } else {
        unit.x = unit.targetX;
        unit.y = unit.targetY;
        if (Math.hypot(unit.x - unit.orderX, unit.y - unit.orderY) <= 2) unit.hasOrder = false;
    }
}

function conquerBase(room, base, newFId) {
    const oldFId = base.fId;
    base.fId = newFId;
    base.hp = base.maxHp;
    const oldName = FACCIONES.find(f => f.id === oldFId)?.nombre || oldFId;
    const newName = FACCIONES.find(f => f.id === newFId)?.nombre || newFId;
    addLog(room, `${newName} conquisto una base de ${oldName}.`);

    if (!room.bases.some(b => b.fId === oldFId && b.hp > 0)) {
        conquerFactionTerritory(room, oldFId, newFId);
        Object.keys(room.invasionTargets).forEach(fId => {
            if (room.invasionTargets[fId] === oldFId) room.invasionTargets[fId] = null;
        });
        addLog(room, `${newName} elimino a ${oldName}.`);
    }
}

function spawnForAllFactions(room) {
    FACCIONES.forEach(f => {
        const bases = room.bases.filter(base => base.fId === f.id && base.hp > 0);
        if (!bases.length) return;
        const effects = techTotals(room, f.id);
        const count = Math.max(1, Math.floor(1 + effects.production));
        for (let i = 0; i < count; i++) {
            const base = bases[Math.floor(Math.random() * bases.length)];
            addUnit(room, base.x + Math.random() * 40 - 20, base.y + Math.random() * 40 - 20, f.id);
        }
    });
}

function factionForSocket(socket, room) {
    return room.socketFactions.get(socket.id);
}

function requirePlayer(socket, room) {
    const fId = factionForSocket(socket, room);
    return fId && room.players.has(socket.id) ? fId : null;
}

function snapshotRoom(room) {
    const techCosts = {};
    FACCIONES.forEach(f => {
        techCosts[f.id] = {};
        const discount = techTotals(room, f.id).researchCostMult;
        tecnologias.forEach(tech => techCosts[f.id][tech.id] = modifiedCost(tech.costo, discount));
    });

    return {
        code: room.code,
        map: { width: MAP_WIDTH, height: MAP_HEIGHT, hexSize: HEX_SIZE },
        players: Array.from(room.players.values()),
        turno: room.turno,
        unidades: room.unidades,
        bases: room.bases,
        territorios: room.territorios,
        relaciones: room.relaciones,
        invasionTargets: room.invasionTargets,
        inv: room.inv,
        ciencias: room.ciencias,
        recursos: room.recursos,
        techCosts,
        techEffects: Object.fromEntries(Object.entries(TECH_EFFECTS).map(([id, effect]) => [id, effect.desc || 'Tiene beneficio.'])),
        logs: room.logs
    };
}

function getRoom(code) {
    return rooms.get(cleanRoomCode(code));
}

function sendError(socket, message) {
    socket.emit('gameError', message);
}

io.on('connection', socket => {
    socket.on('createRoom', () => {
        let code = createRoomCode();
        while (rooms.has(code)) code = createRoomCode();
        socket.emit('roomCreated', { code });
    });

    socket.on('joinRoom', data => {
        const code = cleanRoomCode(data?.roomID);
        const room = rooms.get(code) || createRoom(code);
        const occupied = new Set(Array.from(room.players.values()).map(p => p.faccion));
        const faccion = FACCIONES.find(f => !occupied.has(f.id))?.id;

        if (!faccion) {
            sendError(socket, 'La partida esta llena.');
            return;
        }

        socket.join(code);
        room.players.set(socket.id, { id: socket.id, faccion });
        room.socketFactions.set(socket.id, faccion);
        room.ciencias[faccion] = Math.max(room.ciencias[faccion], 50);
        addLog(room, `${FACCIONES.find(f => f.id === faccion).nombre} entro a la partida.`);

        socket.emit('initGame', {
            roomID: code,
            miFaccion: faccion,
            state: snapshotRoom(room)
        });
        io.to(code).emit('state', snapshotRoom(room));
    });

    socket.on('moveUnits', data => {
        const room = getRoom(data?.roomID);
        if (!room) return;
        const fId = requirePlayer(socket, room);
        if (!fId) return;
        const ids = Array.isArray(data.ids) ? data.ids.map(Number) : [];
        const tx = Number(data.tx);
        const ty = Number(data.ty);
        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
        room.unidades.forEach(unit => {
            if (unit.fId === fId && ids.includes(unit.id)) {
                unit.targetX = Math.max(0, Math.min(MAP_WIDTH, tx));
                unit.targetY = Math.max(0, Math.min(MAP_HEIGHT, ty));
                unit.orderX = unit.targetX;
                unit.orderY = unit.targetY;
                unit.hasOrder = true;
            }
        });
    });

    socket.on('action', data => {
        const room = getRoom(data?.roomID);
        if (!room) return;
        const fId = requirePlayer(socket, room);
        if (!fId) return;
        handleAction(socket, room, fId, data);
        io.to(room.code).emit('state', snapshotRoom(room));
    });

    socket.on('disconnect', () => {
        rooms.forEach(room => {
            const player = room.players.get(socket.id);
            if (!player) return;
            room.players.delete(socket.id);
            room.socketFactions.delete(socket.id);
            addLog(room, `${FACCIONES.find(f => f.id === player.faccion).nombre} salio de la partida.`);
            io.to(room.code).emit('state', snapshotRoom(room));
            if (room.players.size === 0) {
                clearInterval(room.loop);
                rooms.delete(room.code);
            }
        });
    });
});

function handleAction(socket, room, fId, data) {
    const recursos = room.recursos[fId];
    switch (data.type) {
        case 'recruit': {
            const recruitCost = modifiedCost(150, techTotals(room, fId).recruitCostMult);
            if (recursos.oro < recruitCost) return sendError(socket, `Necesitas ${recruitCost} de oro.`);
            const base = room.bases.find(b => b.fId === fId && b.hp > 0);
            if (!base) return sendError(socket, 'No tienes bases activas.');
            recursos.oro -= recruitCost;
            addUnit(room, base.x + 16, base.y + 16, fId);
            break;
        }
        case 'buildBase': {
            if (!BUILD_BASE_TECH_ID || !hasTech(room, fId, BUILD_BASE_TECH_ID)) {
                return sendError(socket, 'Necesitas investigar Albanileria.');
            }
            const effects = techTotals(room, fId);
            const buildCost = modifiedCost(300, effects.buildCostMult);
            if (recursos.oro < buildCost) return sendError(socket, `Necesitas ${buildCost} de oro.`);
            const x = Number(data.x);
            const y = Number(data.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            if (room.bases.some(b => b.hp > 0 && Math.hypot(b.x - x, b.y - y) < 55)) {
                return sendError(socket, 'Hay una base demasiado cerca.');
            }
            const maxHp = Math.round(500 * (1 + effects.baseHpMult));
            recursos.oro -= buildCost;
            room.bases.push({ id: room.nextBaseId++, x, y, hp: maxHp, maxHp, fId });
            break;
        }
        case 'passTurn': {
            room.turno++;
            FACCIONES.forEach(f => {
                const income = turnIncome(room, f.id);
                room.recursos[f.id].oro += income.oro;
                room.ciencias[f.id] += income.ciencia;
            });
            addLog(room, `Turno ${room.turno} iniciado.`);
            break;
        }
        case 'war':
        case 'ally': {
            const target = String(data.target || '');
            if (!room.relaciones[fId]?.[target] || target === fId) return;
            if (data.type === 'war') {
                setInvasionTarget(room, fId, target);
            } else {
                if (room.invasionTargets[fId] === target) room.invasionTargets[fId] = null;
                room.relaciones[fId][target] = 'Aliado';
                room.relaciones[target][fId] = 'Aliado';
            }
            break;
        }
        case 'research': {
            research(socket, room, fId, String(data.techId || ''));
            break;
        }
        case 'nuke': {
            detonateNuke(socket, room, fId, Number(data.x), Number(data.y));
            break;
        }
    }
}

function research(socket, room, fId, techId) {
    const tech = tecnologias.find(t => t.id === techId);
    if (!tech) return;
    if (room.inv[fId].includes(techId)) return;
    if (tech.req && !room.inv[fId].includes(tech.req)) return sendError(socket, 'Te falta una tecnologia previa.');
    const researchCost = modifiedCost(tech.costo, techTotals(room, fId).researchCostMult);
    if (room.ciencias[fId] < researchCost) return sendError(socket, 'No tienes ciencia suficiente.');
    room.ciencias[fId] -= researchCost;
    room.inv[fId].push(techId);
    room.unidades.filter(u => u.fId === fId).forEach(u => {
        const stats = unitStats(room, fId);
        u.type = stats.type;
        u.maxHp = stats.maxHp;
        u.hp = Math.min(stats.maxHp, u.hp + 20);
    });
    room.bases.filter(b => b.fId === fId).forEach(base => {
        const maxHp = Math.round(500 * (1 + techTotals(room, fId).baseHpMult));
        const ratio = base.maxHp > 0 ? base.hp / base.maxHp : 1;
        base.maxHp = maxHp;
        base.hp = Math.max(1, Math.round(maxHp * ratio));
    });
    if (techId === 'bomba_nuclear') room.recursos[fId].tieneBomba = true;
    addLog(room, `${FACCIONES.find(f => f.id === fId).nombre} investigo ${tech.nombre}.`);
}

function detonateNuke(socket, room, fId, x, y) {
    if (!hasTech(room, fId, 'bomba_nuclear')) return sendError(socket, 'Necesitas investigar Bomba Nuclear.');
    if (!room.recursos[fId].tieneBomba) return sendError(socket, 'Ya usaste tu bomba nuclear.');
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const radius = HEX_SIZE * 6 + techTotals(room, fId).nukeRadius;
    let units = 0;
    let bases = 0;
    room.unidades.forEach(unit => {
        if (unit.fId === fId || unit.hp <= 0) return;
        if (Math.hypot(unit.x - x, unit.y - y) <= radius) {
            unit.hp = 0;
            units++;
        }
    });
    room.bases.forEach(base => {
        if (base.fId === fId || base.hp <= 0) return;
        if (Math.hypot(base.x - x, base.y - y) <= radius) {
            bases++;
            conquerBase(room, base, fId);
        }
    });

    const center = pixelToHex(x, y);
    for (let dq = -3; dq <= 3; dq++) {
        for (let dr = -3; dr <= 3; dr++) {
            if (Math.abs(dq + dr) <= 3) room.territorios[`${center.q + dq},${center.r + dr}`] = fId;
        }
    }
    room.recursos[fId].tieneBomba = false;
    addLog(room, `Bomba nuclear detonada: ${units} unidades y ${bases} bases afectadas.`);
    io.to(room.code).emit('nukeDetonated', { x, y });
}

server.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});
