/**
 * DiskLab Studio v2.0 — File Allocation Engine
 * Mengimplementasikan 3 metode alokasi berkas sistem operasi:
 * 1. Contiguous Allocation (mendukung First-Fit, Best-Fit, Worst-Fit)
 * 2. Linked Allocation (rantai pointer antarblok + representasi FAT)
 * 3. Indexed Allocation (blok indeks khusus + pemetaan blok data)
 * Dilengkapi Simulasi Operasi Baca Blok ke-k (Random Access I/O Cost Simulator).
 */

class FileAllocationSystem {
    constructor(totalBlocks = 64, method = 'contiguous') {
        this.totalBlocks = totalBlocks;
        this.method = method; // 'contiguous' | 'linked' | 'indexed'
        this.fitStrategy = 'first-fit'; // 'first-fit' | 'best-fit' | 'worst-fit'
        this.scatterAllocation = false; // Opsi alokasi tersebar realistis untuk Linked/Indexed
        this.blocks = [];
        this.files = [];
        this.nextFileId = 1;
        this.initDisk();
    }

    initDisk() {
        this.blocks = [];
        for (let i = 0; i < this.totalBlocks; i++) {
            this.blocks.push({
                id: i,
                status: 'free', // 'free' | 'allocated' | 'index' | 'reserved'
                fileId: null,
                fileName: null,
                logicalIndex: null,
                color: null,
                nextBlock: null,
                indexPointers: []
            });
        }
        this.files = [];
        this.nextFileId = 1;
    }

    setMethod(newMethod) {
        this.method = newMethod;
        this.scatterAllocation = (newMethod === 'linked' || newMethod === 'indexed');
        this.initDisk();
    }

    setFitStrategy(strategy) {
        this.fitStrategy = strategy;
    }

    toggleReservedBlock(blockId) {
        const blk = this.blocks[blockId];
        if (!blk) return { success: false, message: 'Blok tidak valid.' };
        if (blk.status === 'allocated' || blk.status === 'index') {
            return { success: false, message: `Blok #${blockId} sedang dipakai oleh berkas "${blk.fileName}".` };
        }
        if (blk.status === 'reserved') {
            blk.status = 'free';
            return { success: true, message: `Blok #${blockId} dikembalikan menjadi ruang bebas (FREE).` };
        } else {
            blk.status = 'reserved';
            return { success: true, message: `Blok #${blockId} ditandai sebagai Bad Sector / System Reserved.` };
        }
    }

    getFreeBlocksCount() {
        return this.blocks.filter(b => b.status === 'free').length;
    }

    getFreeRuns() {
        const runs = [];
        let start = -1;
        let len = 0;
        for (let i = 0; i < this.totalBlocks; i++) {
            if (this.blocks[i].status === 'free') {
                if (len === 0) start = i;
                len++;
            } else {
                if (len > 0) {
                    runs.push({ start, length: len, end: start + len - 1 });
                    len = 0;
                }
            }
        }
        if (len > 0) {
            runs.push({ start, length: len, end: start + len - 1 });
        }
        return runs;
    }

    addFile(name, size, color = null, customIndices = null) {
        if (!name || name.trim() === '') {
            return { success: false, message: 'Nama berkas tidak boleh kosong.' };
        }
        if (!Number.isInteger(size) || size <= 0) {
            return { success: false, message: 'Ukuran berkas harus minimal 1 blok bulat.' };
        }

        const trimmedName = name.trim();
        if (this.files.some(f => f.name.toLowerCase() === trimmedName.toLowerCase())) {
            return { success: false, message: `Berkas dengan nama "${trimmedName}" sudah ada di direktori!` };
        }

        const fileColor = color || this._generateColor(this.nextFileId);

        if (this.method === 'contiguous') {
            return this._allocateContiguous(trimmedName, size, fileColor);
        } else if (this.method === 'linked') {
            return this._allocateLinked(trimmedName, size, fileColor, customIndices);
        } else if (this.method === 'indexed') {
            return this._allocateIndexed(trimmedName, size, fileColor, customIndices);
        }

        return { success: false, message: 'Metode alokasi tidak dikenali.' };
    }

