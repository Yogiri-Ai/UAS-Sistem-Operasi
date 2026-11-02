/**
 * DiskLab Studio v2.0 — Disk Scheduling Engine
 * Mengimplementasikan 6 algoritma penjadwalan disk standar akademis:
 * FCFS, SSTF, SCAN, C-SCAN, LOOK, dan C-LOOK
 * Lengkap dengan analisis alasan keputusan per langkah (Decision Trace) & metrik performa.
 */

class DiskScheduler {
    static ALGO_META = {
        'FCFS': {
            name: 'First-Come, First-Served',
            badge: 'Antrian FIFO Murni',
            color: '#f43f5e',
            summary: 'Melayani permintaan tepat sesuai urutan kedatangan tanpa optimasi posisi jarum head.'
        },
        'SSTF': {
            name: 'Shortest Seek Time First',
            badge: 'Greedy Jarak Terdekat',
            color: '#10b981',
            summary: 'Selalu memilih permintaan dengan jarak silinder terdekat dari posisi head saat ini. Sangat hemat namun berisiko starvation.'
        },
        'SCAN': {
            name: 'SCAN (Elevator Algorithm)',
            badge: 'Sapuan Dua Arah Penuh',
            color: '#38bdf8',
            summary: 'Bergerak menyapu satu arah hingga menyentuh batas silinder ujung disk, lalu berbalik arah seperti lift gedung.'
        },
        'C-SCAN': {
            name: 'Circular SCAN',
            badge: 'Sapuan Melingkar Seragam',
            color: '#a855f7',
            summary: 'Menyapu satu arah hingga batas ujung disk, melompat ke ujung awal tanpa melayani data, lalu menyapu kembali.'
        },
        'LOOK': {
            name: 'LOOK Algorithm',
            badge: 'Optimasi Batas SCAN',
            color: '#f59e0b',
            summary: 'Versi pintar SCAN: head langsung berbalik arah begitu mencapai permintaan terjauh tanpa membuang jarak ke ujung fisik disk.'
        },
        'C-LOOK': {
            name: 'Circular LOOK',
            badge: 'Optimasi Batas C-SCAN',
            color: '#06b6d4',
            summary: 'Versi pintar C-SCAN: berhenti di permintaan terjauh lalu langsung melompat ke permintaan terendah di sisi seberang.'
        }
    };

    static PRESETS = {
        silberschatz: {
            label: 'Buku Silberschatz (Klasik)',
            head: 53,
            maxTrack: 199,
            direction: 'high',
            requests: [98, 183, 37, 122, 14, 124, 65, 67],
            description: 'Contoh soal standar internasional dari buku Operating System Concepts (Silberschatz, Bab Mass-Storage Structure).'
        },
        starvation: {
            label: 'Kasus Starvation SSTF',
            head: 50,
            maxTrack: 199,
            direction: 'high',
            requests: [52, 48, 55, 44, 59, 40, 63, 192],
            description: 'Mendemonstrasikan kelemahan SSTF: permintaan jauh di silinder 192 terus ditunda karena head sibuk melayani silinder sekitar 40–63.'
        },
        heavy: {
            label: 'Beban Silang Ekstrem',
            head: 100,
            maxTrack: 199,
            direction: 'high',
            requests: [15, 180, 28, 165, 8, 194, 42, 145, 76, 120],
            description: 'Antrian bolak-balik ekstrem yang memperlihatkan penghematan drastis algoritma SCAN/LOOK dibanding FCFS.'
        }
    };

    /**
     * 1. FCFS (First-Come, First-Served)
     */
    static runFCFS(head, requests) {
        const events = [{ track: head, type: 'init', reason: `Posisi awal head berada di silinder ${head}.` }];
        requests.forEach((req, idx) => {
            events.push({
                track: req,
                type: 'request',
                reason: `Melayani antrian ke-${idx + 1} sesuai urutan kedatangan FIFO (Silinder ${req}).`
            });
        });
        return this._buildResult('FCFS', events, requests.length);
    }

