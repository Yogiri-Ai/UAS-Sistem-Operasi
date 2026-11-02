/**
 * DiskLab — Visualizer Engine
 * Menangani penggambaran grafik trajektori silinder disk (Canvas 2D)
 * dan visualisasi blok penyimpanan berkas dengan kurva panah SVG.
 */

class Visualizer {
    constructor(trajectoryCanvasId, svgOverlayId) {
        this.canvas = document.getElementById(trajectoryCanvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.svg = document.getElementById(svgOverlayId);
        this.nodePositions = [];
    }

    /**
     * Hitung silinder terinterpolasi untuk animasi pergerakan head yang mulus
     */
    static getInterpolatedTrack(sequence, progress) {
        if (!sequence || sequence.length === 0) return 0;
        const maxIdx = sequence.length - 1;
        const clamped = Math.max(0, Math.min(progress, maxIdx));
        const baseIdx = Math.floor(clamped);
        const frac = clamped - baseIdx;
        if (baseIdx >= maxIdx) return sequence[maxIdx];
        const eased = frac < 0.5 ? 4 * frac * frac * frac : 1 - Math.pow(-2 * frac + 2, 3) / 2;
        return sequence[baseIdx] + (sequence[baseIdx + 1] - sequence[baseIdx]) * eased;
    }

    /**
     * Gambar Grafik Trajektori Silinder (Format Standard Buku Silberschatz)
     */
    drawDiskTrajectory(simulationResult, progress, maxTrack = 199, originalRequests = [], hoveredIdx = -1) {
        if (!this.canvas || !this.ctx) return;

        const canvas = this.canvas;
        const ctx = this.ctx;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        const width = rect.width;
        const height = rect.height;

        if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const padLeft = 60;
        const padRight = 32;
        const padTop = 48;
        const padBottom = 28;
        const plotWidth = Math.max(50, width - padLeft - padRight);
        const plotHeight = Math.max(50, height - padTop - padBottom);
        const safeMax = Math.max(1, maxTrack);

        const getX = (track) => padLeft + (Math.max(0, Math.min(track, safeMax)) / safeMax) * plotWidth;

        // 1. Grid Garis Vertikal & Angka Silinder
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';

        const tickStep = safeMax <= 100 ? 10 : (safeMax <= 250 ? 25 : 50);
        for (let t = 0; t <= safeMax; t += tickStep) {
            if (safeMax - t < tickStep * 0.35 && t !== 0) continue;
            const x = getX(t);
            ctx.beginPath();
            ctx.moveTo(x, padTop - 8);
            ctx.lineTo(x, height - padBottom);
            ctx.stroke();
            ctx.fillText(t.toString(), x, padTop - 18);
        }

        // Tampilkan 0 dan maxTrack
        const xMax = getX(safeMax);
        ctx.beginPath();
        ctx.moveTo(xMax, padTop - 8);
        ctx.lineTo(xMax, height - padBottom);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillText('0', getX(0), padTop - 18);
        ctx.fillText(safeMax.toString(), xMax, padTop - 18);

        // 2. Rel Silinder Atas (Track Rail)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(padLeft, padTop - 4);
        ctx.lineTo(padLeft + plotWidth, padTop - 4);
        ctx.stroke();

        // Titik Request pada Rel Atas
        originalRequests.forEach(req => {
            const rx = getX(req);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
            ctx.beginPath();
            ctx.arc(rx, padTop - 4, 3.5, 0, Math.PI * 2);
            ctx.fill();
        });

        this.nodePositions = [];
        if (!simulationResult || !simulationResult.sequence || simulationResult.sequence.length === 0) {
            ctx.restore();
            return;
        }

        const seq = simulationResult.sequence;
        const events = simulationResult.events || [];
        const accent = simulationResult.color || '#38bdf8';
        const totalSteps = seq.length - 1;
        const clampedProg = Math.max(0, Math.min(progress, totalSteps));
        const completedStep = Math.floor(clampedProg);
        const frac = clampedProg - completedStep;

        const stepYGap = totalSteps > 0 ? plotHeight / totalSteps : 0;
        const getY = (idx) => padTop + 10 + idx * stepYGap;

        // 3. Garis Horizontal Halus per Step
        for (let i = 0; i <= totalSteps; i++) {
            const y = getY(i);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(padLeft + plotWidth, y);
            ctx.stroke();
        }

        // 4. Garis Lintasan Bayangan (Rute Lengkap)
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1.75;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let i = 0; i <= totalSteps; i++) {
            const x = getX(seq[i]);
            const y = getY(i);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 5. Garis Lintasan Aktif yang Telah Ditempuh
        for (let i = 1; i <= totalSteps; i++) {
            if (i > completedStep + 1) break;
            if (i === completedStep + 1 && frac <= 0.001) break;

            const x1 = getX(seq[i - 1]);
            const y1 = getY(i - 1);
            const fullX2 = getX(seq[i]);
            const fullY2 = getY(i);

            let curX2 = fullX2;
            let curY2 = fullY2;
            if (i === completedStep + 1) {
                const eased = frac < 0.5 ? 4 * frac * frac * frac : 1 - Math.pow(-2 * frac + 2, 3) / 2;
                curX2 = x1 + (fullX2 - x1) * eased;
                curY2 = y1 + (fullY2 - y1) * eased;
            }

            const stepMeta = simulationResult.steps[i - 1];
            const isJump = stepMeta && stepMeta.type === 'jump';

            ctx.save();
            if (isJump) {
                ctx.setLineDash([5, 4]);
                ctx.strokeStyle = '#c084fc';
                ctx.lineWidth = 2.2;
            } else {
                ctx.strokeStyle = accent;
                ctx.lineWidth = 2.6;
            }
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(curX2, curY2);
            ctx.stroke();
            ctx.restore();

            // Label delta jarak
            if (i <= completedStep && stepMeta) {
                const midX = (x1 + fullX2) / 2;
                const midY = (y1 + fullY2) / 2;
                const badgeText = isJump ? `↺ ${stepMeta.distance}` : `+${stepMeta.distance}`;
                ctx.font = '600 9.5px "JetBrains Mono", monospace';
                const tw = ctx.measureText(badgeText).width + 8;
                ctx.fillStyle = '#090d16';
                ctx.fillRect(midX - tw / 2, midY - 7, tw, 14);
                ctx.fillStyle = isJump ? '#c084fc' : '#cbd5e1';
                ctx.textAlign = 'center';
                ctx.fillText(badgeText, midX, midY + 3.5);
            }
        }

        // 6. Gambar Node Titik Kunjungan
        for (let i = 0; i <= totalSteps; i++) {
            const x = getX(seq[i]);
            const y = getY(i);
            const ev = events[i] || { type: i === 0 ? 'init' : 'request' };
            const isVisited = i <= completedStep;
            const isHovered = i === hoveredIdx;

            this.nodePositions.push({ index: i, x, y, track: seq[i], event: ev });

            // Label Step di sebelah kiri
            ctx.fillStyle = i === completedStep && frac < 0.05 ? accent : (isVisited ? '#94a3b8' : '#334155');
            ctx.font = i === completedStep ? '700 10px "JetBrains Mono", monospace' : '500 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(i === 0 ? 'AWAL' : `S${i}`, padLeft - 10, y + 3.5);

            if (isHovered) {
                ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fill();
            }

            if (isVisited) {
                if (ev.type === 'boundary') {
                    ctx.fillStyle = '#090d16';
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.fillStyle = i === 0 ? '#f59e0b' : '#10b981';
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = '#ffffff';
                ctx.font = '600 10px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(seq[i].toString(), x, y - 8);
            } else {
                ctx.fillStyle = '#475569';
                ctx.beginPath();
                ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 7. Indikator Head Aktif
        const interpTrack = Visualizer.getInterpolatedTrack(seq, clampedProg);
        const activeX = getX(interpTrack);
        const activeY = padTop + 10 + clampedProg * stepYGap;

        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(activeX, activeY, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(activeX, activeY, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Jarum Penunjuk di Rel Atas
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(activeX, padTop - 1);
        ctx.lineTo(activeX - 5, padTop - 10);
        ctx.lineTo(activeX + 5, padTop - 10);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    hitTestNode(clientX, clientY) {
        if (!this.canvas || !this.nodePositions.length) return -1;
        const rect = this.canvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;

        for (const n of this.nodePositions) {
            const dx = mx - n.x;
            const dy = my - n.y;
            if (dx * dx + dy * dy <= 160) {
                return n.index;
            }
        }
        return -1;
    }

    /**
     * Render Grid Blok Disk Fisik
     */
    static renderStorageGrid(containerId, fileSystem, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { onBlockClick, onBlockHover, activeReadBlockId = null, traversedBlockIds = [] } = options;
        container.innerHTML = '';
        const blocks = fileSystem.blocks;

        blocks.forEach((block) => {
            const cell = document.createElement('div');
            cell.className = 'disk-block rounded-md cursor-pointer flex flex-col items-center justify-between p-1.5 border select-none text-xs';
            cell.dataset.blockId = block.id;

            const isReadTarget = activeReadBlockId === block.id;
            const isTraversed = traversedBlockIds.includes(block.id);

            if (block.status === 'free') {
                cell.className += ' block-free';
                cell.innerHTML = `
                    <span class="text-[9.5px] font-mono opacity-50">#${block.id}</span>
                    <span class="text-[9px] font-semibold opacity-60 uppercase my-auto">KOSONG</span>
                `;
            } else if (block.status === 'reserved') {
                cell.className += ' block-reserved';
                cell.innerHTML = `
                    <span class="text-[9.5px] font-mono text-rose-400">#${block.id}</span>
                    <span class="text-[8.5px] font-bold text-rose-300 uppercase my-auto">RUSAK</span>
                `;
            } else if (block.status === 'allocated') {
                cell.style.backgroundColor = `${block.color}25`;
                cell.style.borderColor = block.color;

                let tag = `<span class="text-[8.5px] font-mono opacity-80">B${block.logicalIndex}</span>`;
                if (fileSystem.method === 'linked') {
                    tag = block.nextBlock === -1
                        ? `<span class="text-[8px] font-mono px-1 rounded bg-rose-500/30 text-rose-300 font-bold">EOF</span>`
                        : `<span class="text-[8px] font-mono px-1 rounded bg-sky-500/30 text-sky-300 font-semibold">→#${block.nextBlock}</span>`;
                }

                cell.innerHTML = `
                    <div class="w-full flex items-center justify-between text-[9px] font-mono font-bold" style="color:${block.color}">
                        <span>#${block.id}</span>
                        <span>[${block.logicalIndex}]</span>
                    </div>
                    <span class="text-[9px] font-medium truncate w-full text-center text-slate-200" title="${block.fileName}">${block.fileName}</span>
                    ${tag}
                `;
            } else if (block.status === 'index') {
                cell.style.backgroundColor = `${block.color}30`;
                cell.style.borderColor = '#f59e0b';
                cell.className += ' block-index';
                cell.innerHTML = `
                    <div class="w-full flex items-center justify-between text-[9px] font-mono font-bold text-amber-400">
                        <span>#${block.id}</span>
                        <span>INDEX</span>
                    </div>
                    <span class="text-[9px] font-bold truncate w-full text-center text-amber-300" title="${block.fileName}">${block.fileName}</span>
                    <span class="text-[8px] font-mono px-1 rounded bg-amber-500/30 text-amber-200">${block.indexPointers.length} ptr</span>
                `;
            }

            if (isReadTarget) {
                cell.classList.add('io-read-target');
            } else if (isTraversed) {
                cell.classList.add('io-read-traversed');
            }

            if (onBlockClick) {
                cell.addEventListener('click', (ev) => onBlockClick(block, ev));
            }
            if (onBlockHover) {
                cell.addEventListener('mouseenter', () => onBlockHover(block, true));
                cell.addEventListener('mouseleave', () => onBlockHover(block, false));
            }

            container.appendChild(cell);
        });
    }

    /**
     * Gambar Panah SVG untuk Linked & Indexed Allocation
     */
    static drawConnections(svgId, gridId, file) {
        const svg = document.getElementById(svgId);
        const grid = document.getElementById(gridId);
        if (!svg || !grid || !file) {
            if (svg) svg.innerHTML = '';
            return;
        }

        svg.innerHTML = '';
        svg.setAttribute('width', grid.scrollWidth);
        svg.setAttribute('height', grid.scrollHeight);
        svg.style.width = `${grid.scrollWidth}px`;
        svg.style.height = `${grid.scrollHeight}px`;

        const strokeColor = file.color || '#38bdf8';
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
            <marker id="ptr-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="${strokeColor}" />
            </marker>
        `;
        svg.appendChild(defs);

        const getBlockCenter = (blockId) => {
            const el = grid.querySelector(`[data-block-id="${blockId}"]`);
            if (!el) return null;
            return {
                x: el.offsetLeft + el.offsetWidth / 2,
                y: el.offsetTop + el.offsetHeight / 2
            };
        };

        const appendArrow = (p1, p2) => {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const lift = Math.min(26, Math.max(10, dist * 0.15));
            const cx = (p1.x + p2.x) / 2 - (dy / (dist || 1)) * lift * 0.35;
            const cy = (p1.y + p2.y) / 2 - lift;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', strokeColor);
            path.setAttribute('stroke-width', '2');
            path.setAttribute('class', 'svg-flow-path');
            path.setAttribute('marker-end', 'url(#ptr-arrow)');
            svg.appendChild(path);
        };

        if (file.method === 'linked' && file.blocks && file.blocks.length > 1) {
            for (let i = 0; i < file.blocks.length - 1; i++) {
                const p1 = getBlockCenter(file.blocks[i]);
                const p2 = getBlockCenter(file.blocks[i + 1]);
                if (p1 && p2) appendArrow(p1, p2);
            }
        } else if (file.method === 'indexed' && file.indexBlock !== undefined && file.blocks) {
            const pIdx = getBlockCenter(file.indexBlock);
            if (pIdx) {
                file.blocks.forEach(bId => {
                    const pData = getBlockCenter(bId);
                    if (pData) appendArrow(pIdx, pData);
                });
            }
        }
    }

    static clearConnections(svgId) {
        const svg = document.getElementById(svgId);
        if (svg) svg.innerHTML = '';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Visualizer;
} else if (typeof window !== 'undefined') {
    window.Visualizer = Visualizer;
}