    /**
     * 1. CONTIGUOUS ALLOCATION (First-Fit / Best-Fit / Worst-Fit)
     */
    _allocateContiguous(name, size, color) {
        const freeRuns = this.getFreeRuns();
        const candidates = freeRuns.filter(r => r.length >= size);
        const freeCount = this.getFreeBlocksCount();

        if (candidates.length === 0) {
            if (freeCount >= size) {
                const holeSizes = freeRuns.map(r => `${r.length} blk`).join(', ');
                return {
                    success: false,
                    isFragmentation: true,
                    message: `Terjadi External Fragmentation! Total ruang kosong ada ${freeCount} blok (terpecah menjadi celah: ${holeSizes}), namun tidak ada ${size} blok yang berdampingan secara kontigu.`
                };
            }
            return {
                success: false,
                message: `Kapasitas disk tidak mencukupi. Tersisa ${freeCount} blok bebas, dibutuhkan ${size} blok.`
            };
        }

        let chosenRun = candidates[0];
        if (this.fitStrategy === 'best-fit') {
            chosenRun = candidates.reduce((best, cur) => (cur.length < best.length ? cur : best), candidates[0]);
        } else if (this.fitStrategy === 'worst-fit') {
            chosenRun = candidates.reduce((worst, cur) => (cur.length > worst.length ? cur : worst), candidates[0]);
        }

        const bestStart = chosenRun.start;
        const fileId = this.nextFileId++;
        const allocatedBlocks = [];

        for (let i = 0; i < size; i++) {
            const blkIdx = bestStart + i;
            this.blocks[blkIdx].status = 'allocated';
            this.blocks[blkIdx].fileId = fileId;
            this.blocks[blkIdx].fileName = name;
            this.blocks[blkIdx].logicalIndex = i;
            this.blocks[blkIdx].color = color;
            allocatedBlocks.push(blkIdx);
        }

        const newFile = {
            id: fileId,
            name: name,
            size: size,
            color: color,
            method: 'contiguous',
            fitUsed: this.fitStrategy,
            startBlock: bestStart,
            length: size,
            blocks: allocatedBlocks
        };

        this.files.push(newFile);

        return {
            success: true,
            message: `Berkas "${name}" (${size} blok) dialokasikan pada blok [${bestStart}..${bestStart + size - 1}] menggunakan strategi ${this.fitStrategy.toUpperCase()}.`,
            file: newFile
        };
    }

    /**
     * Ambil indeks blok bebas (sekuensial atau tersebar realistis)
     */
    _pickFreeBlocks(count, customIndices = null) {
        if (Array.isArray(customIndices) && customIndices.length === count) {
            const allFree = customIndices.every(idx => this.blocks[idx] && this.blocks[idx].status === 'free');
            if (allFree) return [...customIndices];
        }

        const available = [];
        for (let i = 0; i < this.totalBlocks; i++) {
            if (this.blocks[i].status === 'free') available.push(i);
        }

        if (!this.scatterAllocation || available.length <= count) {
            return available.slice(0, count);
        }

        // Pilih dengan lompatan deterministik-semi-acak agar visualisasi rantai pointer terlihat jelas
        const picked = [];
        const pool = [...available];
        let cursor = (this.nextFileId * 5) % pool.length;
        const stride = Math.max(2, Math.floor(pool.length / (count + 1)));

        while (picked.length < count && pool.length > 0) {
            cursor = cursor % pool.length;
            picked.push(pool[cursor]);
            pool.splice(cursor, 1);
            cursor += stride - 1;
        }
        return picked;
    }

    /**
     * 2. LINKED ALLOCATION
     */
    _allocateLinked(name, size, color, customIndices = null) {
        const freeCount = this.getFreeBlocksCount();
        if (freeCount < size) {
            return {
                success: false,
                message: `Kapasitas disk tidak mencukupi. Tersisa ${freeCount} blok bebas, dibutuhkan ${size} blok.`
            };
        }

        const freeIndices = this._pickFreeBlocks(size, customIndices);
        const fileId = this.nextFileId++;

        for (let i = 0; i < freeIndices.length; i++) {
            const blockIndex = freeIndices[i];
            const nextIdx = (i < freeIndices.length - 1) ? freeIndices[i + 1] : -1;

            this.blocks[blockIndex].status = 'allocated';
            this.blocks[blockIndex].fileId = fileId;
            this.blocks[blockIndex].fileName = name;
            this.blocks[blockIndex].logicalIndex = i;
            this.blocks[blockIndex].color = color;
            this.blocks[blockIndex].nextBlock = nextIdx;
        }

        const newFile = {
            id: fileId,
            name: name,
            size: size,
            color: color,
            method: 'linked',
            startBlock: freeIndices[0],
            endBlock: freeIndices[freeIndices.length - 1],
            blocks: freeIndices
        };

        this.files.push(newFile);

        return {
            success: true,
            message: `Berkas "${name}" dialokasikan secara Linked List (Start: #${newFile.startBlock} → ... → End: #${newFile.endBlock} [EOF]). Bebas fragmentasi eksternal!`,
            file: newFile
        };
    }