    /**
     * 2. SSTF (Shortest Seek Time First)
     */
    static runSSTF(head, requests) {
        let currentHead = head;
        const pending = [...requests];
        const events = [{ track: head, type: 'init', reason: `Posisi awal head berada di silinder ${head}.` }];

        while (pending.length > 0) {
            let shortestDist = Infinity;
            let bestIndex = -1;
            let secondDist = Infinity;
            let secondTrack = null;

            for (let i = 0; i < pending.length; i++) {
                const dist = Math.abs(pending[i] - currentHead);
                if (dist < shortestDist) {
                    secondDist = shortestDist;
                    secondTrack = bestIndex !== -1 ? pending[bestIndex] : null;
                    shortestDist = dist;
                    bestIndex = i;
                } else if (dist < secondDist) {
                    secondDist = dist;
                    secondTrack = pending[i];
                }
            }

            const chosen = pending[bestIndex];
            const compareNote = secondTrack !== null && secondDist < Infinity
                ? ` (mengalahkan silinder ${secondTrack} yang berjarak ${secondDist} cyl)`
                : ' (permintaan terakhir yang tersisa)';

            events.push({
                track: chosen,
                type: 'request',
                reason: `Memilih silinder terdekat dari ${currentHead} → ${chosen} dengan jarak |${chosen} − ${currentHead}| = ${shortestDist} cyl${compareNote}.`
            });

            currentHead = chosen;
            pending.splice(bestIndex, 1);
        }

        return this._buildResult('SSTF', events, requests.length);
    }

    /**
     * 3. SCAN (Elevator Algorithm)
     */
    static runSCAN(head, requests, direction = 'high', maxTrack = 199) {
        const events = [{ track: head, type: 'init', reason: `Posisi awal head di silinder ${head}, arah sapuan awal menuju silinder ${direction === 'high' ? 'tinggi (kanan)' : 'rendah (kiri)'}.` }];
        const left = requests.filter(r => r < head).sort((a, b) => a - b);
        const right = requests.filter(r => r >= head).sort((a, b) => a - b);

        if (direction === 'high') {
            right.forEach(r => {
                events.push({
                    track: r,
                    type: 'request',
                    reason: `Menyapu searah naik (menuju ${maxTrack}) dan melayani permintaan pada silinder ${r}.`
                });
            });
            if (left.length > 0) {
                if (events[events.length - 1].track !== maxTrack) {
                    events.push({
                        track: maxTrack,
                        type: 'boundary',
                        reason: `Aturan SCAN: Head wajib menyentuh batas silinder maksimum (${maxTrack}) sebelum berbalik arah.`
                    });
                }
                [...left].reverse().forEach((r, idx) => {
                    events.push({
                        track: r,
                        type: 'request',
                        reason: idx === 0
                            ? `Berbalik arah menuju silinder rendah dan melayani permintaan pada silinder ${r}.`
                            : `Melanjutkan sapuan turun melayani permintaan pada silinder ${r}.`
                    });
                });
            }
        } else {
            [...left].reverse().forEach(r => {
                events.push({
                    track: r,
                    type: 'request',
                    reason: `Menyapu searah turun (menuju 0) dan melayani permintaan pada silinder ${r}.`
                });
            });
            if (right.length > 0) {
                if (events[events.length - 1].track !== 0) {
                    events.push({
                        track: 0,
                        type: 'boundary',
                        reason: `Aturan SCAN: Head wajib menyentuh batas silinder minimum (0) sebelum berbalik arah.`
                    });
                }
                right.forEach((r, idx) => {
                    events.push({
                        track: r,
                        type: 'request',
                        reason: idx === 0
                            ? `Berbalik arah menuju silinder tinggi dan melayani permintaan pada silinder ${r}.`
                            : `Melanjutkan sapuan naik melayani permintaan pada silinder ${r}.`
                    });
                });
            }
        }

        return this._buildResult('SCAN', events, requests.length);
    }

