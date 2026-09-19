// js/pages/group.js — RecalIo Group Mode (Study Pods, Green Signals, Auto-Quiz Battles, Mesh Chat)

window.Pages.Group = {
  render() {
    const room = window.GroupRoom ? window.GroupRoom.activeRoom : null;

    if (!room) {
      return this.renderEntryView();
    }

    if (room.status === GroupRoom.STATUS.IN_QUIZ) {
      return this.renderQuizBattleView(room);
    }

    if (room.status === GroupRoom.STATUS.RESULTS) {
      return this.renderResultsView(room);
    }

    return this.renderLobbyView(room);
  },

  // View 1: Create or Join Room
  renderEntryView() {
    return `
      <div class="group-page">
        <div class="page-header">
          <h1>RecalIo Study Pods</h1>
          <p class="page-subtitle">Study together, stay accountable with live focus signals, and battle in end-of-chapter group quizzes.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-lg);">
          <!-- Create Room Card -->
          <div class="card" style="padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
            <div style="display: flex; items-center; gap: 8px;">
              <span style="font-size: 24px;">🚀</span>
              <div>
                <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">Create Study Pod</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">Start a room and invite your friends</p>
              </div>
            </div>

            <div class="settings-group">
              <label class="settings-label">Your Name</label>
              <input type="text" id="create-name-input" class="manual-form-input" placeholder="e.g. Rahul" value="Rahul" />
            </div>

            <div class="settings-group">
              <label class="settings-label">Select Study Material</label>
              <select id="create-pdf-select" class="manual-form-input">
                <option value="">Loading your library PDFs...</option>
              </select>
            </div>

            <div class="settings-group">
              <label class="settings-label">Target Milestone</label>
              <input type="text" id="create-milestone-input" class="manual-form-input" placeholder="e.g. Page 4 or Chapter 2" value="Page 4" />
            </div>

            <div class="settings-group">
              <label class="settings-label">Quiz Battle Questions</label>
              <select id="create-qcount-select" class="manual-form-input">
                <option value="3">3 Quick Questions</option>
                <option value="5" selected>5 Standard Questions</option>
                <option value="10">10 Deep Questions</option>
              </select>
            </div>

            <button id="btn-create-pod" class="btn btn-primary" style="margin-top: 8px; width: 100%; justify-content: center; padding: 12px;">
              Create Pod (#POD-XXX)
            </button>
          </div>

          <!-- Join Room Card -->
          <div class="card" style="padding: var(--space-xl); display: flex; flex-direction: column; gap: var(--space-md);">
            <div style="display: flex; items-center; gap: 8px;">
              <span style="font-size: 24px;">🤝</span>
              <div>
                <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);">Join Existing Pod</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">No sign-up required. Enter room code.</p>
              </div>
            </div>

            <div class="settings-group">
              <label class="settings-label">Room Code</label>
              <input type="text" id="join-code-input" class="manual-form-input" placeholder="e.g. #POD-782" style="font-family: monospace; font-size: 1.1rem; font-weight: 700;" />
            </div>

            <div class="settings-group">
              <label class="settings-label">Your Display Name</label>
              <input type="text" id="join-name-input" class="manual-form-input" placeholder="e.g. Khushi or Aisha" value="Khushi" />
            </div>

            <div style="flex: 1;"></div>

            <button id="btn-join-pod" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 12px; background: #10b981; border-color: #10b981;">
              Join Pod
            </button>

            <div style="background: var(--bg-secondary); padding: 10px; border-radius: var(--radius-sm); font-size: 12px; color: var(--text-secondary); text-align: center;">
              💡 <em>Tip for Demo: Open another tab, join with code <strong>#POD-782</strong>, and watch live green signals sync instantly!</em>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // View 2: Live Study Pod Lobby
  renderLobbyView(room) {
    const isQuizReady = room.status === GroupRoom.STATUS.QUIZ_READY;

    return `
      <div class="group-page">
        <!-- Room Banner -->
        <div class="group-header-card">
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <span class="group-code-pill" id="copy-room-code-btn" title="Click to copy room code">
                ${room.code} 📋
              </span>
              <span class="pill-title" style="background: rgba(16, 185, 129, 0.15); color: #10b981; margin: 0;">
                ● Live Pod Active
              </span>
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary);">${room.pdfName}</h2>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">
              Goal: Study until <strong>${room.targetMilestone}</strong> • ${room.questionCount} Questions Quiz
            </p>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="lobby-read-btn" class="btn btn-primary" style="padding: 10px 18px;">
              📖 Read Document
            </button>
            <button id="lobby-leave-btn" class="btn btn-secondary-sm">
              Leave Pod
            </button>
          </div>
        </div>

        <!-- Automatic Quiz Ready Banner (Feature 16) -->
        ${
          isQuizReady
            ? `
          <div class="card" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15)); border: 2px solid #10b981; padding: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <h3 style="font-size: 1.2rem; font-weight: 800; color: #065f46; display: flex; align-items: center; gap: 8px;">
                🎉 GROUP QUIZ READY!
              </h3>
              <p style="font-size: 0.9rem; color: var(--text-primary); margin-top: 4px;">
                Everyone completed <strong>${room.targetMilestone}</strong>. The AI has generated questions from your shared reading!
              </p>
            </div>
            <button id="btn-start-quiz-battle" class="btn btn-primary" style="background: #10b981; border-color: #10b981; font-size: 15px; font-weight: 800; padding: 12px 24px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
              🔥 Start Quiz Battle Now
            </button>
          </div>
        `
            : `
          <!-- Simulation trigger button for easy hackathon demo -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary); padding: 8px 14px; border-radius: 8px; font-size: 12px;">
            <span style="color: var(--text-secondary);">Waiting for all members to reach ${room.targetMilestone}...</span>
            <button id="btn-simulate-complete" class="btn btn-secondary-sm" style="font-size: 11px; font-weight: 700; color: var(--accent);">
              ⚡ Simulate All Completed Milestone
            </button>
          </div>
        `
        }

        <!-- Members Grid (Live Green Focus Signal - Feature 15) -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">
              Pod Members (${room.members.length})
            </h3>
            <span style="font-size: 11px; color: var(--text-secondary);">
              🟢 Reading &nbsp;|&nbsp; ⚪ Away &nbsp;|&nbsp; ✅ Completed
            </span>
          </div>

          <div class="group-members-grid">
            ${room.members
              .map(
                (m) => `
              <div class="pod-member-card">
                <div class="member-header">
                  <span class="member-name">${m.name} ${m.isCreator ? '<span style="font-size:10px; color:var(--accent);">(Host)</span>' : ''}</span>
                  ${
                    m.status === 'completed'
                      ? '<span class="member-beacon beacon-completed">✅ Milestone Done</span>'
                      : m.status === 'away'
                      ? '<span class="member-beacon beacon-away">⚪ Away</span>'
                      : '<span class="member-beacon beacon-reading"><span class="green-dot-pulse"></span> 🟢 Reading</span>'
                  }
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                  Current Position: <strong>Page ${m.currentPage || 1}</strong>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">
                  Battle Score: <strong style="color: var(--accent);">${m.score || 0} pts</strong>
                </div>
              </div>`
              )
              .join('')}
          </div>
        </div>

        <!-- Local Mesh Chat Drawer (Feature 17) -->
        <div class="card" style="padding: var(--space-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
              💬 Pod Doubt-Solving Chat <span style="font-size: 10px; font-weight: 600; color: #10b981; background: rgba(16,185,129,0.15); padding: 2px 6px; border-radius: 4px;">0 Cellular Data (Local Mesh)</span>
            </h3>
          </div>

          <div class="mesh-chat-box">
            <div class="mesh-chat-messages" id="mesh-chat-messages">
              ${room.chatMessages
                .map(
                  (msg) => `
                <div class="chat-bubble ${msg.sender === GroupRoom.currentUser?.name ? 'mine' : 'theirs'}">
                  <strong style="font-size: 10px; display: block; opacity: 0.8;">${msg.sender}</strong>
                  ${msg.text}
                </div>`
                )
                .join('')}
            </div>

            <div style="display: flex; gap: 8px; padding: 8px; border-top: 1px solid var(--border-color);">
              <input type="text" id="mesh-chat-input" class="manual-form-input" placeholder="Ask a doubt or discuss a concept..." style="flex: 1; font-size: 13px;" />
              <button id="mesh-chat-send-btn" class="btn btn-primary" style="padding: 6px 14px;">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // View 3: Synchronized Quiz Battle Arena (Feature 16 & 17)
  renderQuizBattleView(room) {
    const quiz = room.quiz || [];
    const qIdx = room.currentQuestionIdx || 0;
    const q = quiz[qIdx] || { question: 'Question loading...', options: [] };
    const myAnswer = room.currentUser?.answers?.[qIdx];

    // Rank members
    const sortedMembers = [...room.members].sort((a, b) => (b.score || 0) - (a.score || 0));

    return `
      <div class="group-page">
        <div class="battle-arena">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; color: var(--accent); font-size: 13px; text-transform: uppercase;">
              🔥 QUIZ BATTLE • QUESTION ${qIdx + 1} OF ${quiz.length}
            </span>
            <span id="battle-timer-display" style="font-family: monospace; font-size: 14px; font-weight: 800; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 4px 10px; border-radius: 6px;">
              ⏱️ 15s
            </span>
          </div>

          <div class="battle-progress-bar">
            <div class="battle-progress-fill" style="width: ${((qIdx + 1) / quiz.length) * 100}%;"></div>
          </div>

          <h2 style="font-size: 1.25rem; font-weight: 700; line-height: 1.4; color: var(--text-primary); margin: 8px 0;">
            ${q.question}
          </h2>

          <!-- 4 Options -->
          <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
            ${(q.options || [])
              .map(
                (opt, idx) => `
              <button class="battle-option-btn ${myAnswer && myAnswer.selectedOptionIdx === idx ? 'selected' : ''}" data-opt-idx="${idx}" ${myAnswer ? 'disabled' : ''}>
                <strong style="color: var(--accent); margin-right: 8px;">${String.fromCharCode(65 + idx)}.</strong> ${opt}
              </button>`
              )
              .join('')}
          </div>

          ${
            myAnswer
              ? `
            <div style="padding: 12px; border-radius: 8px; background: ${myAnswer.isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; border: 1px solid ${myAnswer.isCorrect ? '#10b981' : '#ef4444'}; margin-top: 8px;">
              <p style="font-weight: 700; color: ${myAnswer.isCorrect ? '#065f46' : '#991b1b'};">
                ${myAnswer.isCorrect ? `✓ Correct! +${myAnswer.points} pts (Speed Bonus Included)` : '✗ Incorrect. 0 pts'}
              </p>
              <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                ${q.explanation || ''}
              </p>
            </div>
            <button id="btn-next-battle-q" class="btn btn-primary" style="align-self: flex-end; margin-top: 8px;">
              ${qIdx < quiz.length - 1 ? 'Next Question ▶' : 'View Final Leaderboard 🏆'}
            </button>
          `
              : ''
          }
        </div>

        <!-- Live Mini Leaderboard -->
        <div class="card" style="padding: var(--space-md);">
          <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
            🏆 LIVE LEADERBOARD
          </h3>
          <div class="leaderboard-list">
            ${sortedMembers
              .map(
                (m, idx) => `
              <div class="leaderboard-item ${idx === 0 ? 'rank-1' : ''}">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-weight: 800; color: ${idx === 0 ? '#f59e0b' : 'var(--text-secondary)'};">#${idx + 1}</span>
                  <span style="color: var(--text-primary);">${m.name}</span>
                </div>
                <span style="font-family: monospace; font-weight: 800; color: var(--accent);">${m.score || 0} pts</span>
              </div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  },

  // View 4: Final Results & Remediation (Feature 11)
  renderResultsView(room) {
    const sorted = [...room.members].sort((a, b) => (b.score || 0) - (a.score || 0));
    const winner = sorted[0] || { name: 'Pod Master', score: 0 };

    return `
      <div class="group-page" style="text-align: center;">
        <div class="card" style="padding: var(--space-xl); max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-md);">
          <span style="font-size: 48px;">🏆</span>
          <h1 style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary);">GROUP QUIZ COMPLETE</h1>
          <p style="font-size: 1rem; color: var(--text-secondary);">
            Winner: <strong style="color: #f59e0b;">${winner.name}</strong> with ${winner.score} points!
          </p>

          <div class="leaderboard-list" style="text-align: left; margin: 12px 0;">
            ${sorted
              .map(
                (m, idx) => `
              <div class="leaderboard-item ${idx === 0 ? 'rank-1' : ''}">
                <span>#${idx + 1} ${m.name}</span>
                <strong style="color: var(--accent);">${m.score || 0} pts</strong>
              </div>`
              )
              .join('')}
          </div>

          <!-- Remediation to Spaced Repetition -->
          <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid var(--accent); padding: 14px; border-radius: 8px; text-align: left;">
            <strong style="color: var(--accent); display: block; font-size: 13px; margin-bottom: 4px;">🧠 Diagnostic Remediation:</strong>
            <p style="font-size: 12px; color: var(--text-secondary);">
              Questions struggled with have been identified and prepared for your Spaced Repetition queue.
            </p>
          </div>

          <div style="display: flex; gap: 10px; justify-content: center; margin-top: 12px;">
            <button id="btn-review-weak" class="btn btn-primary">
              🔁 Review Weak Concepts
            </button>
            <button id="btn-pod-done" class="btn btn-secondary-sm">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    `;
  },

  async afterRender() {
    const room = window.GroupRoom ? window.GroupRoom.activeRoom : null;

    if (!room) {
      // Populate PDF select
      const pdfSelect = document.getElementById('create-pdf-select');
      if (pdfSelect) {
        const pdfs = await DB.getAllPDFs();
        if (pdfs.length > 0) {
          pdfSelect.innerHTML = pdfs.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
        } else {
          pdfSelect.innerHTML = `<option value="sample_doc">Default Biology Chapter 4</option>`;
        }
      }

      // Check query param for room code e.g. #/group?code=POD-782
      const codeParam = Router.getQueryParam('code');
      if (codeParam && document.getElementById('join-code-input')) {
        document.getElementById('join-code-input').value = codeParam.startsWith('#') ? codeParam : `#${codeParam}`;
      }

      // Create Pod listener
      const createBtn = document.getElementById('btn-create-pod');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          const name = document.getElementById('create-name-input').value.trim() || 'Rahul';
          const pdfSelectEl = document.getElementById('create-pdf-select');
          const pdfId = pdfSelectEl ? pdfSelectEl.value : 'sample_doc';
          const pdfName = pdfSelectEl && pdfSelectEl.selectedOptions[0] ? pdfSelectEl.selectedOptions[0].text : 'Study Document.pdf';
          const milestone = document.getElementById('create-milestone-input').value.trim() || 'Page 4';
          const qCount = parseInt(document.getElementById('create-qcount-select').value, 10) || 5;

          GroupRoom.createRoom({
            creatorName: name,
            pdfId,
            pdfName,
            targetMilestone: milestone,
            questionCount: qCount,
          });

          Router.render();
        });
      }

      // Join Pod listener
      const joinBtn = document.getElementById('btn-join-pod');
      if (joinBtn) {
        joinBtn.addEventListener('click', () => {
          const code = document.getElementById('join-code-input').value.trim();
          const name = document.getElementById('join-name-input').value.trim() || 'Khushi';
          if (!code) {
            alert('Please enter a room code (e.g. #POD-782)');
            return;
          }
          GroupRoom.joinRoom(code, name);
          Router.render();
        });
      }
      return;
    }

    // Lobby Listeners
    if (room.status === GroupRoom.STATUS.STUDYING || room.status === GroupRoom.STATUS.QUIZ_READY) {
      const readBtn = document.getElementById('lobby-read-btn');
      if (readBtn) {
        readBtn.addEventListener('click', () => {
          Router.navigate(`/reader?id=${room.pdfId}&page=${room.currentUser?.currentPage || 1}`);
        });
      }

      const leaveBtn = document.getElementById('lobby-leave-btn');
      if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
          GroupRoom.leaveRoom();
          Router.render();
        });
      }

      const copyBtn = document.getElementById('copy-room-code-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard?.writeText(room.code);
          alert(`Room code ${room.code} copied to clipboard!`);
        });
      }

      // Simulate All Completed Button (For live hackathon demo)
      const simBtn = document.getElementById('btn-simulate-complete');
      if (simBtn) {
        simBtn.addEventListener('click', () => {
          room.members.forEach((m) => {
            m.status = 'completed';
            m.currentPage = room.targetPage;
          });
          GroupRoom.checkMilestoneTrigger();
          Router.render();
        });
      }

      // Start Quiz Battle Button
      const startBattleBtn = document.getElementById('btn-start-quiz-battle');
      if (startBattleBtn) {
        startBattleBtn.addEventListener('click', async () => {
          startBattleBtn.textContent = 'Generating Quiz Battle...';
          startBattleBtn.disabled = true;
          await GroupRoom.startQuizBattle();
          Router.render();
        });
      }

      // Mesh Chat send
      const chatInput = document.getElementById('mesh-chat-input');
      const chatSendBtn = document.getElementById('mesh-chat-send-btn');
      if (chatSendBtn && chatInput) {
        const sendMsg = () => {
          const text = chatInput.value.trim();
          if (text) {
            GroupRoom.sendMessage(text);
            chatInput.value = '';
            Router.render();
          }
        };
        chatSendBtn.addEventListener('click', sendMsg);
        chatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') sendMsg();
        });
      }
    }

    // Quiz Battle Listeners
    if (room.status === GroupRoom.STATUS.IN_QUIZ) {
      document.querySelectorAll('.battle-option-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const optIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
          GroupRoom.submitAnswer(room.currentQuestionIdx, optIdx, 5);
          Router.render();
        });
      });

      const nextQBtn = document.getElementById('btn-next-battle-q');
      if (nextQBtn) {
        nextQBtn.addEventListener('click', () => {
          GroupRoom.nextQuestion();
          Router.render();
        });
      }
    }

    // Results Listeners
    if (room.status === GroupRoom.STATUS.RESULTS) {
      const reviewBtn = document.getElementById('btn-review-weak');
      if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
          // Feed weak questions into Spaced Repetition
          if (room.quiz) {
            room.quiz.forEach((q) => {
              Storage.saveFlashcard({
                id: Storage.generateId(),
                question: q.question,
                answer: q.options ? q.options[q.correctIndex] : 'Review answer',
                dueDate: Date.now(), // Due immediately
                repetitions: 0,
                interval: 1,
                easeFactor: 2.0,
                needsReview: true,
              });
            });
          }
          GroupRoom.leaveRoom();
          Router.navigate('/review');
        });
      }

      const doneBtn = document.getElementById('btn-pod-done');
      if (doneBtn) {
        doneBtn.addEventListener('click', () => {
          GroupRoom.leaveRoom();
          Router.navigate('/dashboard');
        });
      }
    }

    // Bind real-time update events
    window.addEventListener('recalio:pod-update', () => {
      if (Router.getCurrentPath() === '/group') Router.render();
    });
    window.addEventListener('recalio:pod-quiz-ready', () => {
      if (Router.getCurrentPath() === '/group') Router.render();
    });
    window.addEventListener('recalio:pod-quiz-started', () => {
      if (Router.getCurrentPath() === '/group') Router.render();
    });
  },
};