    /**
     * 3. INDEXED ALLOCATION
     */
    _allocateIndexed(name, size, color, customIndices = null) {
        const requiredBlocks = size + 1;
        const freeCount = this.getFreeBlocksCount();

        if (freeCount < requiredBlocks) {
            return {
                success: false,
                message: `Kapasitas tidak cukup. Indexed Allocation butuh ${requiredBlocks} blok (1 Index Block + ${size} Data Block), tersisa ${freeCount} blok.`
            };
        }

        const freeIndices = this._pickFreeBlocks(requiredBlocks, customIndices);
        const fileId = this.nextFileId++;
        const indexBlockIndex = freeIndices[0];
        const dataBlockIndices = freeIndices.slice(1);

        this.blocks[indexBlockIndex].status = 'index';
        this.blocks[indexBlockIndex].fileId = fileId;
        this.blocks[indexBlockIndex].fileName = name;
        this.blocks[indexBlockIndex].logicalIndex = -1;
        this.blocks[indexBlockIndex].color = color;
        this.blocks[indexBlockIndex].indexPointers = [...dataBlockIndices];

        dataBlockIndices.forEach((dataIdx, logicalIdx) => {
            this.blocks[dataIdx].status = 'allocated';
            this.blocks[dataIdx].fileId = fileId;
            this.blocks[dataIdx].fileName = name;
            this.blocks[dataIdx].logicalIndex = logicalIdx;
            this.blocks[dataIdx].color = color;
            this.blocks[dataIdx].nextBlock = null;
        });

        const newFile = {
            id: fileId,
            name: name,
            size: size,
            color: color,
            method: 'indexed',
            indexBlock: indexBlockIndex,
            blocks: dataBlockIndices,
            allBlocks: freeIndices
        };

        this.files.push(newFile);

        return {
            success: true,
            message: `Berkas "${name}" dialokasikan dengan Index Block #${indexBlockIndex} yang menunjuk langsung ke ${size} blok data.`,
            file: newFile
        };
    }

    deleteFile(fileId) {
        const fileIndex = this.files.findIndex(f => f.id === fileId);
        if (fileIndex === -1) {
            return { success: false, message: 'Berkas tidak ditemukan.' };
        }

        const file = this.files[fileIndex];

        for (let i = 0; i < this.totalBlocks; i++) {
            if (this.blocks[i].fileId === fileId) {
                this.blocks[i].status = 'free';
                this.blocks[i].fileId = null;
                this.blocks[i].fileName = null;
                this.blocks[i].logicalIndex = null;
                this.blocks[i].color = null;
                this.blocks[i].nextBlock = null;
                this.blocks[i].indexPointers = [];
            }
        }

        this.files.splice(fileIndex, 1);

        return {
            success: true,
            message: `Berkas "${file.name}" dihapus dan seluruh bloknya telah dibebaskan.`
        };
    }

    defragment() {
        if (this.method !== 'contiguous') {
            return { success: false, message: 'Kompaksi/defragmentasi ditujukan untuk Contiguous Allocation.' };
        }

        const oldFiles = [...this.files];
        const reservedIds = this.blocks.filter(b => b.status === 'reserved').map(b => b.id);
        this.initDisk();
        reservedIds.forEach(id => { this.blocks[id].status = 'reserved'; });

        let cursor = 0;
        for (const f of oldFiles) {
            // Cari slot berurutan mulai dari cursor
            this._allocateContiguousWithId(f, cursor);
            cursor = f.startBlock + f.length;
        }
        this.nextFileId = oldFiles.reduce((m, f) => Math.max(m, f.id), 0) + 1;

        return {
            success: true,
            message: 'Kompaksi (Defragmentasi) selesai! Seluruh berkas telah dirapatkan dan ruang kosong kini menyatu utuh.'
        };
    }

