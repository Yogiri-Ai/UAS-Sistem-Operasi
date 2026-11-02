/**
 * DiskLab — Main Application Controller
 * Mengintegrasikan logika penjadwalan disk, simulasi alokasi berkas,
 * visualisasi kanvas, kontrol pemutaran animasi, dan grafik perbandingan Chart.js.
 */

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. STATE APLIKASI
    // =========================================================================
    const state = {
        activeTab: 'scheduling',
        scheduling: {
            algorithm: 'SSTF',
            head: 53,
            maxTrack: 199,
            direction: 'high',
            requests: [98, 183, 37, 122, 14, 124, 65, 67],
            result: null,
            progress: 0,
            isPlaying: false,
            speedMultiplier: 1.0,
            hoveredNode: -1,
            lastFrameTime: performance.now()
        },
        allocation: {
            selectedFile: null,
            readAnimTimer: null,
            activeReadBlockId: null,
            traversedBlockIds: []
        }
    };

    const visualizer = new Visualizer('diskCanvas', 'svgConnections');
    const fileSystem = new FileAllocationSystem(64, 'contiguous');
    let comparisonChartInstance = null;

    // Toast Sederhana
    function showToast(message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs shadow-lg transition-opacity duration-300 pointer-events-auto';
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // =========================================================================
    // 2. NAVIGASI TAB
    // =========================================================================
    const tabButtons = document.querySelectorAll('[data-tab-target]');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(target) {
        state.activeTab = target;
        tabButtons.forEach(b => {
            const active = b.dataset.tabTarget === target;
            b.classList.toggle('bg-sky-600', active);
            b.classList.toggle('text-white', active);
            b.classList.toggle('text-slate-400', !active);
        });

        tabPanels.forEach(p => p.classList.add('hidden'));
        const activePanel = document.getElementById(`panel-${target}`);
        if (activePanel) activePanel.classList.remove('hidden');

        if (target === 'scheduling') {
            requestAnimationFrame(() => updateSchedulingFrame());
        } else if (target === 'allocation') {
            requestAnimationFrame(() => renderAllocationUI());
        } else if (target === 'comparison') {
            requestAnimationFrame(() => renderComparison());
        }
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tabTarget);
            history.replaceState(null, null, `#${btn.dataset.tabTarget}`);
        });
    });

    // Otomatis aktifkan tab berdasarkan hash URL (misal #allocation atau #comparison)
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && ['scheduling', 'allocation', 'comparison', 'theory'].includes(initialHash)) {
        switchTab(initialHash);
    }

    // =========================================================================
    // 3. MODUL 1: PENJADWALAN DISK
    // =========================================================================
    const elAlgoSelect = document.getElementById('algoSelect');
    const elHeadInput = document.getElementById('headInput');
    const elMaxTrackInput = document.getElementById('maxTrackInput');
    const elDirectionSelect = document.getElementById('directionSelect');
    const elQueueInput = document.getElementById('queueInput');
    const elScrubber = document.getElementById('timelineScrubber');
    const elPlayBtn = document.getElementById('playBtn');
    const elSpeedSelect = document.getElementById('speedSelect');

    function parseQueue(str, max) {
        if (!str) return [];
        return str.split(/[\s,;]+/)
            .map(s => parseInt(s.trim(), 10))
            .filter(n => !isNaN(n) && n >= 0 && n <= max);
    }

    function calculateDiskSimulation(jumpEnd = false) {
        const maxT = Math.max(20, Math.min(999, parseInt(elMaxTrackInput.value, 10) || 199));
        const headVal = Math.max(0, Math.min(maxT, parseInt(elHeadInput.value, 10) || 0));
        elMaxTrackInput.value = maxT;
        elHeadInput.value = headVal;

        state.scheduling.maxTrack = maxT;
        state.scheduling.head = headVal;
        state.scheduling.direction = elDirectionSelect.value;
        state.scheduling.algorithm = elAlgoSelect.value;
        state.scheduling.requests = parseQueue(elQueueInput.value, maxT);

        document.getElementById('queueCountBadge').textContent = `${state.scheduling.requests.length} request`;

        const { algorithm, head, requests, direction, maxTrack } = state.scheduling;
        const result = DiskScheduler.run(algorithm, head, requests, direction, maxTrack);
        state.scheduling.result = result;

        // Label Info
        document.getElementById('activeAlgoBadge').textContent = result.key;
        document.getElementById('activeAlgoSummary').textContent = result.summary;
        document.getElementById('fullSequenceText').textContent = result.sequence.join(' → ');

        elScrubber.max = result.steps.length;
        pauseDiskAnimation();

        state.scheduling.progress = jumpEnd ? result.steps.length : 0;
        renderStepTraceTable();
        updateSchedulingFrame();
    }

    function renderStepTraceTable() {
        const tbody = document.getElementById('stepTraceBody');
        const res = state.scheduling.result;
        if (!tbody || !res) return;

        tbody.innerHTML = '';
        res.steps.forEach((step) => {
            const tr = document.createElement('tr');
            tr.dataset.stepIndex = step.step;
            tr.className = 'cursor-pointer transition-colors text-xs hover:bg-slate-800/60';

            const typePill = step.type === 'jump'
                ? '<span class="px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 font-sans text-[10px]">JUMP</span>'
                : step.type === 'boundary'
                    ? '<span class="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 font-sans text-[10px]">BATAS</span>'
                    : '<span class="px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 font-sans text-[10px]">DATA</span>';

            tr.innerHTML = `
                <td class="py-2 px-3 font-bold text-slate-400">#${step.step}</td>
                <td class="py-2 px-3">${step.from} → <strong class="text-white">${step.to}</strong></td>
                <td class="py-2 px-3">${typePill}</td>
                <td class="py-2 px-3 text-right">${step.distance}</td>
                <td class="py-2 px-3 text-right font-bold text-amber-400">${step.cumulativeSeek}</td>
                <td class="py-2 px-3 hidden md:table-cell font-sans text-[11px] text-slate-400 truncate max-w-xs" title="${step.reason}">${step.reason}</td>
            `;
            tr.addEventListener('click', () => {
                pauseDiskAnimation();
                state.scheduling.progress = step.step;
                updateSchedulingFrame();
            });
            tbody.appendChild(tr);
        });
    }

    function updateSchedulingFrame() {
        const { result, progress, maxTrack, requests, hoveredNode } = state.scheduling;
        if (!result) return;

        const totalSteps = result.steps.length;
        const clampedProg = Math.max(0, Math.min(progress, totalSteps));
        const activeIntStep = Math.floor(clampedProg + 0.0001);

        visualizer.drawDiskTrajectory(result, clampedProg, maxTrack, requests, hoveredNode);

        elScrubber.value = clampedProg;
        const pct = totalSteps > 0 ? Math.round((clampedProg / totalSteps) * 100) : 100;
        document.getElementById('scrubberPercent').textContent = `${pct}%`;

        const interpTrack = Visualizer.getInterpolatedTrack(result.sequence, clampedProg);
        document.getElementById('statCurrentHead').textContent = Math.round(interpTrack);
        document.getElementById('statStepCounter').textContent = `Langkah ${activeIntStep} / ${totalSteps}`;
        document.getElementById('statTotalSeek').textContent = `${result.totalSeek} silinder`;
        document.getElementById('statAvgSeek').textContent = `${result.avgPerRequest} silinder`;

        if (activeIntStep === 0) {
            document.getElementById('statCurrentDistance').textContent = '0 silinder';
            document.getElementById('statEstStepMs').textContent = 'Posisi awal head';
            document.getElementById('statCumulativeSub').textContent = 'Ditempuh: 0 silinder';
            document.getElementById('decisionExplainText').textContent = 'Posisi awal head siap memulai simulasi.';
        } else {
            const stepData = result.steps[activeIntStep - 1];
            document.getElementById('statCurrentDistance').textContent = `${stepData.distance} silinder`;
            document.getElementById('statEstStepMs').textContent = `Est. ~${stepData.estMs} ms`;
            document.getElementById('statCumulativeSub').textContent = `Ditempuh: ${stepData.cumulativeSeek} silinder`;
            document.getElementById('decisionExplainText').textContent = stepData.reason;
        }

        // Highlight baris aktif di tabel
        const rows = document.querySelectorAll('#stepTraceBody tr');
        rows.forEach((tr) => {
            const sIdx = parseInt(tr.dataset.stepIndex, 10);
            tr.classList.toggle('bg-sky-950', sIdx === activeIntStep);
            tr.classList.toggle('text-sky-300', sIdx === activeIntStep);
        });
    }

    function setPlayButtonVisual(playing) {
        if (playing) {
            elPlayBtn.textContent = '⏸ Jeda';
            elPlayBtn.classList.replace('bg-sky-600', 'bg-amber-600');
            elPlayBtn.classList.replace('hover:bg-sky-500', 'hover:bg-amber-500');
        } else {
            elPlayBtn.textContent = '▶ Putar';
            elPlayBtn.classList.replace('bg-amber-600', 'bg-sky-600');
            elPlayBtn.classList.replace('hover:bg-amber-500', 'hover:bg-sky-500');
        }
    }

    function startDiskAnimation() {
        const total = state.scheduling.result ? state.scheduling.result.steps.length : 0;
        if (total === 0) return;
        if (state.scheduling.progress >= total - 0.01) {
            state.scheduling.progress = 0;
        }
        state.scheduling.isPlaying = true;
        state.scheduling.lastFrameTime = performance.now();
        setPlayButtonVisual(true);
    }

    function pauseDiskAnimation() {
        state.scheduling.isPlaying = false;
        setPlayButtonVisual(false);
    }

    function animationLoop(now) {
        const dt = Math.min(0.08, (now - state.scheduling.lastFrameTime) / 1000);
        state.scheduling.lastFrameTime = now;

        if (state.activeTab === 'scheduling' && state.scheduling.result && state.scheduling.isPlaying) {
            const totalSteps = state.scheduling.result.steps.length;
            state.scheduling.progress += dt * 1.2 * state.scheduling.speedMultiplier;
            if (state.scheduling.progress >= totalSteps) {
                state.scheduling.progress = totalSteps;
                pauseDiskAnimation();
            }
            updateSchedulingFrame();
        }

        requestAnimationFrame(animationLoop);
    }

    // Event Listener Scheduling
    [elAlgoSelect, elHeadInput, elMaxTrackInput, elDirectionSelect, elQueueInput].forEach(el => {
        el.addEventListener('change', () => calculateDiskSimulation(false));
    });

    elPlayBtn.addEventListener('click', () => {
        if (state.scheduling.isPlaying) pauseDiskAnimation();
        else startDiskAnimation();
    });

    document.getElementById('stepForwardBtn').addEventListener('click', () => {
        pauseDiskAnimation();
        const total = state.scheduling.result.steps.length;
        state.scheduling.progress = Math.min(total, Math.floor(state.scheduling.progress) + 1);
        updateSchedulingFrame();
    });

    document.getElementById('stepBackBtn').addEventListener('click', () => {
        pauseDiskAnimation();
        state.scheduling.progress = Math.max(0, Math.ceil(state.scheduling.progress) - 1);
        updateSchedulingFrame();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        pauseDiskAnimation();
        state.scheduling.progress = 0;
        updateSchedulingFrame();
    });

    elScrubber.addEventListener('input', (e) => {
        pauseDiskAnimation();
        state.scheduling.progress = parseFloat(e.target.value);
        updateSchedulingFrame();
    });

    elSpeedSelect.addEventListener('change', (e) => {
        state.scheduling.speedMultiplier = parseFloat(e.target.value) || 1.0;
    });

    // Preset Buttons
    document.getElementById('presetSilberschatzBtn').addEventListener('click', () => {
        elHeadInput.value = 53;
        elMaxTrackInput.value = 199;
        elDirectionSelect.value = 'high';
        elQueueInput.value = '98, 183, 37, 122, 14, 124, 65, 67';
        calculateDiskSimulation(false);
        showToast('Contoh soal buku Silberschatz dimuat.');
    });

    document.getElementById('clearQueueBtn').addEventListener('click', () => {
        document.getElementById('presetSilberschatzBtn').click();
    });

    document.getElementById('randomQueueBtn').addEventListener('click', () => {
        const max = parseInt(elMaxTrackInput.value, 10) || 199;
        const arr = Array.from({ length: 8 }, () => Math.floor(Math.random() * (max + 1)));
        elQueueInput.value = arr.join(', ');
        calculateDiskSimulation(false);
        showToast('8 antrian track acak berhasil dibuat.');
    });

    // Ekspor CSV
    document.getElementById('exportCsvBtn').addEventListener('click', () => {
        const res = state.scheduling.result;
        if (!res) return;
        const rows = [
            `Algoritma,${res.key} (${res.name})`,
            `Head Awal,${state.scheduling.head}`,
            `Total Seek Time,${res.totalSeek}`,
            '',
            'Langkah,Dari,Ke,Tipe,Jarak Silinder,Akumulasi Total,Keterangan'
        ];
        res.steps.forEach(s => {
            rows.push(`${s.step},${s.from},${s.to},${s.type},${s.distance},${s.cumulativeSeek},"${s.reason.replace(/"/g, '""')}"`);
        });
        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Hasil_Penjadwalan_${res.key}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Tabel hasil ${res.key} berhasil diunduh (CSV).`);
    });

    // Hover Tooltip Canvas
    const canvasEl = document.getElementById('diskCanvas');
    const tooltipEl = document.getElementById('canvasTooltip');

    canvasEl.addEventListener('mousemove', (e) => {
        const hitIdx = visualizer.hitTestNode(e.clientX, e.clientY);
        state.scheduling.hoveredNode = hitIdx;
        if (hitIdx !== -1 && state.scheduling.result) {
            const res = state.scheduling.result;
            const rect = canvasEl.getBoundingClientRect();
            const mx = Math.min(rect.width - 220, Math.max(10, e.clientX - rect.left + 12));
            const my = Math.max(10, e.clientY - rect.top - 18);

            tooltipEl.style.left = `${mx}px`;
            tooltipEl.style.top = `${my}px`;
            tooltipEl.classList.remove('opacity-0');

            if (hitIdx === 0) {
                tooltipEl.innerHTML = `<strong class="text-amber-400">Head Awal: Silinder ${res.sequence[0]}</strong>`;
            } else {
                const st = res.steps[hitIdx - 1];
                tooltipEl.innerHTML = `
                    <div class="font-bold text-sky-400">Langkah #${st.step}: ${st.from} → ${st.to}</div>
                    <div class="text-[11px] text-emerald-400">Jarak: +${st.distance} silinder (Total: ${st.cumulativeSeek})</div>
                    <div class="text-[10px] text-slate-300 mt-0.5">${st.reason}</div>
                `;
            }
        } else {
            tooltipEl.classList.add('opacity-0');
        }
    });

    canvasEl.addEventListener('mouseleave', () => {
        state.scheduling.hoveredNode = -1;
        tooltipEl.classList.add('opacity-0');
    });

    canvasEl.addEventListener('click', (e) => {
        const hitIdx = visualizer.hitTestNode(e.clientX, e.clientY);
        if (hitIdx !== -1) {
            pauseDiskAnimation();
            state.scheduling.progress = hitIdx;
            updateSchedulingFrame();
        }
    });

    // =========================================================================
    // 4. MODUL 2: ALOKASI BERKAS (FILE ALLOCATION)
    // =========================================================================
    const elAllocMethod = document.getElementById('allocMethodSelect');
    const elTotalBlocks = document.getElementById('totalBlocksSelect');
    const elFileName = document.getElementById('fileNameInput');
    const elFileSize = document.getElementById('fileSizeInput');
    const elFileColor = document.getElementById('fileColorInput');
    const elAllocAlert = document.getElementById('allocAlertMessage');
    const elReadSimFile = document.getElementById('readSimFileSelect');
    const elReadSimOffset = document.getElementById('readSimOffsetInput');
    const elReadSimResult = document.getElementById('readSimResultBox');

    function setAllocAlert(msg, type = 'success') {
        elAllocAlert.classList.remove('hidden', 'bg-emerald-950', 'border-emerald-800', 'text-emerald-300', 'bg-rose-950', 'border-rose-800', 'text-rose-300', 'bg-amber-950', 'border-amber-800', 'text-amber-300');
        if (type === 'error') {
            elAllocAlert.classList.add('bg-rose-950', 'border-rose-800', 'text-rose-300');
        } else if (type === 'warn') {
            elAllocAlert.classList.add('bg-amber-950', 'border-amber-800', 'text-amber-300');
        } else {
            elAllocAlert.classList.add('bg-emerald-950', 'border-emerald-800', 'text-emerald-300');
        }
        elAllocAlert.innerHTML = msg;
    }

    function renderAllocationUI() {
        document.getElementById('activeMethodBadge').textContent = fileSystem.method.toUpperCase();
        document.getElementById('defragBtn').style.display = fileSystem.method === 'contiguous' ? 'inline-block' : 'none';

        const stats = fileSystem.getStats();
        document.getElementById('statAllocTotal').textContent = stats.totalBlocks;
        document.getElementById('statAllocUsed').textContent = `${stats.usedBlocks} (${stats.usagePercent}%)`;
        document.getElementById('statAllocFree').textContent = stats.freeBlocks;
        document.getElementById('statAllocFragments').textContent = stats.freeFragments;
        document.getElementById('statFragRatio').textContent = `Frag: ${stats.fragmentationRatio}%`;
        document.getElementById('statAllocLargest').textContent = `${stats.largestFreeContiguous} blok`;
        document.getElementById('statUsageLabel').textContent = `${stats.usagePercent}% Terisi`;
        document.getElementById('statDiskProgressBar').style.width = `${stats.usagePercent}%`;

        // Render Grid Blok
        Visualizer.renderStorageGrid('storageGridContainer', fileSystem, {
            activeReadBlockId: state.allocation.activeReadBlockId,
            traversedBlockIds: state.allocation.traversedBlockIds,
            onBlockClick: (block) => {
                const box = document.getElementById('blockInspectorContent');
                if (block.status === 'free') {
                    box.textContent = `Blok #${block.id}: Status Kosong (Free). Siap dialokasikan.`;
                } else if (block.status === 'index') {
                    box.textContent = `Blok #${block.id}: Index Block untuk file "${block.fileName}". Pointer data: [${block.indexPointers.join(', ')}]`;
                } else {
                    const extra = fileSystem.method === 'linked' ? `Pointer berikut: #${block.nextBlock}` : `Blok data ke-${block.logicalIndex}`;
                    box.textContent = `Blok #${block.id}: Berkas "${block.fileName}". ${extra}`;
                }

                if (block.fileId) {
                    const f = fileSystem.files.find(item => item.id === block.fileId);
                    if (f) lockHighlight(f);
                }
            },
            onBlockHover: (block, isEnter) => {
                if (isEnter && block.fileId && !state.allocation.selectedFile) {
                    const f = fileSystem.files.find(item => item.id === block.fileId);
                    if (f && (fileSystem.method === 'linked' || fileSystem.method === 'indexed')) {
                        Visualizer.drawConnections('svgConnections', 'storageGridContainer', f);
                    }
                } else if (!isEnter && !state.allocation.selectedFile) {
                    Visualizer.clearConnections('svgConnections');
                }
            }
        });

        // Gambar ulang panah jika ada file yang dikunci
        if (state.allocation.selectedFile) {
            const exists = fileSystem.files.find(f => f.id === state.allocation.selectedFile.id);
            if (exists) {
                Visualizer.drawConnections('svgConnections', 'storageGridContainer', exists);
            } else {
                clearHighlight();
            }
        } else {
            Visualizer.clearConnections('svgConnections');
        }

        // Update Dropdown Uji Baca
        const prevId = parseInt(elReadSimFile.value, 10);
        elReadSimFile.innerHTML = '';
        if (fileSystem.files.length === 0) {
            elReadSimFile.innerHTML = `<option value="">-- Belum ada berkas --</option>`;
        } else {
            fileSystem.files.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.name} (0..${f.size - 1})`;
                if (f.id === prevId) opt.selected = true;
                elReadSimFile.appendChild(opt);
            });
        }

        // Render Tabel Direktori
        const dirBody = document.getElementById('fileDirectoryBody');
        dirBody.innerHTML = '';
        if (fileSystem.files.length === 0) {
            dirBody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-xs text-slate-500 italic">Belum ada berkas tersimpan di disk.</td></tr>`;
        } else {
            fileSystem.files.forEach(file => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-800/40 transition-colors text-xs font-mono';

                let metaHtml = '';
                if (file.method === 'contiguous') {
                    metaHtml = `Awal: <strong class="text-sky-300">#${file.startBlock}</strong>, Panjang: ${file.length} blok <span class="text-slate-400">[${file.startBlock}..${file.startBlock + file.length - 1}]</span>`;
                } else if (file.method === 'linked') {
                    metaHtml = `Awal: <strong class="text-sky-300">#${file.startBlock}</strong> → Akhir: <strong class="text-amber-300">#${file.endBlock}</strong> <div class="text-[10px] text-slate-400">${file.blocks.join(' → ')} → EOF</div>`;
                } else if (file.method === 'indexed') {
                    metaHtml = `Index Block: <strong class="text-amber-300">#${file.indexBlock}</strong> <div class="text-[10px] text-slate-400">Data: [${file.blocks.join(', ')}]</div>`;
                }

                tr.innerHTML = `
                    <td class="py-2.5 px-3 font-sans">
                        <span class="inline-block w-2.5 h-2.5 rounded-full mr-2" style="background:${file.color}"></span>
                        <strong class="text-slate-200">${file.name}</strong>
                    </td>
                    <td class="py-2.5 px-3">${file.size} blok</td>
                    <td class="py-2.5 px-3">${metaHtml}</td>
                    <td class="py-2.5 px-3 text-right font-sans whitespace-nowrap">
                        <button data-action="highlight" data-file-id="${file.id}" class="px-2 py-1 rounded bg-sky-900/40 hover:bg-sky-900/70 text-sky-300 text-[11px] font-medium mr-1">Sorot</button>
                        <button data-action="delete" data-file-id="${file.id}" class="px-2 py-1 rounded bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 text-[11px] font-medium">Hapus</button>
                    </td>
                `;
                dirBody.appendChild(tr);
            });
        }
    }

    function lockHighlight(file) {
        state.allocation.selectedFile = file;
        Visualizer.drawConnections('svgConnections', 'storageGridContainer', file);
        document.getElementById('clearSelectionBtn').classList.remove('hidden');
        document.querySelectorAll('.disk-block').forEach(el => {
            const bId = parseInt(el.dataset.blockId, 10);
            const match = (file.blocks && file.blocks.includes(bId)) || file.indexBlock === bId;
            el.classList.toggle('ring-2', match);
            el.classList.toggle('ring-white', match);
            el.classList.toggle('opacity-30', !match);
        });
    }

    function clearHighlight() {
        state.allocation.selectedFile = null;
        document.getElementById('clearSelectionBtn').classList.add('hidden');
        Visualizer.clearConnections('svgConnections');
        document.querySelectorAll('.disk-block').forEach(el => {
            el.classList.remove('ring-2', 'ring-white', 'opacity-30');
        });
    }

    document.getElementById('clearSelectionBtn').addEventListener('click', clearHighlight);

    elAllocMethod.addEventListener('change', (e) => {
        clearInterval(state.allocation.readAnimTimer);
        state.allocation.activeReadBlockId = null;
        state.allocation.traversedBlockIds = [];
        fileSystem.setMethod(e.target.value);
        clearHighlight();
        elReadSimResult.classList.add('hidden');
        setAllocAlert(`Metode alokasi diubah ke <strong>${e.target.selectedOptions[0].text}</strong>.`);
        renderAllocationUI();
    });

    elTotalBlocks.addEventListener('change', (e) => {
        fileSystem.totalBlocks = parseInt(e.target.value, 10) || 64;
        fileSystem.initDisk();
        clearHighlight();
        renderAllocationUI();
        showToast(`Kapasitas disk disetel ke ${fileSystem.totalBlocks} blok.`);
    });

    document.getElementById('addFileBtn').addEventListener('click', () => {
        const name = elFileName.value;
        const size = parseInt(elFileSize.value, 10);
        const color = elFileColor.value;
        const res = fileSystem.addFile(name, size, color);

        if (res.success) {
            setAllocAlert(res.message, 'success');
            elFileName.value = '';
            elFileColor.value = fileSystem._generateColor(fileSystem.nextFileId);
            renderAllocationUI();
            if (fileSystem.method !== 'contiguous') lockHighlight(res.file);
        } else {
            setAllocAlert(res.message, res.isFragmentation ? 'warn' : 'error');
        }
    });

    document.getElementById('defragBtn').addEventListener('click', () => {
        const res = fileSystem.defragment();
        setAllocAlert(res.message, 'success');
        renderAllocationUI();
    });

    document.getElementById('clearDiskBtn').addEventListener('click', () => {
        fileSystem.initDisk();
        clearHighlight();
        elReadSimResult.classList.add('hidden');
        setAllocAlert('Seluruh blok disk telah dikosongkan.', 'success');
        renderAllocationUI();
    });

    document.getElementById('fileDirectoryBody').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = parseInt(btn.dataset.fileId, 10);
        const action = btn.dataset.action;
        const file = fileSystem.files.find(f => f.id === id);

        if (action === 'delete') {
            const res = fileSystem.deleteFile(id);
            if (state.allocation.selectedFile?.id === id) clearHighlight();
            setAllocAlert(res.message, 'success');
            renderAllocationUI();
        } else if (action === 'highlight' && file) {
            lockHighlight(file);
        }
    });

    // Preset Skenario Cepat
    document.getElementById('scenarioFragBtn').addEventListener('click', () => {
        elAllocMethod.value = 'contiguous';
        clearHighlight();
        const res = fileSystem.loadScenario('fragmentation');
        elFileName.value = res.suggestedTestName || 'Master_ISO.img';
        elFileSize.value = res.suggestedTestSize || 12;
        setAllocAlert(res.message, 'warn');
        renderAllocationUI();
    });

    document.getElementById('scenarioLinkedBtn').addEventListener('click', () => {
        elAllocMethod.value = 'linked';
        clearHighlight();
        const res = fileSystem.loadScenario('linked_demo');
        setAllocAlert(res.message, 'success');
        renderAllocationUI();
        if (fileSystem.files[0]) lockHighlight(fileSystem.files[0]);
    });

    document.getElementById('scenarioIndexedBtn').addEventListener('click', () => {
        elAllocMethod.value = 'indexed';
        clearHighlight();
        const res = fileSystem.loadScenario('indexed_demo');
        setAllocAlert(res.message, 'success');
        renderAllocationUI();
        if (fileSystem.files[0]) lockHighlight(fileSystem.files[0]);
    });

    // Uji Baca Blok ke-k
    document.getElementById('runReadSimBtn').addEventListener('click', () => {
        clearInterval(state.allocation.readAnimTimer);
        const fileId = parseInt(elReadSimFile.value, 10);
        const offset = parseInt(elReadSimOffset.value, 10);
        const sim = fileSystem.simulateReadAccess(fileId, offset);

        elReadSimResult.classList.remove('hidden');
        if (!sim.success) {
            elReadSimResult.innerHTML = `<span class="text-rose-400 font-medium">${sim.message}</span>`;
            return;
        }

        lockHighlight(sim.file);
        state.allocation.traversedBlockIds = [];
        state.allocation.activeReadBlockId = null;

        let idx = 0;
        const runHop = () => {
            const hopObj = sim.trace[idx];
            state.allocation.activeReadBlockId = hopObj.blockId;
            if (idx > 0) {
                state.allocation.traversedBlockIds.push(sim.trace[idx - 1].blockId);
            }
            renderAllocationUI();

            elReadSimResult.innerHTML = `
                <div class="flex items-center justify-between font-mono font-bold text-sky-400">
                    <span>Operasi I/O: ${hopObj.hop} dari ${sim.ioOperations}</span>
                    <span class="text-emerald-400">${sim.complexity}</span>
                </div>
                <p class="text-slate-300 mt-1">${hopObj.desc}</p>
            `;

            idx++;
            if (idx >= sim.trace.length) {
                clearInterval(state.allocation.readAnimTimer);
            }
        };

        runHop();
        if (sim.trace.length > 1) {
            state.allocation.readAnimTimer = setInterval(runHop, 650);
        }
    });

    // =========================================================================
    // 5. MODUL 3: PERBANDINGAN ALGORITMA (BENCHMARK)
    // =========================================================================
    function renderComparison() {
        const { head, requests, direction, maxTrack } = state.scheduling;
        const results = DiskScheduler.compareAll(head, requests, direction, maxTrack);
        const sorted = [...results].sort((a, b) => a.totalSeek - b.totalSeek);
        const best = sorted[0];
        const fcfs = results.find(r => r.key === 'FCFS');

        document.getElementById('compDatasetBadge').textContent = `Head: ${head} • Max: ${maxTrack} • Antrian: ${requests.join(', ')}`;

        const savingPct = fcfs && fcfs.totalSeek > 0
            ? (((fcfs.totalSeek - best.totalSeek) / fcfs.totalSeek) * 100).toFixed(1)
            : '0.0';

        document.getElementById('comparisonWinnerCard').innerHTML = `
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 border-l-4 border-l-emerald-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <span class="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">Algoritma Paling Efisien untuk Dataset Ini</span>
                    <div class="text-xl font-bold text-white mt-0.5">${best.name} (${best.key})</div>
                    <p class="text-xs text-slate-400 mt-1">Total jarak seek hanya <strong class="text-emerald-400 font-mono">${best.totalSeek} silinder</strong> (rata-rata ${best.avgPerRequest} silinder per permintaan).</p>
                </div>
                <div class="sm:text-right p-3 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                    <div class="text-[10px] text-slate-400 uppercase font-semibold">Efisiensi Dibanding FCFS</div>
                    <div class="text-xl font-extrabold font-mono text-emerald-400">+${savingPct}% Lebih Hemat</div>
                </div>
            </div>
        `;

        // Chart.js Bar Chart
        const chartCanvas = document.getElementById('comparisonChart');
        if (chartCanvas && window.Chart) {
            if (comparisonChartInstance) comparisonChartInstance.destroy();

            comparisonChartInstance = new Chart(chartCanvas, {
                type: 'bar',
                data: {
                    labels: results.map(r => r.key),
                    datasets: [{
                        label: 'Total Seek Distance (Silinder)',
                        data: results.map(r => r.totalSeek),
                        backgroundColor: results.map(r => r.key === best.key ? '#10b981' : '#38bdf8'),
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(148, 163, 184, 0.1)' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#cbd5e1', font: { weight: 'bold' } }
                        }
                    }
                }
            });
        }

        // Tabel Perbandingan
        const compBody = document.getElementById('comparisonTableBody');
        compBody.innerHTML = '';
        sorted.forEach((r, idx) => {
            const diffPct = fcfs && fcfs.totalSeek > 0
                ? (((fcfs.totalSeek - r.totalSeek) / fcfs.totalSeek) * 100).toFixed(1)
                : '0.0';
            const tr = document.createElement('tr');
            tr.className = `text-xs ${idx === 0 ? 'bg-emerald-950/40 text-emerald-200' : 'hover:bg-slate-800/40'}`;
            tr.innerHTML = `
                <td class="py-2.5 px-3 font-sans">
                    <span class="font-bold text-white">#${idx + 1} ${r.key}</span>
                    <span class="text-slate-400 text-[11px] block">${r.name}</span>
                </td>
                <td class="py-2.5 px-3 text-right font-bold text-white">${r.totalSeek} silinder</td>
                <td class="py-2.5 px-3 text-right">${r.avgPerRequest} silinder</td>
                <td class="py-2.5 px-3 text-right">${r.maxJump} silinder</td>
                <td class="py-2.5 px-3 text-right ${parseFloat(diffPct) > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400'}">${parseFloat(diffPct) > 0 ? '+' : ''}${diffPct}%</td>
                <td class="py-2.5 px-3 font-sans text-[11px] text-slate-400 truncate max-w-xs" title="${r.sequence.join(' → ')}">${r.sequence.join(' → ')}</td>
            `;
            compBody.appendChild(tr);
        });
    }

    // Inisialisasi awal
    calculateDiskSimulation(true);
    renderAllocationUI();
    requestAnimationFrame(animationLoop);
});
