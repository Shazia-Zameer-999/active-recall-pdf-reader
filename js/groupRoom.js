// js/groupRoom.js — Collaborative Study Pods Manager for Recallo
// Manages Room Codes (#POD-782), Live Green Focus Signals, Auto-Triggered Group Quiz Battles, and Mesh Chat.

const GroupRoom = {
  activeRoom: null,
  currentUser: null,
  heartbeatTimer: null,
  inactivityTimer: null,

  STATUS: {
    STUDYING: 'studying',
    QUIZ_READY: 'quiz_ready',
    IN_QUIZ: 'in_quiz',
    RESULTS: 'results',
  },

  init() {
    // Listen for mesh events
    P2PMesh.on('ROOM_UPDATE', (payload) => this.onRemoteRoomUpdate(payload));
    P2PMesh.on('HEARTBEAT', (payload) => this.onRemoteHeartbeat(payload));
    P2PMesh.on('CHAT_MESSAGE', (payload) => this.onRemoteChatMessage(payload));
    P2PMesh.on('QUIZ_STARTED', (payload) => this.onRemoteQuizStarted(payload));
    P2PMesh.on('SUBMIT_ANSWER', (payload) => this.onRemoteAnswer(payload));
  },

  // Create a new study pod room
  createRoom({ pdfId, pdfName, targetMilestone, questionCount = 5, difficulty = 'normal', creatorName = 'Rahul' }) {
    const codeNumber = Math.floor(100 + Math.random() * 900);
    const roomCode = `#POD-${codeNumber}`;

    const memberId = 'usr_' + Math.random().toString(36).substring(2, 7);
    this.currentUser = {
      id: memberId,
      name: creatorName,
      isCreator: true,
      status: 'reading', // reading | away | completed
      currentPage: 1,
      lastActiveAt: Date.now(),
      score: 0,
      answers: {},
    };

    this.activeRoom = {
      code: roomCode,
      pdfId,
      pdfName: pdfName || 'Study Material.pdf',
      targetMilestone: targetMilestone || 'Page 4',
      targetPage: parseInt(targetMilestone?.replace(/\D/g, '') || '4', 10),
      questionCount,
      difficulty,
      status: this.STATUS.STUDYING,
      members: [this.currentUser],
      chatMessages: [
        { sender: 'System', text: `Room ${roomCode} created. Share this code with friends!`, timestamp: Date.now() },
      ],
      quiz: null,
      currentQuestionIdx: 0,
    };

    this.saveRoomLocal();
    this.broadcastRoomState();
    this.startHeartbeat();
    this.setupInactivityListener();

    return this.activeRoom;
  },

  // Join an existing study pod via Room Code
  joinRoom(roomCode, guestName = 'Aisha') {
    const formattedCode = roomCode.startsWith('#') ? roomCode.toUpperCase() : `#${roomCode.toUpperCase()}`;
    const local = this.loadRoomLocal();

    let room = local && local.code === formattedCode ? local : null;

    // If room not found in local storage, synthesize room state so demo works seamlessly
    if (!room) {
      room = {
        code: formattedCode,
        pdfId: 'demo_pdf',
        pdfName: 'Biology_Chapter_4.pdf',
        targetMilestone: 'Page 4',
        targetPage: 4,
        questionCount: 5,
        difficulty: 'normal',
        status: this.STATUS.STUDYING,
        members: [
          { id: 'usr_khushi', name: 'Khushi', isCreator: true, status: 'reading', currentPage: 3, score: 0, lastActiveAt: Date.now() },
        ],
        chatMessages: [
          { sender: 'System', text: `Welcome to ${formattedCode}!`, timestamp: Date.now() },
        ],
        quiz: null,
        currentQuestionIdx: 0,
      };
    }

    const memberId = 'usr_' + Math.random().toString(36).substring(2, 7);
    this.currentUser = {
      id: memberId,
      name: guestName,
      isCreator: false,
      status: 'reading',
      currentPage: 1,
      lastActiveAt: Date.now(),
      score: 0,
      answers: {},
    };

    // Add member if not existing
    const existingIdx = room.members.findIndex((m) => m.name.toLowerCase() === guestName.toLowerCase());
    if (existingIdx >= 0) {
      room.members[existingIdx] = this.currentUser;
    } else {
      room.members.push(this.currentUser);
    }

    this.activeRoom = room;
    this.saveRoomLocal();
    this.broadcastRoomState();
    this.startHeartbeat();
    this.setupInactivityListener();

    return this.activeRoom;
  },

  // Broadcast current room state across mesh
  broadcastRoomState() {
    if (!this.activeRoom) return;
    P2PMesh.broadcast('ROOM_UPDATE', this.activeRoom);
    window.dispatchEvent(new CustomEvent('recalio:pod-update', { detail: this.activeRoom }));
  },

  // Update current user's reading progress & presence
  updateProgress(currentPage) {
    if (!this.activeRoom || !this.currentUser) return;

    this.currentUser.currentPage = currentPage;
    this.currentUser.lastActiveAt = Date.now();

    if (currentPage >= this.activeRoom.targetPage) {
      this.currentUser.status = 'completed';
    } else {
      this.currentUser.status = 'reading';
    }

    // Update in members list
    const m = this.activeRoom.members.find((x) => x.id === this.currentUser.id);
    if (m) {
      m.currentPage = currentPage;
      m.status = this.currentUser.status;
      m.lastActiveAt = Date.now();
    }

    this.checkMilestoneTrigger();
    this.saveRoomLocal();
    this.broadcastRoomState();
  },

  // Check if ALL members have completed the agreed milestone
  checkMilestoneTrigger() {
    if (!this.activeRoom || this.activeRoom.status !== this.STATUS.STUDYING) return;

    const allFinished = this.activeRoom.members.length > 0 &&
      this.activeRoom.members.every((m) => m.status === 'completed');

    if (allFinished) {
      this.activeRoom.status = this.STATUS.QUIZ_READY;
      this.activeRoom.chatMessages.push({
        sender: 'RecalIo Bot',
        text: `🎉 Everyone reached ${this.activeRoom.targetMilestone}! Group Quiz Battle is unlocked!`,
        timestamp: Date.now(),
      });
      this.saveRoomLocal();
      this.broadcastRoomState();
      window.dispatchEvent(new CustomEvent('recalio:pod-quiz-ready', { detail: this.activeRoom }));
    }
  },

  // Launch the Group Quiz Battle
  async startQuizBattle(sampleText = '') {
    if (!this.activeRoom) return;

    this.activeRoom.status = this.STATUS.IN_QUIZ;
    this.activeRoom.currentQuestionIdx = 0;

    // Generate questions if not generated yet
    if (!this.activeRoom.quiz || this.activeRoom.quiz.length === 0) {
      this.activeRoom.quiz = await this.generateGroupQuiz(sampleText, this.activeRoom.questionCount);
    }

    this.saveRoomLocal();
    P2PMesh.broadcast('QUIZ_STARTED', { roomCode: this.activeRoom.code, quiz: this.activeRoom.quiz });
    this.broadcastRoomState();
    window.dispatchEvent(new CustomEvent('recalio:pod-quiz-started', { detail: this.activeRoom }));
  },

  // Submit answer for the current question
  submitAnswer(questionIdx, selectedOptionIdx, responseTimeSec = 5) {
    if (!this.activeRoom || !this.currentUser) return;

    const q = this.activeRoom.quiz[questionIdx];
    const isCorrect = q && selectedOptionIdx === q.correctIndex;
    
    // Score calculation: 100 base points + up to 50 speed bonus
    const speedBonus = Math.max(0, Math.round((15 - responseTimeSec) * 3.3));
    const points = isCorrect ? (100 + speedBonus) : 0;

    this.currentUser.score = (this.currentUser.score || 0) + points;
    this.currentUser.answers[questionIdx] = { selectedOptionIdx, isCorrect, points };

    const member = this.activeRoom.members.find((m) => m.id === this.currentUser.id);
    if (member) {
      member.score = this.currentUser.score;
      member.answers = this.currentUser.answers;
    }

    P2PMesh.broadcast('SUBMIT_ANSWER', {
      memberId: this.currentUser.id,
      questionIdx,
      points,
      totalScore: this.currentUser.score,
    });

    this.saveRoomLocal();
    this.broadcastRoomState();
    return { isCorrect, points, totalScore: this.currentUser.score };
  },

  // Advance to next quiz question or finish
  nextQuestion() {
    if (!this.activeRoom) return;
    if (this.activeRoom.currentQuestionIdx < this.activeRoom.quiz.length - 1) {
      this.activeRoom.currentQuestionIdx++;
    } else {
      this.activeRoom.status = this.STATUS.RESULTS;
      // Award winner XP
      const sorted = [...this.activeRoom.members].sort((a, b) => (b.score || 0) - (a.score || 0));
      if (sorted[0] && sorted[0].id === this.currentUser.id && window.Gamification) {
        window.Gamification.unlockBadge('pod_champ');
        window.Gamification.addXP(150, 'Won Group Quiz Battle!');
      }
    }
    this.saveRoomLocal();
    this.broadcastRoomState();
  },

  // Send a chat message over the local mesh
  sendMessage(text) {
    if (!this.activeRoom || !this.currentUser || !text.trim()) return;

    const msg = {
      sender: this.currentUser.name,
      senderId: this.currentUser.id,
      text: text.trim(),
      timestamp: Date.now(),
    };

    this.activeRoom.chatMessages.push(msg);
    P2PMesh.broadcast('CHAT_MESSAGE', { roomCode: this.activeRoom.code, message: msg });
    this.saveRoomLocal();
    window.dispatchEvent(new CustomEvent('recalio:pod-chat', { detail: msg }));
    return msg;
  },

  // Generate grounded quiz from studied text
  async generateGroupQuiz(studiedText, count = 5) {
    const textToUse = studiedText && studiedText.length > 50
      ? studiedText
      : "Gregor Mendel conducted hybridization experiments on garden peas for seven years (1856-1863) and proposed the laws of inheritance. Factors now known as genes occur in pairs called alleles. Phenotype is the observable trait whereas genotype is the genetic makeup. Dominant traits express in heterozygous conditions.";

    const prompt = `Based on this studied textbook milestone text:
"""${textToUse.slice(0, 3000)}"""

Generate ${count} multiple choice questions for a competitive study group battle.
Return ONLY a valid JSON array in this exact format:
[
  {
    "question": "What is ...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Brief 1-sentence reason why Option A is correct."
  }
]`;

    try {
      const questions = await Gemini.generateJSON(prompt);
      if (Array.isArray(questions) && questions.length > 0) {
        return questions;
      }
    } catch (err) {
      console.warn('Group quiz generation fallback:', err);
    }

    // Robust Fallback Questions
    return [
      {
        question: "What was the primary organism used in the studied experiments?",
        options: ["Garden Peas (Pisum sativum)", "Fruit Flies (Drosophila)", "E. Coli Bacteria", "Snapdragon"],
        correctIndex: 0,
        explanation: "Mendel chose garden peas due to easily observable contrasting traits.",
      },
      {
        question: "What term describes the observable physical manifestation of a trait?",
        options: ["Phenotype", "Genotype", "Heterozygote", "Allele"],
        correctIndex: 0,
        explanation: "Phenotype refers to the physical observable characteristics.",
      },
      {
        question: "During which time period were these foundational experiments conducted?",
        options: ["1856 – 1863", "1900 – 1910", "1805 – 1812", "1923 – 1930"],
        correctIndex: 0,
        explanation: "The experiments took place over seven years between 1856 and 1863.",
      },
    ];
  },

  // Heartbeat & Inactivity listeners
  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.activeRoom && this.currentUser) {
        P2PMesh.broadcast('HEARTBEAT', {
          roomCode: this.activeRoom.code,
          memberId: this.currentUser.id,
          status: this.currentUser.status,
          currentPage: this.currentUser.currentPage,
          score: this.currentUser.score,
        });
      }
    }, 4000);
  },

  setupInactivityListener() {
    const markActive = () => {
      if (this.currentUser && this.currentUser.status === 'away') {
        this.currentUser.status = 'reading';
        this.broadcastRoomState();
      }
      if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      // After 45 seconds of zero interaction, set to Away
      this.inactivityTimer = setTimeout(() => {
        if (this.currentUser && this.currentUser.status === 'reading') {
          this.currentUser.status = 'away';
          this.broadcastRoomState();
        }
      }, 45000);
    };

    window.addEventListener('mousemove', markActive, { passive: true });
    window.addEventListener('scroll', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    markActive();
  },

  // Remote Event Handlers
  onRemoteRoomUpdate(room) {
    if (!this.activeRoom || this.activeRoom.code !== room.code) return;
    this.activeRoom = room;
    this.saveRoomLocal();
    window.dispatchEvent(new CustomEvent('recalio:pod-update', { detail: this.activeRoom }));
  },

  onRemoteHeartbeat(hb) {
    if (!this.activeRoom || this.activeRoom.code !== hb.roomCode) return;
    const member = this.activeRoom.members.find((m) => m.id === hb.memberId);
    if (member) {
      member.status = hb.status;
      member.currentPage = hb.currentPage;
      member.score = hb.score;
      member.lastActiveAt = Date.now();
      window.dispatchEvent(new CustomEvent('recalio:pod-update', { detail: this.activeRoom }));
    }
  },

  onRemoteChatMessage(payload) {
    if (!this.activeRoom || this.activeRoom.code !== payload.roomCode) return;
    this.activeRoom.chatMessages.push(payload.message);
    this.saveRoomLocal();
    window.dispatchEvent(new CustomEvent('recalio:pod-chat', { detail: payload.message }));
  },

  onRemoteQuizStarted(payload) {
    if (!this.activeRoom || this.activeRoom.code !== payload.roomCode) return;
    this.activeRoom.status = this.STATUS.IN_QUIZ;
    this.activeRoom.quiz = payload.quiz;
    this.activeRoom.currentQuestionIdx = 0;
    this.saveRoomLocal();
    window.dispatchEvent(new CustomEvent('recalio:pod-quiz-started', { detail: this.activeRoom }));
  },

  onRemoteAnswer(payload) {
    if (!this.activeRoom) return;
    const member = this.activeRoom.members.find((m) => m.id === payload.memberId);
    if (member) {
      member.score = payload.totalScore;
      window.dispatchEvent(new CustomEvent('recalio:pod-update', { detail: this.activeRoom }));
    }
  },

  saveRoomLocal() {
    if (!this.activeRoom) return;
    try {
      localStorage.setItem('recalio_active_pod', JSON.stringify(this.activeRoom));
    } catch {}
  },

  loadRoomLocal() {
    try {
      const raw = localStorage.getItem('recalio_active_pod');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  leaveRoom() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.activeRoom = null;
    this.currentUser = null;
    try {
      localStorage.removeItem('recalio_active_pod');
    } catch {}
    window.dispatchEvent(new CustomEvent('recalio:pod-left'));
  },
};

// Initialize
GroupRoom.init();
window.GroupRoom = GroupRoom;