    /**
     * 4. C-SCAN (Circular SCAN)
     */
    static runCSCAN(head, requests, direction = 'high', maxTrack = 199) {
        const events = [{ track: head, type: 'init', reason: `Posisi awal head di silinder ${head}, sapuan melingkar satu arah (${direction === 'high' ? 'naik' : 'turun'}).` }];
        const left = requests.filter(r => r < head).sort((a, b) => a - b);
        const right = requests.filter(r => r >= head).sort((a, b) => a - b);

        if (direction === 'high') {
            right.forEach(r => {
                events.push({
                    track: r,
                    type: 'request',
                    reason: `Menyapu searah naik dan melayani permintaan pada silinder ${r}.`
                });
            });
            if (left.length > 0) {
                if (events[events.length - 1].track !== maxTrack) {
                    events.push({
                        track: maxTrack,
                        type: 'boundary',
                        reason: `Mencapai batas ujung akhir disk (Silinder ${maxTrack}).`
                    });
                }
                events.push({
                    track: 0,
                    type: 'jump',
                    reason: `Lompatan melingkar C-SCAN (${maxTrack} → 0) tanpa melayani permintaan di tengah agar waktu tunggu seragam.`
                });
                left.forEach(r => {
                    events.push({
                        track: r,
                        type: 'request',
                        reason: `Melanjutkan sapuan searah naik dari awal disk melayani silinder ${r}.`
                    });
                });
            }
        } else {
            [...left].reverse().forEach(r => {
                events.push({
                    track: r,
                    type: 'request',
                    reason: `Menyapu searah turun dan melayani permintaan pada silinder ${r}.`
                });
            });
            if (right.length > 0) {
                if (events[events.length - 1].track !== 0) {
                    events.push({
                        track: 0,
                        type: 'boundary',
                        reason: `Mencapai batas ujung awal disk (Silinder 0).`
                    });
                }
                events.push({
                    track: maxTrack,
                    type: 'jump',
                    reason: `Lompatan melingkar C-SCAN (0 → ${maxTrack}) tanpa melayani permintaan di tengah.`
                });
                [...right].reverse().forEach(r => {
                    events.push({
                        track: r,
                        type: 'request',
                        reason: `Melanjutkan sapuan searah turun dari ujung atas melayani silinder ${r}.`
                    });
                });
            }
        }

        return this._buildResult('C-SCAN', events, requests.length);
    }

    /**
     * 5. LOOK Algorithm
     */
    static runLOOK(head, requests, direction = 'high', maxTrack = 199) {
        const events = [{ track: head, type: 'init', reason: `Posisi awal head di silinder ${head}. LOOK hanya bergerak sejauh permintaan ekstrem.` }];
        const left = requests.filter(r => r < head).sort((a, b) => a - b);
        const right = requests.filter(r => r >= head).sort((a, b) => a - b);

        if (direction === 'high') {
            right.forEach((r, idx) => {
                const isLastRight = idx === right.length - 1 && left.length > 0;
                events.push({
                    track: r,
                    type: 'request',
                    reason: isLastRight
                        ? `Melayani permintaan tertinggi (${r}). Tidak ada request lagi di kanan, menghemat ${maxTrack - r} cyl tanpa perlu ke ${maxTrack}!`
                        : `Menyapu naik melayani permintaan pada silinder ${r}.`
                });
            });
            [...left].reverse().forEach((r, idx) => {
                events.push({
                    track: r,
                    type: 'request',
                    reason: idx === 0
                        ? `Langsung berbalik arah dari ${events[events.length - 1].track} menuju silinder ${r}.`
                        : `Menyapu turun melayani permintaan pada silinder ${r}.`
                });
            });
        } else {
            [...left].reverse().forEach((r, idx) => {
                const isLastLeft = idx === left.length - 1 && right.length > 0;
                events.push({
                    track: r,
                    type: 'request',
                    reason: isLastLeft
                        ? `Melayani permintaan terendah (${r}). Langsung berbalik arah tanpa perlu menyentuh silinder 0!`
                        : `Menyapu turun melayani permintaan pada silinder ${r}.`
                });
            });
            right.forEach(r => {
                events.push({
                    track: r,
                    type: 'request',
                    reason: `Menyapu naik melayani permintaan pada silinder ${r}.`
                });
            });
        }

        return this._buildResult('LOOK', events, requests.length);
    }