    _allocateContiguousWithId(fileObj, minStart) {
        const runs = this.getFreeRuns().filter(r => r.end >= minStart && r.length >= fileObj.size);
        const start = runs.length > 0 ? runs[0].start : this.getFreeRuns().find(r => r.length >= fileObj.size).start;
        const allocated = [];
        for (let i = 0; i < fileObj.size; i++) {
            const idx = start + i;
            this.blocks[idx].status = 'allocated';
            this.blocks[idx].fileId = fileObj.id;
            this.blocks[idx].fileName = fileObj.name;
            this.blocks[idx].logicalIndex = i;
            this.blocks[idx].color = fileObj.color;
            allocated.push(idx);
        }
        fileObj.startBlock = start;
        fileObj.blocks = allocated;
        this.files.push(fileObj);
    }

    /**
     * SIMULASI BACA BLOK KE-K (RANDOM ACCESS I/O VISUALIZER)
     * Membuktikan perbedaan kompleksitas akses O(1) vs O(k) vs Index Lookup!
     */
    simulateReadAccess(fileId, logicalOffset) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return { success: false, message: 'Pilih berkas terlebih dahulu.' };
        if (logicalOffset < 0 || logicalOffset >= file.size) {
            return { success: false, message: `Offset blok logis harus antara 0 s/d ${file.size - 1}.` };
        }

        const trace = [];
        if (file.method === 'contiguous') {
            const targetPhys = file.startBlock + logicalOffset;
            trace.push({
                hop: 1,
                blockId: targetPhys,
                role: 'target',
                desc: `Kalkulasi ALU langsung: Start (${file.startBlock}) + Offset (${logicalOffset}) = Blok #${targetPhys}. Akses 1x I/O!`
            });
            return {
                success: true,
                file,
                logicalOffset,
                ioOperations: 1,
                complexity: 'O(1) — Direct Arithmetic Access',
                trace,
                summary: `Contiguous hanya butuh 1 operasi I/O disk: langsung menuju Blok #${targetPhys}.`
            };
        } else if (file.method === 'linked') {
            for (let i = 0; i <= logicalOffset; i++) {
                const blk = file.blocks[i];
                const isTarget = i === logicalOffset;
                trace.push({
                    hop: i + 1,
                    blockId: blk,
                    role: isTarget ? 'target' : 'traverse',
                    desc: isTarget
                        ? `Tiba di blok target logis ke-${logicalOffset} pada Blok Fisik #${blk}!`
                        : `Baca Blok #${blk} (blok logis ke-${i}) untuk mengambil pointer menuju Blok #${file.blocks[i + 1]}.`
                });
            }
            return {
                success: true,
                file,
                logicalOffset,
                ioOperations: logicalOffset + 1,
                complexity: `O(k) — Sequential Pointer Hopping (${logicalOffset + 1} I/O)`,
                trace,
                summary: `Linked Allocation harus menelusuri ${logicalOffset + 1} blok satu per satu dari awal rantai untuk mencapai offset ke-${logicalOffset}!`
            };
        } else if (file.method === 'indexed') {
            const targetPhys = file.blocks[logicalOffset];
            trace.push({
                hop: 1,
                blockId: file.indexBlock,
                role: 'index',
                desc: `Baca Index Block #${file.indexBlock}, ambil entri indeks[${logicalOffset}] → menunjuk ke Blok #${targetPhys}.`
            });
            trace.push({
                hop: 2,
                blockId: targetPhys,
                role: 'target',
                desc: `Lompat langsung ke Blok Data #${targetPhys} tanpa menelusuri blok data lain!`
            });
            return {
                success: true,
                file,
                logicalOffset,
                ioOperations: 2,
                complexity: 'O(1) — Indexed Lookup (2 I/O: 1 Index + 1 Data)',
                trace,
                summary: `Indexed Allocation cukup membaca Index Block #${file.indexBlock} lalu langsung melompat ke Blok #${targetPhys} (2x I/O).`
            };
        }

