const socket = io();

const lobby = document.getElementById('lobby');
const gameScreen = document.getElementById('game');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const FACCIONES = [
    { id: 'blue', nombre: 'Federacion Azul', color: '#2196f3', uColor: '#bbdefb' },
    { id: 'red', nombre: 'Imperio Rojo', color: '#f44336', uColor: '#ffcdd2' },
    { id: 'green', nombre: 'Reino Verde', color: '#4caf50', uColor: '#c8e6c9' },
    { id: 'yellow', nombre: 'Union Amarilla', color: '#fbc02d', uColor: '#fff9c4' },
    { id: 'purple', nombre: 'Sultanato Purpura', color: '#9c27b0', uColor: '#e1bee7' },
    { id: 'orange', nombre: 'Emirato Naranja', color: '#ff9800', uColor: '#ffe0b2' },
    { id: 'cyan', nombre: 'Liga Cian', color: '#00bcd4', uColor: '#b2ebf2' },
    { id: 'pink', nombre: 'Dominion Rosa', color: '#e91e63', uColor: '#f8bbd0' }
];

const game = {
    roomID: '',
    miFaccionId: '',
    playerName: '',
    state: null,
    tecnologias: [],
    selectedIds: new Set(),
    seleccionando: false,
    mouseX: 0,
    mouseY: 0,
    selStartX: 0,
    selStartY: 0,
    selEndX: 0,
    selEndY: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    explosion: null,
    started: false,
    techRenderKey: '',
    relationsRenderKey: '',
    playersRenderKey: '',
    logsRenderKey: '',

    async start(data) {
        this.roomID = data.roomID;
        this.miFaccionId = data.miFaccion;
        this.state = data.state;
        await this.loadTechs();
        lobby.hidden = true;
        lobby.style.display = 'none';
        gameScreen.hidden = false;
        gameScreen.style.display = 'block';
        this.resizeCanvas();
        this.setupControls();
        this.updateUI();
        if (!this.started) {
            this.started = true;
            this.loop();
        }
    },

    async loadTechs() {
        const res = await fetch('tecnologias.json');
        const data = await res.json();
        this.tecnologias = data.tecnologias;
    },

    setupControls() {
        if (this.controlsReady) return;
        this.controlsReady = true;

        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.updateUI();
        });

        canvas.addEventListener('mousedown', event => {
            const pos = this.screenToWorld(event);
            if (event.button === 0) {
                this.seleccionando = true;
                this.selStartX = pos.x;
                this.selStartY = pos.y;
                this.selEndX = pos.x;
                this.selEndY = pos.y;
            } else if (event.button === 2) {
                this.moveSelected(pos.x, pos.y);
            }
        });

        canvas.addEventListener('mousemove', event => {
            const pos = this.screenToWorld(event);
            this.mouseX = pos.x;
            this.mouseY = pos.y;
            if (this.seleccionando) {
                this.selEndX = pos.x;
                this.selEndY = pos.y;
            }
        });

        canvas.addEventListener('mouseup', () => {
            if (!this.seleccionando) return;
            this.selectUnits();
            this.seleccionando = false;
        });

        canvas.addEventListener('contextmenu', event => event.preventDefault());

        window.addEventListener('keydown', event => {
            if (event.repeat || !this.roomID) return;
            const key = event.key.toLowerCase();
            if (event.code === 'Space') {
                event.preventDefault();
                this.sendAction({ type: 'passTurn' });
            }
            if (key === 't') this.sendAction({ type: 'recruit' });
            if (key === 'b') this.sendAction({ type: 'buildBase', x: this.mouseX, y: this.mouseY });
            if (key === 'n') this.sendAction({ type: 'nuke', x: this.mouseX, y: this.mouseY });
            if (key === 'g') this.changeRelation('war');
            if (key === 'f') this.changeRelation('ally');
        });
    },

    resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = Math.max(320, window.innerHeight - 260);
        const map = this.state?.map || { width: 1600, height: 900 };
        this.scale = Math.min(canvas.width / map.width, canvas.height / map.height);
        this.offsetX = (canvas.width - map.width * this.scale) / 2;
        this.offsetY = (canvas.height - map.height * this.scale) / 2;
    },

    screenToWorld(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left - this.offsetX) / this.scale,
            y: (event.clientY - rect.top - this.offsetY) / this.scale
        };
    },

    worldToScreen(x, y) {
        return {
            x: x * this.scale + this.offsetX,
            y: y * this.scale + this.offsetY
        };
    },

    sendAction(action) {
        socket.emit('action', { roomID: this.roomID, ...action });
    },

    moveSelected(x, y) {
        if (!this.selectedIds.size) return;
        socket.emit('moveUnits', {
            roomID: this.roomID,
            ids: Array.from(this.selectedIds),
            tx: x,
            ty: y
        });
    },

    selectUnits() {
        const minX = Math.min(this.selStartX, this.selEndX);
        const maxX = Math.max(this.selStartX, this.selEndX);
        const minY = Math.min(this.selStartY, this.selEndY);
        const maxY = Math.max(this.selStartY, this.selEndY);
        this.selectedIds.clear();
        this.state.unidades.forEach(unit => {
            if (
                unit.fId === this.miFaccionId &&
                unit.x >= minX && unit.x <= maxX &&
                unit.y >= minY && unit.y <= maxY
            ) {
                this.selectedIds.add(unit.id);
            }
        });
    },

    changeRelation(type) {
        const base = this.state.bases.find(item => (
            item.hp > 0 &&
            item.fId !== this.miFaccionId &&
            Math.hypot(item.x - this.mouseX, item.y - this.mouseY) < 35
        ));
        if (!base) {
            this.addLocalLog('Apunta a una base enemiga para cambiar relacion.');
            return;
        }
        this.sendAction({ type, target: base.fId });
    },

    applyState(state) {
        this.state = state;
        this.selectedIds.forEach(id => {
            if (!state.unidades.some(unit => unit.id === id && unit.fId === this.miFaccionId)) {
                this.selectedIds.delete(id);
            }
        });
        this.updateUI();
    },

    updateUI() {
        if (!this.state) return;
        const faccion = FACCIONES.find(f => f.id === this.miFaccionId);
        const recursos = this.state.recursos[this.miFaccionId] || { oro: 0 };

        text('sala', this.roomID);
        text('faccion', faccion?.nombre || this.miFaccionId);
        text('turno-stat', this.state.turno);
        text('oro', recursos.oro);
        text('ciencia', this.state.ciencias[this.miFaccionId] || 0);
        text('unidades', this.state.unidades.filter(u => u.fId === this.miFaccionId && u.hp > 0).length);

        this.renderTechs();
        this.renderRelations();
        this.renderPlayers();
        this.renderLogs();
    },

    renderTechs() {
        const container = document.getElementById('tech-tree');
        const inv = this.state.inv[this.miFaccionId] || [];
        const science = this.state.ciencias[this.miFaccionId] || 0;
        const costs = this.state.techCosts?.[this.miFaccionId] || {};
        const renderKey = `${this.miFaccionId}|${science}|${inv.join(',')}|${JSON.stringify(costs)}`;
        if (this.techRenderKey === renderKey) return;
        this.techRenderKey = renderKey;
        container.innerHTML = '';
        this.tecnologias.forEach(tech => {
            const cost = costs[tech.id] || tech.costo;
            const purchased = inv.includes(tech.id);
            const locked = tech.req && !inv.includes(tech.req);
            const affordable = science >= cost;
            const item = document.createElement('button');
            item.className = `tech-item ${purchased ? 'purchased' : ''} ${locked ? 'locked' : ''} ${affordable ? 'available' : ''}`;
            item.disabled = purchased;
            const benefit = this.state.techEffects?.[tech.id] || tech.descripcion || 'Tiene beneficio.';
            item.title = purchased ? `Ya investigada. ${benefit}` : (locked ? `Requiere ${tech.req}. ${benefit}` : (!affordable ? `No tienes ciencia suficiente. ${benefit}` : benefit));
            item.innerHTML = `<strong>${tech.nombre}</strong><small>${cost} Ci</small>`;
            item.addEventListener('click', () => this.sendAction({ type: 'research', techId: tech.id }));
            container.appendChild(item);
        });
    },

    renderRelations() {
        const container = document.getElementById('relaciones-container');
        const activeTarget = this.state.invasionTargets?.[this.miFaccionId] || null;
        const renderKey = `${this.miFaccionId}|${activeTarget}|${JSON.stringify(this.state.relaciones[this.miFaccionId])}|${this.state.unidades.length}`;
        if (this.relationsRenderKey === renderKey) return;
        this.relationsRenderKey = renderKey;
        container.innerHTML = '';
        FACCIONES.forEach(faccion => {
            if (faccion.id === this.miFaccionId) return;
            const rel = this.state.relaciones[this.miFaccionId]?.[faccion.id] || 'Neutral';
            const isTarget = activeTarget === faccion.id;
            const item = document.createElement('div');
            item.className = `relacion-item ${isTarget ? 'relacion-target' : ''}`;
            item.style.borderLeftColor = faccion.color;
            item.innerHTML = `
                <div class="relacion-nombre">${faccion.nombre}</div>
                <button class="relacion-estado relacion-${rel.toLowerCase()}">${isTarget ? 'Invadiendo' : rel}</button>
                <div class="relacion-unidades">${this.state.unidades.filter(u => u.fId === faccion.id).length}</div>
            `;
            item.querySelector('button').addEventListener('click', () => {
                const next = isTarget ? 'ally' : 'war';
                this.sendAction({ type: next, target: faccion.id });
            });
            container.appendChild(item);
        });
    },

    renderPlayers() {
        const container = document.getElementById('players-container');
        const renderKey = this.state.players.map(player => `${player.id}:${player.faccion}`).join('|');
        if (this.playersRenderKey === renderKey) return;
        this.playersRenderKey = renderKey;
        container.innerHTML = '';
        this.state.players.forEach(player => {
            const faccion = FACCIONES.find(f => f.id === player.faccion);
            const item = document.createElement('div');
            item.className = 'player-item';
            item.style.borderLeftColor = faccion?.color || '#777';
            item.textContent = faccion?.nombre || player.faccion;
            container.appendChild(item);
        });
    },

    renderLogs() {
        const container = document.getElementById('log-console');
        const renderKey = this.state.logs.join('|');
        if (this.logsRenderKey === renderKey) return;
        this.logsRenderKey = renderKey;
        container.innerHTML = this.state.logs.map(log => `<div>&gt; ${escapeHtml(log)}</div>`).join('');
    },

    addLocalLog(message) {
        const container = document.getElementById('log-console');
        container.innerHTML = `<div>&gt; ${escapeHtml(message)}</div>` + container.innerHTML;
    },

    loop() {
        if (this.state) this.draw();
        requestAnimationFrame(() => this.loop());
    },

    draw() {
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);
        this.drawMapBackground();
        this.drawTerritories();
        this.drawBases();
        this.drawUnits();
        this.drawSelectionBox();
        this.drawExplosion();
        ctx.restore();
    },

    drawMapBackground() {
        const map = this.state.map;
        ctx.fillStyle = '#123622';
        ctx.fillRect(0, 0, map.width, map.height);
    },

    drawTerritories() {
        const hexSize = this.state.map.hexSize;
        ctx.save();
        ctx.globalAlpha = 0.35;
        Object.entries(this.state.territorios).forEach(([key, fId]) => {
            const faction = FACCIONES.find(f => f.id === fId);
            if (!faction) return;
            const [q, r] = key.split(',').map(Number);
            const p = this.hexToPixel(q, r);
            ctx.fillStyle = faction.color;
            this.drawHexagon(p.x, p.y, hexSize, true);
        });
        ctx.restore();
    },

    hexToPixel(q, r) {
        const size = this.state.map.hexSize;
        return {
            x: size * (1.5 * q) + this.state.map.width / 2,
            y: size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r) + this.state.map.height / 2
        };
    },

    drawBases() {
        this.state.bases.forEach(base => {
            if (base.hp <= 0) return;
            const faction = FACCIONES.find(f => f.id === base.fId);
            ctx.save();
            ctx.fillStyle = faction?.color || '#777';
            ctx.strokeStyle = '#050505';
            ctx.lineWidth = 2;
            this.drawHexagon(base.x, base.y, 22, true);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((faction?.nombre || base.fId).slice(0, 3), base.x, base.y - 2);
            this.drawHealthBar(base.x, base.y + 22, base.hp, base.maxHp, 38);
            ctx.restore();
        });
    },

    drawUnits() {
        this.state.unidades.forEach(unit => {
            if (unit.hp <= 0) return;
            const faction = FACCIONES.find(f => f.id === unit.fId);
            ctx.save();
            ctx.fillStyle = faction?.uColor || '#ddd';
            ctx.strokeStyle = '#050505';
            ctx.lineWidth = 1.5;
            this.drawUnitShape(unit);
            if (this.selectedIds.has(unit.id)) {
                ctx.strokeStyle = '#00ff66';
                ctx.lineWidth = 2;
                ctx.strokeRect(unit.x - 13, unit.y - 13, 26, 26);
            }
            this.drawHealthBar(unit.x, unit.y + 15, unit.hp, unit.maxHp, 24);
            ctx.restore();
        });
    },

    drawUnitShape(unit) {
        if (unit.type === 'tanque') {
            ctx.fillRect(unit.x - 10, unit.y - 8, 20, 16);
            ctx.strokeRect(unit.x - 10, unit.y - 8, 20, 16);
            ctx.beginPath();
            ctx.moveTo(unit.x, unit.y);
            ctx.lineTo(unit.x + 14, unit.y - 2);
            ctx.stroke();
            return;
        }
        if (unit.type === 'aereo') {
            ctx.beginPath();
            ctx.moveTo(unit.x, unit.y - 12);
            ctx.lineTo(unit.x - 10, unit.y + 8);
            ctx.lineTo(unit.x + 10, unit.y + 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            return;
        }
        this.drawHexagon(unit.x, unit.y, 10, true);
        ctx.beginPath();
        if (unit.type === 'artillero') {
            ctx.lineWidth = 3;
            ctx.moveTo(unit.x - 6, unit.y);
            ctx.lineTo(unit.x + 8, unit.y);
        } else if (unit.type === 'mosquetero') {
            ctx.lineWidth = 2;
            ctx.moveTo(unit.x - 8, unit.y);
            ctx.lineTo(unit.x + 8, unit.y);
        } else {
            ctx.moveTo(unit.x, unit.y - 7);
            ctx.lineTo(unit.x, unit.y + 6);
            ctx.moveTo(unit.x - 4, unit.y - 3);
            ctx.lineTo(unit.x + 4, unit.y - 3);
        }
        ctx.stroke();
    },

    drawHealthBar(x, y, hp, maxHp, width) {
        const ratio = Math.max(0, Math.min(1, hp / maxHp));
        ctx.fillStyle = '#111';
        ctx.fillRect(x - width / 2, y, width, 4);
        ctx.fillStyle = ratio > 0.45 ? '#49d17d' : '#f24f4f';
        ctx.fillRect(x - width / 2, y, width * ratio, 4);
    },

    drawSelectionBox() {
        if (!this.seleccionando) return;
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 1.5 / this.scale;
        ctx.strokeRect(
            this.selStartX,
            this.selStartY,
            this.selEndX - this.selStartX,
            this.selEndY - this.selStartY
        );
    },

    drawExplosion() {
        if (!this.explosion) return;
        this.explosion.tick++;
        const progress = this.explosion.tick / 90;
        const alpha = Math.max(0, 1 - progress);
        const radius = this.explosion.maxRadius * Math.min(progress * 1.3, 1);
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.explosion.x, this.explosion.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 90, 0, ${alpha})`;
        ctx.lineWidth = 8;
        ctx.stroke();
        const gradient = ctx.createRadialGradient(this.explosion.x, this.explosion.y, 0, this.explosion.x, this.explosion.y, radius);
        gradient.addColorStop(0, `rgba(255,255,210,${alpha})`);
        gradient.addColorStop(0.45, `rgba(255,120,0,${alpha * 0.7})`);
        gradient.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.explosion.x, this.explosion.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (alpha <= 0) this.explosion = null;
    },

    drawHexagon(x, y, size, fill = false) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i;
            const px = x + size * Math.cos(angle);
            const py = y + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (fill) ctx.fill();
        ctx.stroke();
    }
};

function text(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function joinRoom(code) {
    const roomID = String(code || document.getElementById('roomCode').value || '').trim().toUpperCase();
    game.playerName = document.getElementById('playerName').value.trim() || 'Jugador';
    if (!roomID) {
        document.getElementById('lobbyMessage').textContent = 'Escribe un codigo o crea una partida.';
        return;
    }
    socket.emit('joinRoom', { roomID, name: game.playerName });
}

document.getElementById('createRoomBtn').addEventListener('click', () => {
    socket.emit('createRoom');
});

document.getElementById('joinRoomBtn').addEventListener('click', () => joinRoom());

document.getElementById('roomCode').addEventListener('keydown', event => {
    if (event.key === 'Enter') joinRoom();
});

socket.on('roomCreated', data => {
    document.getElementById('roomCode').value = data.code;
    document.getElementById('lobbyMessage').textContent = `Partida creada: ${data.code}`;
    joinRoom(data.code);
});

socket.on('initGame', data => {
    game.start(data);
});

socket.on('state', state => {
    if (!game.roomID || state.code !== game.roomID) return;
    game.applyState(state);
});

socket.on('nukeDetonated', data => {
    game.explosion = { x: data.x, y: data.y, tick: 0, maxRadius: 220 };
});

socket.on('gameError', message => {
    if (game.started) game.addLocalLog(message);
    else document.getElementById('lobbyMessage').textContent = message;
});