    /**
     * 6. C-LOOK Algorithm
     */
    static runCLOOK(head, requests, direction = 'high') {
        const events = [{ track: head, type: 'init', reason: `Posisi awal head di silinder ${head}. C-LOOK melompat antartitik permintaan ekstrem.` }];
        const left = requests.filter(r => r < head).sort((a, b) => a - b);
        const right = requests.filter(r => r >= head).sort((a, b) => a - b);

        if (direction === 'high') {
            right.forEach(r => {
                events.push({
                    track: r,
                    type: 'request',
                    reason: `Menyapu searah naik melayani silinder ${r}.`
                });
            });
            left.forEach((r, idx) => {
                events.push({
                    track: r,
                    type: idx === 0 ? 'jump' : 'request',
                    reason: idx === 0
                        ? `Lompatan melingkar C-LOOK langsung dari permintaan tertinggi (${events[events.length - 1].track}) ke permintaan terendah (${r}) lalu melayani data.`
                        : `Melanjutkan sapuan searah naik melayani silinder ${r}.`
                });
            });
        } else {
            [...left].reverse().forEach(r => {
                events.push({
                    track: r,
                    type: 'request',
                    reason: `Menyapu searah turun melayani silinder ${r}.`
                });
            });
            [...right].reverse().forEach((r, idx) => {
                events.push({
                    track: r,
                    type: idx === 0 ? 'jump' : 'request',
                    reason: idx === 0
                        ? `Lompatan melingkar C-LOOK langsung ke permintaan tertinggi (${r}) lalu melayani data.`
                        : `Melanjutkan sapuan searah turun melayani silinder ${r}.`
                });
            });
        }

        return this._buildResult('C-LOOK', events, requests.length);
    }

    /**
     * Jalankan berdasarkan kunci algoritma
     */
    static run(algoKey, head, requests, direction = 'high', maxTrack = 199) {
        switch (algoKey) {
            case 'FCFS': return this.runFCFS(head, requests);
            case 'SSTF': return this.runSSTF(head, requests);
            case 'SCAN': return this.runSCAN(head, requests, direction, maxTrack);
            case 'C-SCAN': return this.runCSCAN(head, requests, direction, maxTrack);
            case 'LOOK': return this.runLOOK(head, requests, direction, maxTrack);
            case 'C-LOOK': return this.runCLOOK(head, requests, direction);
            default: return this.runFCFS(head, requests);
        }
    }

    /**
     * Bandingkan keenam algoritma sekaligus pada dataset yang sama
     */
    static compareAll(head, requests, direction = 'high', maxTrack = 199) {
        return [
            this.runFCFS(head, requests),
            this.runSSTF(head, requests),
            this.runSCAN(head, requests, direction, maxTrack),
            this.runCSCAN(head, requests, direction, maxTrack),
            this.runLOOK(head, requests, direction, maxTrack),
            this.runCLOOK(head, requests, direction)
        ];
    }

    /**
     * Bangun objek hasil terstandarisasi
     */
    static _buildResult(key, events, requestCount) {
        const meta = this.ALGO_META[key] || { name: key, badge: '', color: '#38bdf8', summary: '' };
        const sequence = events.map(e => e.track);
        let totalSeek = 0;
        let maxJump = 0;
        let totalEstMs = 0;
        const steps = [];

        for (let i = 1; i < events.length; i++) {
            const from = events[i - 1].track;
            const to = events[i].track;
            const distance = Math.abs(to - from);
            totalSeek += distance;
            if (distance > maxJump) maxJump = distance;

            // Estimasi mekanis HDD: t_seek = 1.5ms settle + 0.28 * sqrt(distance) ms
            const estMs = distance === 0 ? 0 : +(1.5 + 0.28 * Math.sqrt(distance)).toFixed(2);
            totalEstMs += estMs;

            steps.push({
                step: i,
                from: from,
                to: to,
                distance: distance,
                cumulativeSeek: totalSeek,
                type: events[i].type,
                reason: events[i].reason,
                estMs: estMs
            });
        }

        const avgSeek = steps.length > 0 ? +(totalSeek / steps.length).toFixed(2) : 0;
        const avgPerRequest = requestCount > 0 ? +(totalSeek / requestCount).toFixed(2) : 0;

        return {
            key: key,
            name: meta.name,
            badge: meta.badge,
            color: meta.color,
            summary: meta.summary,
            sequence: sequence,
            events: events,
            steps: steps,
            totalSeek: totalSeek,
            avgSeek: avgSeek,
            avgPerRequest: avgPerRequest,
            maxJump: maxJump,
            estimatedTimeMs: +totalEstMs.toFixed(1),
            totalMoves: steps.length,
            requestCount: requestCount
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiskScheduler;
} else if (typeof window !== 'undefined') {
    window.DiskScheduler = DiskScheduler;
}
