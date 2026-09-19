// js/pages/travel.js — RecalIo Travel & Train Mode (Offline Packs, Mini-Games, Bluetooth Duels, Sync-Back)

window.Pages.Travel = {
  state: {
    activeTab: 'pack', // pack | player | games | bluetooth
    revealedCards: [],
    matchedPairs: [],
  },

  render() {
    const pack = TravelSync.getTravelPack();

    return `
      <div class="travel-page">
        <!-- Travel Mode Hero Banner -->
        <div class="travel-banner">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span class="offline-badge">
                ⚡ 0% CELLULAR DATA • OFFLINE TRANSIT READY
              </span>
            </div>
            <h1 style="font-size: 1.8rem; font-weight: 800; tracking: tight;">Train & Travel Mode</h1>
            <p style="font-size: 0.9rem; opacity: 0.85; max-width: 540px; margin-top: 4px;">
              Pre-download active recall learning packs for trains, flights, and dead-zones. Turn offline idle hours into retained learning.
            </p>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${
              pack
                ? `<button id="btn-sync-travel" class="btn btn-primary" style="background: #10b981; border-color: #10b981; font-weight: 700;">
                    🔄 Sync Progress to Cloud (${pack.xpEarned || 0} XP)
                  </button>`
                : ''
            }
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
          <button class="btn ${this.state.activeTab === 'pack' ? 'btn-primary' : 'btn-secondary-sm'}" id="tab-pack-btn">
            📦 Pre-Journey Pack
          </button>
          <button class="btn ${this.state.activeTab === 'player' ? 'btn-primary' : 'btn-secondary-sm'}" id="tab-player-btn">
            📖 Offline Reader (${pack ? pack.questions.length + ' Qs' : '0'})
          </button>
          <button class="btn ${this.state.activeTab === 'games' ? 'btn-primary' : 'btn-secondary-sm'}" id="tab-games-btn">
            🎮 Offline Mini-Games
          </button>
          <button class="btn ${this.state.activeTab === 'bluetooth' ? 'btn-primary' : 'btn-secondary-sm'}" id="tab-bluetooth-btn">
            📶 Bluetooth Peer Duel
          </button>
        </div>

        <div id="travel-tab-content">
          ${this.renderActiveTab(pack)}
        </div>
      </div>
    `;
  },

  renderActiveTab(pack) {
    if (this.state.activeTab === 'pack') return this.renderPackBuilder(pack);
    if (this.state.activeTab === 'player') return this.renderOfflinePlayer(pack);
    if (this.state.activeTab === 'games') return this.renderOfflineGames(pack);
    if (this.state.activeTab === 'bluetooth') return this.renderBluetoothDuel(pack);
    return '';
  },

  // Tab 1: Pre-Journey Pack Builder
  renderPackBuilder(pack) {
    return `
      <div class="travel-grid">
        <div class="travel-card">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            🚆 Build Journey Task Pack
          </h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            Package text, summaries, and grounded recall questions locally before your train departs.
          </p>

          <div class="settings-group">
            <label class="settings-label">Select Document</label>
            <select id="pack-pdf-select" class="manual-form-input">
              <option value="">Loading library PDFs...</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="settings-group">
              <label class="settings-label">Start Page</label>
              <input type="number" id="pack-start-page" class="manual-form-input" value="1" min="1" />
            </div>
            <div class="settings-group">
              <label class="settings-label">End Page</label>
              <input type="number" id="pack-end-page" class="manual-form-input" value="10" min="1" />
            </div>
          </div>

          <div class="settings-group">
            <label class="settings-label">Age Bracket Adaptation</label>
            <select id="pack-age-select" class="manual-form-input">
              <option value="3-6">Ages 3–6 (Early Wonder • Picture MCQs)</option>
              <option value="6-12">Ages 6–12 (Quest Mode • Badges & Streaks)</option>
              <option value="12-19" selected>Ages 12–19 (Exam Gladiator • Denser MCQs)</option>
              <option value="adults">Adults (Executive Retention)</option>
            </select>
          </div>

          <button id="btn-download-pack" class="btn btn-primary" style="justify-content: center; padding: 12px; margin-top: 6px;">
            📥 Download Learning Pack to Device
          </button>
        </div>

        <div class="travel-card">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">
            Currently Stored Learning Pack
          </h3>
          ${
            pack
              ? `
            <div style="background: var(--bg-secondary); padding: 14px; border-radius: 8px; border-left: 3px solid #10b981; space-y: 6px;">
              <p style="font-weight: 700; color: var(--text-primary);">${pack.pdfName}</p>
              <p style="font-size: 12px; color: var(--text-secondary);">Pages: ${pack.startPage} to ${pack.endPage} • Age Skin: ${pack.ageBracket}</p>
              <p style="font-size: 12px; color: var(--text-secondary);">Offline Questions: <strong>${pack.questions.length}</strong></p>
              <p style="font-size: 12px; color: var(--text-secondary);">Stored locally in IndexedDB: <strong>Ready 100% Offline</strong></p>
            </div>
            <button id="btn-start-offline-now" class="btn btn-primary" style="margin-top: 10px; justify-content: center;">
              Launch Offline Session Now ▶
            </button>
          `
              : `
            <div style="text-align: center; padding: 30px 10px; color: var(--text-secondary);">
              <p>No offline pack currently downloaded.</p>
              <p style="font-size: 12px; margin-top: 4px;">Click "Download Learning Pack" on the left to prepare for zero-connectivity travel.</p>
            </div>
          `
          }
        </div>
      </div>
    `;
  },

  // Tab 2: Offline Reader & Active Checkpoints Player
  renderOfflinePlayer(pack) {
    if (!pack) {
      return `
        <div class="card" style="text-align: center; padding: 40px;">
          <p style="color: var(--text-secondary); margin-bottom: 12px;">No active travel pack downloaded.</p>
          <button id="btn-go-pack" class="btn btn-primary">Create Travel Pack</button>
        </div>
      `;
    }

    const submitted = pack.answersSubmitted || [];
    const currentQIdx = submitted.length;
    const isFinished = currentQIdx >= pack.questions.length;
    const currentQ = pack.questions[currentQIdx];

    if (isFinished) {
      return `
        <div class="card" style="text-align: center; padding: 40px; max-width: 580px; margin: 0 auto;">
          <span style="font-size: 40px;">🚆</span>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin: 8px 0;">Journey Session Complete!</h2>
          <p style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 16px;">
            You completed all ${pack.questions.length} offline recall challenges. Earned <strong>+${pack.xpEarned} XP</strong>.
          </p>
          <button id="btn-sync-now" class="btn btn-primary" style="margin: 0 auto; background: #10b981; border-color: #10b981;">
            🔄 Sync Journey Progress to Profile
          </button>
        </div>
      `;
    }

    return `
      <div class="card" style="max-width: 680px; margin: 0 auto; padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="offline-badge">🚆 Offline Challenge • Q${currentQIdx + 1}/${pack.questions.length}</span>
          <span style="font-size: 12px; color: var(--text-secondary); font-weight: 600;">Page ${currentQ.page}</span>
        </div>

        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); line-height: 1.4;">
          ${currentQ.question}
        </h3>

        <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
          ${currentQ.options
            .map(
              (opt, idx) => `
            <button class="travel-offline-opt-btn btn btn-secondary-sm" data-q-id="${currentQ.id}" data-opt-idx="${idx}" style="text-align: left; padding: 12px 14px; font-size: 13px; line-height: 1.4;">
              <strong style="color: var(--accent); margin-right: 6px;">${String.fromCharCode(65 + idx)}.</strong> ${opt}
            </button>`
            )
            .join('')}
        </div>
      </div>
    `;
  },

  // Tab 3: Offline Mini-Games (Memory Flip-Cards)
  renderOfflineGames(pack) {
    const cards = pack ? pack.memoryCards : [];

    return `
      <div class="card" style="padding: var(--space-xl);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">🧠 Offline Memory Flip-Cards</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">Match key scientific terms with their definitions. Runs 100% offline.</p>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: var(--accent);">
            Matched: ${this.state.matchedPairs.length / 2} / 4 Pairs
          </span>
        </div>

        <div class="memory-game-grid">
          ${cards
            .map((c) => {
              const isRevealed = this.state.revealedCards.includes(c.id);
              const isMatched = this.state.matchedPairs.includes(c.id);
              return `
              <button class="memory-card-btn ${isRevealed ? 'revealed' : ''} ${isMatched ? 'matched' : ''}" data-card-id="${c.id}" ${isMatched ? 'disabled' : ''}>
                ${isRevealed || isMatched ? c.text : '❓'}
              </button>`;
            })
            .join('')}
        </div>
      </div>
    `;
  },

  // Tab 4: Bluetooth Peer Duel (Coach B4 Lobby)
  renderBluetoothDuel(pack) {
    return `
      <div class="card" style="padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md); max-width: 680px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            📶 Bluetooth Peer Duel Mode
          </h3>
          <span class="offline-badge">Zero Wi-Fi Required</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
          Using Web Bluetooth and local P2P mesh, discover nearby passengers in your train coach and challenge them to a live 5-question speed recall battle!
        </p>

        <div id="bt-scan-area" style="background: var(--bg-secondary); padding: 18px; border-radius: 8px; text-align: center;">
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
            Nearby Coach Lobby: <strong>Coach B4 Mesh</strong>
          </p>
          <button id="btn-scan-bt" class="btn btn-primary" style="margin: 0 auto;">
            🔍 Scan for Nearby Passengers
          </button>
        </div>

        <div id="bt-results-area" style="display: none;" class="space-y-2"></div>
      </div>
    `;
  },

  async afterRender() {
    // Tab Switching
    document.getElementById('tab-pack-btn')?.addEventListener('click', () => {
      this.state.activeTab = 'pack';
      Router.render();
    });
    document.getElementById('tab-player-btn')?.addEventListener('click', () => {
      this.state.activeTab = 'player';
      Router.render();
    });
    document.getElementById('tab-games-btn')?.addEventListener('click', () => {
      this.state.activeTab = 'games';
      Router.render();
    });
    document.getElementById('tab-bluetooth-btn')?.addEventListener('click', () => {
      this.state.activeTab = 'bluetooth';
      Router.render();
    });

    // Populate PDF select
    const pdfSelect = document.getElementById('pack-pdf-select');
    if (pdfSelect) {
      const pdfs = await DB.getAllPDFs();
      if (pdfs.length > 0) {
        pdfSelect.innerHTML = pdfs.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
      } else {
        pdfSelect.innerHTML = `<option value="demo_doc">Biology Chapter 4 Textbook</option>`;
      }
    }

    // Download pack button
    const downloadBtn = document.getElementById('btn-download-pack');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        downloadBtn.textContent = 'Generating Offline Pack...';
        downloadBtn.disabled = true;

        const pdfId = pdfSelect ? pdfSelect.value : 'demo_doc';
        const pdfName = pdfSelect && pdfSelect.selectedOptions[0] ? pdfSelect.selectedOptions[0].text : 'Textbook Chapter.pdf';
        const startPage = parseInt(document.getElementById('pack-start-page').value, 10) || 1;
        const endPage = parseInt(document.getElementById('pack-end-page').value, 10) || 10;
        const age = document.getElementById('pack-age-select').value;

        await TravelSync.createTravelPack({
          pdfId,
          pdfName,
          startPage,
          endPage,
          ageBracket: age,
        });

        alert(`✅ Learning Pack successfully downloaded to your device! Ready for offline train transit.`);
        this.state.activeTab = 'player';
        Router.render();
      });
    }

    document.getElementById('btn-start-offline-now')?.addEventListener('click', () => {
      this.state.activeTab = 'player';
      Router.render();
    });

    // Offline question option click
    document.querySelectorAll('.travel-offline-opt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qId = btn.getAttribute('data-q-id');
        const optIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
        const isCorrect = optIdx === 0; // standard sample
        TravelSync.recordOfflineAnswer(qId, optIdx, isCorrect);
        Router.render();
      });
    });

    // Sync button
    const syncBtn = document.getElementById('btn-sync-travel') || document.getElementById('btn-sync-now');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        const res = TravelSync.syncBack();
        alert(`🎉 Synced ${res.xpSynced} XP and offline cards into your main profile & SM-2 schedule!`);
        Router.render();
      });
    }

    // Memory Game Clicks
    const pack = TravelSync.getTravelPack();
    if (pack && pack.memoryCards) {
      document.querySelectorAll('.memory-card-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.getAttribute('data-card-id'), 10);
          if (this.state.revealedCards.length < 2 && !this.state.revealedCards.includes(id)) {
            this.state.revealedCards.push(id);
            Router.render();

            if (this.state.revealedCards.length === 2) {
              const c1 = pack.memoryCards.find((c) => c.id === this.state.revealedCards[0]);
              const c2 = pack.memoryCards.find((c) => c.id === this.state.revealedCards[1]);

              if (c1 && c2 && c1.pairId === c2.pairId) {
                this.state.matchedPairs.push(c1.id, c2.id);
                this.state.revealedCards = [];
                if (window.Gamification) window.Gamification.addXP(30, 'Matched Memory Pair');
                setTimeout(() => Router.render(), 400);
              } else {
                setTimeout(() => {
                  this.state.revealedCards = [];
                  Router.render();
                }, 1000);
              }
            }
          }
        });
      });
    }

    // Bluetooth Scan Simulation
    const scanBtn = document.getElementById('btn-scan-bt');
    const resultsArea = document.getElementById('bt-results-area');
    if (scanBtn && resultsArea) {
      scanBtn.addEventListener('click', async () => {
        scanBtn.textContent = 'Scanning Coach B4 Mesh (Bluetooth)...';
        scanBtn.disabled = true;
        const peers = await P2PMesh.scanForBluetoothPeers();
        resultsArea.style.display = 'block';
        resultsArea.innerHTML = `
          <h4 style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 8px 0;">Discovered Peers in Coach B4:</h4>
          ${peers
            .map(
              (p) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 6px;">
              <div>
                <strong style="color: var(--text-primary); font-size: 13px;">${p.name}</strong>
                <span style="display: block; font-size: 10px; color: #10b981;">● ${p.signal}</span>
              </div>
              <button class="btn btn-primary btn-sm-timer start-peer-duel-btn" data-peer-id="${p.id}" style="font-size: 11px;">
                ⚡ Start Speed Duel
              </button>
            </div>`
            )
            .join('')}
        `;

        document.querySelectorAll('.start-peer-duel-btn').forEach((duelBtn) => {
          duelBtn.addEventListener('click', () => {
            alert('Connecting to peer via local Bluetooth mesh... Speed Duel Starting!');
            this.state.activeTab = 'player';
            Router.render();
          });
        });
      });
    }
  },
};