        return { success: false, message: 'Metode tidak didukung.' };
    }

    getStats() {
        const freeCount = this.getFreeBlocksCount();
        const allocatedCount = this.blocks.filter(b => b.status === 'allocated').length;
        const indexCount = this.blocks.filter(b => b.status === 'index').length;
        const reservedCount = this.blocks.filter(b => b.status === 'reserved').length;
        const usedCount = allocatedCount + indexCount + reservedCount;
        const usagePercent = +((usedCount / this.totalBlocks) * 100).toFixed(1);

        const freeRuns = this.getFreeRuns();
        const largestFreeContiguous = freeRuns.reduce((max, r) => Math.max(max, r.length), 0);

        // Hitung persentase fragmentasi eksternal: 1 - (largestFree / totalFree)
        const fragmentationRatio = freeCount > 0 && freeRuns.length > 1
            ? +(((freeCount - largestFreeContiguous) / freeCount) * 100).toFixed(0)
            : 0;

        return {
            totalBlocks: this.totalBlocks,
            freeBlocks: freeCount,
            allocatedBlocks: allocatedCount,
            indexBlocks: indexCount,
            reservedBlocks: reservedCount,
            usedBlocks: usedCount,
            usagePercent: usagePercent,
            freeFragments: freeRuns.length,
            freeRuns: freeRuns,
            largestFreeContiguous: largestFreeContiguous,
            fragmentationRatio: fragmentationRatio,
            totalFiles: this.files.length
        };
    }

    loadScenario(type) {
        this.initDisk();

        if (type === 'fragmentation') {
            this.method = 'contiguous';
            this.scatterAllocation = false;
            this.addFile('Kernel.sys', 6, '#38bdf8');
            this.addFile('Laporan.docx', 8, '#10b981');
            this.addFile('Foto_Lab.png', 6, '#f59e0b');
            this.addFile('Database.sql', 10, '#ec4899');
            this.addFile('Modul_SO.pdf', 8, '#8b5cf6');

            const remaining = this.getFreeBlocksCount();
            if (remaining > 0) {
                this.addFile('SystemSwap.bin', remaining, '#64748b');
            }

            const f2 = this.files.find(f => f.name === 'Laporan.docx');
            const f4 = this.files.find(f => f.name === 'Database.sql');
            if (f2) this.deleteFile(f2.id);
            if (f4) this.deleteFile(f4.id);

            return {
                success: true,
                isWarning: true,
                suggestedTestSize: 12,
                suggestedTestName: 'Master_ISO.img',
                message: 'Skenario Fragmentasi Kontigu aktif: Tersedia 18 blok kosong namun terbelah menjadi 2 celah (8 blok & 10 blok). Klik tombol "Alokasikan Berkas" di kiri (ukuran sudah diset 12 blok) untuk membuktikan External Fragmentation!'
            };
        } else if (type === 'linked_demo') {
            this.method = 'linked';
            this.scatterAllocation = true;
            this.addFile('Log_Server.txt', 6, '#38bdf8', [2, 11, 19, 28, 37, 46]);
            this.addFile('Dataset_AI.csv', 7, '#10b981', [5, 14, 21, 30, 41, 52, 60]);
            this.addFile('Podcast.mp3', 5, '#f59e0b', [8, 17, 25, 34, 49]);
            return {
                success: true,
                message: 'Skenario Linked Allocation dimuat! Arahkan kursor atau klik "Sorot" pada berkas untuk melihat aliran rantai pointer, atau jalankan Simulasi Baca Blok ke-k!'
            };
        } else if (type === 'indexed_demo') {
            this.method = 'indexed';
            this.scatterAllocation = true;
            this.addFile('App_Bundle.tar', 6, '#a855f7', [9, 1, 3, 18, 27, 44, 58]);
            this.addFile('Slides_UAS.pptx', 5, '#06b6d4', [20, 6, 13, 31, 47, 61]);
            return {
                success: true,
                message: 'Skenario Indexed Allocation dimuat! Blok berbingkai emas adalah Index Block yang menyimpan seluruh alamat blok data berkas secara terpusat.'
            };
        }

        return { success: false, message: 'Skenario tidak ditemukan.' };
    }

    _generateColor(id) {
        const palette = [
            '#38bdf8', '#10b981', '#f59e0b', '#f43f5e',
            '#a855f7', '#06b6d4', '#ec4899', '#84cc16',
            '#fb923c', '#6366f1', '#14b8a6', '#eab308'
        ];
        return palette[(id - 1) % palette.length];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileAllocationSystem;
} else if (typeof window !== 'undefined') {
    window.FileAllocationSystem = FileAllocationSystem;
}
