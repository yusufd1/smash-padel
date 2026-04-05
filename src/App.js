import React, { useState, useEffect } from 'react';
import './App.css';

const BACKEND = process.env.REACT_APP_BACKEND || 'http://localhost:3001';

const AVATAR_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7',
  '#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9'
];

function generateAmericanoMatches(players, courts, rounds) {
  const matches = [];
  const maxCourts = Math.min(courts, Math.floor(players.length / 4));
  if (maxCourts === 0) return matches;
  for (let round = 1; round <= rounds; round++) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    for (let court = 0; court < maxCourts; court++) {
      const base = court * 4;
      matches.push({
        round,
        court: court + 1,
        team1: [shuffled[base]._id, shuffled[base + 1]._id],
        team2: [shuffled[base + 2]._id, shuffled[base + 3]._id],
        score1: 0,
        score2: 0,
        completed: false
      });
    }
  }
  return matches;
}

function calcSessionLeaderboard(session, players) {
  const pts = {};
  players.forEach(p => { pts[p._id] = 0; });
  session.matches.forEach(m => {
    if (m.completed) {
      m.team1.forEach(id => { pts[id] = (pts[id] || 0) + m.score1; });
      m.team2.forEach(id => { pts[id] = (pts[id] || 0) + m.score2; });
    }
  });
  return players
    .map(p => ({ ...p, sessionPts: pts[p._id] || 0 }))
    .sort((a, b) => b.sessionPts - a.sessionPts);
}

function App() {
  const [tab, setTab] = useState('home');
  const [playerId, setPlayerId] = useState(localStorage.getItem('smash-playerId'));
  const [player, setPlayer] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);

  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [courts, setCourts] = useState(2);
  const [rounds, setRounds] = useState(7);
  const [pointsPerGame, setPointsPerGame] = useState(24);
  const [useCustomPoints, setUseCustomPoints] = useState(false);
  const [customPointsValue, setCustomPointsValue] = useState('');

  const [customPlayers, setCustomPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');

  const [activeSession, setActiveSession] = useState(null);
  const [matchInputs, setMatchInputs] = useState({});
  const [showWinner, setShowWinner] = useState(false);
  const [sessionWinner, setSessionWinner] = useState(null);
  const [showStandings, setShowStandings] = useState(true);

  // Combined pool: backend players + local guests
  const allAvailablePlayers = [...allPlayers, ...customPlayers];

  useEffect(() => {
    if (playerId) {
      loadPlayer();
      loadAllPlayers();
    }
  }, [playerId]);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.register('/service-worker.js').then(async (reg) => {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const res = await fetch(`${BACKEND}/api/vapid-public-key`);
        const { key } = await res.json();
        const appServerKey = urlBase64ToUint8Array(key);
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });
      }
      await fetch(`${BACKEND}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub })
      });
    }).catch(err => console.error('SW registration failed:', err));
  }, []);

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  const loadPlayer = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/players/${playerId}`);
      const data = await res.json();
      setPlayer(data);
    } catch (err) {
      console.error('Error loading player:', err);
    }
  };

  const loadAllPlayers = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/players`);
      const data = await res.json();
      setAllPlayers(data);
      return data;
    } catch (err) {
      console.error('Error loading players:', err);
      return [];
    }
  };

  const handleRegister = async () => {
    if (!name || !inviteCode) {
      alert('Please enter name and invite code');
      return;
    }
    try {
      const res = await fetch(`${BACKEND}/api/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, inviteCode })
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Registration failed');
        return;
      }
      const data = await res.json();
      localStorage.setItem('smash-playerId', data.player._id);
      setPlayerId(data.player._id);
      setPlayer(data.player);
      alert('🎾 Welcome to Smash!');
    } catch (err) {
      alert('Registration error: ' + err.message);
    }
  };

  const addCustomPlayer = () => {
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    const p = {
      _id: 'local-' + Date.now() + '-' + Math.floor(Math.random() * 9999),
      name: trimmed,
      isLocal: true,
      avatar: {
        initial: trimmed[0].toUpperCase(),
        color: AVATAR_COLORS[customPlayers.length % AVATAR_COLORS.length]
      }
    };
    setCustomPlayers(prev => [...prev, p]);
    setNewPlayerName('');
  };

  const removeCustomPlayer = (id) => {
    setCustomPlayers(prev => prev.filter(p => p._id !== id));
    setSelectedPlayers(prev => prev.filter(pid => pid !== id));
  };

  const togglePlayerSelect = (id) => {
    if (selectedPlayers.includes(id)) {
      setSelectedPlayers(selectedPlayers.filter(p => p !== id));
    } else {
      setSelectedPlayers([...selectedPlayers, id]);
    }
  };

  const createSession = () => {
    if (selectedPlayers.length < 4) {
      alert('Need at least 4 players');
      return;
    }
    const pts = useCustomPoints ? (parseInt(customPointsValue) || 24) : pointsPerGame;
    const sessionPlayers = allAvailablePlayers.filter(p => selectedPlayers.includes(p._id));
    const matches = generateAmericanoMatches(sessionPlayers, courts, rounds);
    const session = {
      _id: 'local-' + Date.now(),
      name: sessionName || 'Americano Session',
      players: sessionPlayers.map(p => p._id),
      pointsPerGame: pts,
      matches,
      sessionPlayerObjects: sessionPlayers
    };
    setActiveSession(session);
    setMatchInputs({});
    setTab('play');
  };

  const updateScore = (matchIndex, score1, score2) => {
    setActiveSession(prev => {
      const matches = prev.matches.map((m, i) =>
        i === matchIndex ? { ...m, score1, score2, completed: true } : m
      );
      const updated = { ...prev, matches };
      if (matches.every(m => m.completed)) {
        setTimeout(() => {
          const lb = calcSessionLeaderboard(updated, updated.sessionPlayerObjects);
          setSessionWinner(lb[0] || null);
          setShowWinner(true);
        }, 800);
      }
      return updated;
    });
  };

  const handleScoreChange = (idx, field, value) => {
    const pts = activeSession?.pointsPerGame || 24;
    const v = Math.max(0, parseInt(value) || 0);
    const auto = Math.max(0, pts - v);
    setMatchInputs(prev => ({
      ...prev,
      [idx]: field === 'score1'
        ? { score1: v, score2: auto }
        : { score1: auto, score2: v }
    }));
  };

  const commitScore = (idx) => {
    const inputs = matchInputs[idx];
    if (!inputs) return;
    updateScore(idx, inputs.score1, inputs.score2);
  };

  const getScore = (idx, field) => {
    if (matchInputs[idx] !== undefined) return matchInputs[idx][field];
    const match = activeSession?.matches[idx];
    return match ? match[field] : 0;
  };

  const sessionStandings = activeSession
    ? calcSessionLeaderboard(activeSession, activeSession.sessionPlayerObjects || [])
    : [];

  const playerName = (id) => {
    return allAvailablePlayers.find(p => p._id === id)?.name || 'Player';
  };

  if (!playerId) {
    return (
      <div className="app">
        <div className="register-screen">
          <div style={{fontSize:'60px',marginBottom:'24px'}}>🎾</div>
          <div style={{fontSize:'36px',fontWeight:'700',color:'var(--accent)',marginBottom:'8px'}}>SMASH</div>
          <div style={{fontSize:'14px',color:'var(--muted)',marginBottom:'48px'}}>Padel Tournament Tracker</div>
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{width:'100%',maxWidth:'320px',padding:'16px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'16px',marginBottom:'16px'}}
          />
          <input
            type="text"
            placeholder="Invite Code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            style={{width:'100%',maxWidth:'320px',padding:'16px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'16px',marginBottom:'24px'}}
          />
          <button
            onClick={handleRegister}
            style={{width:'100%',maxWidth:'320px',padding:'16px',background:'var(--accent)',border:'none',borderRadius:'12px',color:'#000',fontSize:'16px',fontWeight:'700',cursor:'pointer'}}
          >
            Join Smash
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div style={{fontSize:'24px',fontWeight:'700',color:'var(--accent)'}}>🎾 SMASH</div>
      </div>

      <div className="content">

        {/* ── HOME ── */}
        {tab === 'home' && player && (
          <div className="section">
            <div style={{fontSize:'14px',color:'var(--muted)',marginBottom:'8px'}}>WELCOME BACK</div>
            <div style={{fontSize:'28px',fontWeight:'700',color:'var(--text)',marginBottom:'32px'}}>
              {player.name} 🎾
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2, 1fr)',gap:'12px',marginBottom:'32px'}}>
              <div style={{padding:'20px',background:'var(--s2)',borderRadius:'12px',border:'1px solid var(--border)'}}>
                <div style={{fontSize:'32px',fontWeight:'700',color:'var(--text)'}}>{player.stats.played}</div>
                <div style={{fontSize:'12px',color:'var(--muted)',marginTop:'4px'}}>PLAYED</div>
              </div>
              <div style={{padding:'20px',background:'var(--s2)',borderRadius:'12px',border:'1px solid var(--border)'}}>
                <div style={{fontSize:'32px',fontWeight:'700',color:'var(--accent)'}}>{player.stats.wins}</div>
                <div style={{fontSize:'12px',color:'var(--muted)',marginTop:'4px'}}>WINS</div>
              </div>
              <div style={{padding:'20px',background:'var(--s2)',borderRadius:'12px',border:'1px solid var(--border)'}}>
                <div style={{fontSize:'32px',fontWeight:'700',color:'var(--gold)'}}>#{allPlayers.findIndex(p => p._id === playerId) + 1}</div>
                <div style={{fontSize:'12px',color:'var(--muted)',marginTop:'4px'}}>RANK</div>
              </div>
              <div style={{padding:'20px',background:'var(--s2)',borderRadius:'12px',border:'1px solid var(--border)'}}>
                <div style={{fontSize:'32px',fontWeight:'700',color:'var(--text)'}}>{player.stats.winRate}%</div>
                <div style={{fontSize:'12px',color:'var(--muted)',marginTop:'4px'}}>WIN RATE</div>
              </div>
            </div>
            <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',letterSpacing:'0.5px',marginBottom:'12px'}}>QUICK ACTIONS</div>
            <button
              onClick={() => setTab('play')}
              style={{width:'100%',padding:'20px',background:'linear-gradient(135deg, var(--accent) 0%, #00a087 100%)',border:'none',borderRadius:'12px',color:'#000',fontSize:'16px',fontWeight:'700',cursor:'pointer',marginBottom:'12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}
            >
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <span style={{fontSize:'24px'}}>⚡</span>
                <div style={{textAlign:'left'}}>
                  <div>New Session</div>
                  <div style={{fontSize:'12px',opacity:0.8}}>Start Americano</div>
                </div>
              </div>
              <span>→</span>
            </button>
            <button
              onClick={() => setTab('leaderboard')}
              style={{width:'100%',padding:'20px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'16px',fontWeight:'600',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}
            >
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <span style={{fontSize:'24px'}}>🏆</span>
                <div>Leaderboard</div>
              </div>
              <span>→</span>
            </button>
          </div>
        )}

        {/* ── PLAY ── */}
        {tab === 'play' && (
          <div className="section">
            {!activeSession ? (
              <>
                <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'8px'}}>New Americano ⚡</div>
                <div style={{fontSize:'14px',color:'var(--muted)',marginBottom:'24px'}}>Select players and settings</div>

                <input
                  type="text"
                  placeholder="Session Name (e.g. Tuesday Morning Ladies)"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  style={{width:'100%',padding:'16px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'15px',marginBottom:'16px'}}
                />

                {/* Points Per Game */}
                <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',marginBottom:'12px'}}>POINTS PER GAME</div>
                <div style={{display:'flex',gap:'8px',marginBottom: useCustomPoints ? '12px' : '24px',flexWrap:'wrap'}}>
                  {[16, 24, 32, 40].map(pts => (
                    <button
                      key={pts}
                      onClick={() => { setPointsPerGame(pts); setUseCustomPoints(false); }}
                      style={{flex:1,minWidth:'52px',padding:'12px',background: (!useCustomPoints && pointsPerGame === pts) ? 'var(--accent)' : 'var(--s2)',border: (!useCustomPoints && pointsPerGame === pts) ? 'none' : '1px solid var(--border)',borderRadius:'8px',color: (!useCustomPoints && pointsPerGame === pts) ? '#000' : 'var(--text)',fontSize:'16px',fontWeight:'700',cursor:'pointer'}}
                    >
                      {pts}
                    </button>
                  ))}
                  <button
                    onClick={() => setUseCustomPoints(true)}
                    style={{flex:1,minWidth:'64px',padding:'12px',background: useCustomPoints ? 'var(--accent)' : 'var(--s2)',border: useCustomPoints ? 'none' : '1px solid var(--border)',borderRadius:'8px',color: useCustomPoints ? '#000' : 'var(--text)',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}
                  >
                    Custom
                  </button>
                </div>
                {useCustomPoints && (
                  <input
                    type="number"
                    placeholder="Enter points (e.g. 21)"
                    value={customPointsValue}
                    onChange={(e) => setCustomPointsValue(e.target.value)}
                    style={{width:'100%',padding:'14px',background:'var(--s2)',border:'2px solid var(--accent)',borderRadius:'12px',color:'var(--text)',fontSize:'16px',marginBottom:'24px',textAlign:'center'}}
                  />
                )}

                {/* Courts */}
                <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',marginBottom:'12px'}}>COURTS</div>
                <div style={{display:'flex',gap:'8px',marginBottom:'24px'}}>
                  {[1,2,3,4].map(ct => (
                    <button
                      key={ct}
                      onClick={() => setCourts(ct)}
                      style={{flex:1,padding:'12px',background: courts === ct ? 'var(--accent)' : 'var(--s2)',border: courts === ct ? 'none' : '1px solid var(--border)',borderRadius:'8px',color: courts === ct ? '#000' : 'var(--text)',fontSize:'16px',fontWeight:'700',cursor:'pointer'}}
                    >
                      {ct}
                    </button>
                  ))}
                </div>

                {/* Rounds */}
                <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',marginBottom:'12px'}}>ROUNDS</div>
                <div style={{display:'flex',gap:'8px',marginBottom:'24px',flexWrap:'wrap'}}>
                  {[7,8,9,10,11,12].map(rd => (
                    <button
                      key={rd}
                      onClick={() => setRounds(rd)}
                      style={{flex:1,minWidth:'44px',padding:'12px',background: rounds === rd ? 'var(--accent)' : 'var(--s2)',border: rounds === rd ? 'none' : '1px solid var(--border)',borderRadius:'8px',color: rounds === rd ? '#000' : 'var(--text)',fontSize:'16px',fontWeight:'700',cursor:'pointer'}}
                    >
                      {rd}
                    </button>
                  ))}
                </div>

                {/* Add Guest Players */}
                <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',letterSpacing:'0.5px',marginBottom:'12px'}}>ADD GUEST PLAYERS</div>
                <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
                  <input
                    type="text"
                    placeholder="Guest player name"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomPlayer()}
                    style={{flex:1,padding:'12px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'10px',color:'var(--text)',fontSize:'14px'}}
                  />
                  <button
                    onClick={addCustomPlayer}
                    style={{padding:'12px 20px',background:'var(--accent)',border:'none',borderRadius:'10px',color:'#000',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}
                  >
                    Add
                  </button>
                </div>

                {/* Player Selection */}
                <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',letterSpacing:'0.5px',marginBottom:'12px'}}>
                  PLAYERS • {selectedPlayers.length} SELECTED
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2, 1fr)',gap:'12px',marginBottom:'24px'}}>
                  {allAvailablePlayers.map(p => (
                    <div
                      key={p._id}
                      style={{
                        padding:'14px',
                        background: selectedPlayers.includes(p._id) ? 'var(--accent)' : 'var(--s2)',
                        border: selectedPlayers.includes(p._id) ? 'none' : p.isLocal ? '1px dashed var(--muted)' : '1px solid var(--border)',
                        borderRadius:'12px',
                        cursor:'pointer',
                        display:'flex',
                        alignItems:'center',
                        gap:'10px',
                        position:'relative'
                      }}
                    >
                      <div
                        onClick={() => togglePlayerSelect(p._id)}
                        style={{display:'flex',alignItems:'center',gap:'10px',flex:1}}
                      >
                        <div style={{width:'38px',height:'38px',borderRadius:'50%',background:p.avatar.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:'700',color:'#000',flexShrink:0}}>
                          {p.avatar.initial}
                        </div>
                        <div>
                          <div style={{fontSize:'13px',fontWeight:'600',color: selectedPlayers.includes(p._id) ? '#000' : 'var(--text)',lineHeight:'1.2'}}>
                            {p.name}
                          </div>
                          {p.isLocal && (
                            <div style={{fontSize:'10px',fontWeight:'700',color: selectedPlayers.includes(p._id) ? 'rgba(0,0,0,0.6)' : 'var(--muted)',letterSpacing:'0.5px'}}>
                              GUEST
                            </div>
                          )}
                        </div>
                      </div>
                      {p.isLocal && !selectedPlayers.includes(p._id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeCustomPlayer(p._id); }}
                          style={{background:'transparent',border:'none',color:'var(--muted)',fontSize:'16px',cursor:'pointer',padding:'2px',lineHeight:1}}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={createSession}
                  disabled={selectedPlayers.length < 4}
                  style={{width:'100%',padding:'18px',background: selectedPlayers.length >= 4 ? 'var(--accent)' : 'var(--s2)',border:'none',borderRadius:'12px',color: selectedPlayers.length >= 4 ? '#000' : 'var(--muted)',fontSize:'16px',fontWeight:'700',cursor: selectedPlayers.length >= 4 ? 'pointer' : 'not-allowed'}}
                >
                  Start Session ({selectedPlayers.length} players)
                </button>
              </>
            ) : (
              <>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                  <div style={{fontSize:'22px',fontWeight:'700',color:'var(--text)'}}>Live Session ⚡</div>
                  <div style={{fontSize:'12px',color:'var(--muted)',fontWeight:'600'}}>{activeSession.name}</div>
                </div>
                <div style={{fontSize:'13px',color:'var(--muted)',marginBottom:'20px'}}>
                  {activeSession.pointsPerGame} pts/game • {rounds} rounds • {courts} court{courts > 1 ? 's' : ''}
                </div>

                {/* Match cards */}
                {activeSession.matches.map((match, idx) => (
                  <div
                    key={idx}
                    style={{padding:'16px',background: match.completed ? 'var(--s2)' : 'linear-gradient(135deg, var(--s2) 0%, rgba(0,201,167,0.1) 100%)',border: match.completed ? '1px solid var(--border)' : '2px solid var(--accent)',borderRadius:'12px',marginBottom:'12px',opacity: match.completed ? 0.75 : 1}}
                  >
                    <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'10px',fontWeight:'600',letterSpacing:'0.5px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span>ROUND {match.round} • COURT {match.court}</span>
                      {match.completed && <span style={{color:'var(--accent)'}}>✓ DONE</span>}
                    </div>

                    {/* Team 1 */}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'13px',fontWeight:'600',color:'var(--text)'}}>
                          {playerName(match.team1[0])} + {playerName(match.team1[1])}
                        </div>
                      </div>
                      {!match.completed ? (
                        <input
                          type="number"
                          min="0"
                          value={getScore(idx, 'score1')}
                          onChange={(e) => handleScoreChange(idx, 'score1', e.target.value)}
                          onBlur={() => commitScore(idx)}
                          style={{width:'60px',padding:'8px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'16px',textAlign:'center'}}
                        />
                      ) : (
                        <div style={{fontSize:'24px',fontWeight:'700',color:'var(--accent)'}}>{match.score1}</div>
                      )}
                    </div>

                    <div style={{height:'1px',background:'var(--border)',margin:'8px 0'}}></div>

                    {/* Team 2 */}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'13px',fontWeight:'600',color:'var(--text)'}}>
                          {playerName(match.team2[0])} + {playerName(match.team2[1])}
                        </div>
                      </div>
                      {!match.completed ? (
                        <input
                          type="number"
                          min="0"
                          value={getScore(idx, 'score2')}
                          onChange={(e) => handleScoreChange(idx, 'score2', e.target.value)}
                          onBlur={() => commitScore(idx)}
                          style={{width:'60px',padding:'8px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'8px',color:'var(--text)',fontSize:'16px',textAlign:'center'}}
                        />
                      ) : (
                        <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)'}}>{match.score2}</div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Session Standings */}
                <div style={{marginTop:'28px',marginBottom:'12px'}}>
                  <button
                    onClick={() => setShowStandings(s => !s)}
                    style={{width:'100%',padding:'14px 16px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'13px',fontWeight:'700',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',letterSpacing:'0.5px'}}
                  >
                    <span>🏆 SESSION STANDINGS</span>
                    <span style={{color:'var(--muted)'}}>{showStandings ? '▲' : '▼'}</span>
                  </button>

                  {showStandings && (
                    <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderTop:'none',borderRadius:'0 0 12px 12px',padding:'8px 0',overflow:'hidden'}}>
                      {sessionStandings.map((p, i) => (
                        <div
                          key={p._id}
                          style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 16px',background: i === 0 ? 'rgba(255,179,0,0.08)' : 'transparent',borderBottom: i < sessionStandings.length - 1 ? '1px solid var(--border)' : 'none'}}
                        >
                          <div style={{fontSize:'14px',fontWeight:'700',color: i === 0 ? 'var(--gold)' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--muted)',width:'24px',textAlign:'center'}}>
                            {i === 0 ? '👑' : `#${i + 1}`}
                          </div>
                          <div style={{width:'32px',height:'32px',borderRadius:'50%',background:p.avatar.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'700',color:'#000',flexShrink:0}}>
                            {p.avatar.initial}
                          </div>
                          <div style={{flex:1,fontSize:'14px',fontWeight: i === 0 ? '700' : '500',color: i === 0 ? 'var(--gold)' : 'var(--text)'}}>
                            {p.name}
                            {p.isLocal && <span style={{fontSize:'10px',color:'var(--muted)',marginLeft:'6px',fontWeight:'400'}}>GUEST</span>}
                          </div>
                          <div style={{fontSize:'18px',fontWeight:'700',color: i === 0 ? 'var(--gold)' : 'var(--accent)'}}>
                            {p.sessionPts}
                          </div>
                          <div style={{fontSize:'11px',color:'var(--muted)'}}>pts</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setActiveSession(null);
                    setSelectedPlayers([]);
                    setMatchInputs({});
                    setCustomPlayers([]);
                  }}
                  style={{width:'100%',padding:'16px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)',fontSize:'14px',fontWeight:'600',cursor:'pointer',marginTop:'8px'}}
                >
                  End Session
                </button>
              </>
            )}
          </div>
        )}

        {/* ── GLOBAL LEADERBOARD ── */}
        {tab === 'leaderboard' && (
          <div className="section">
            <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'24px'}}>🏆 Leaderboard</div>

            {allPlayers.length >= 3 && (
              <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:'8px',marginBottom:'32px'}}>
                <div style={{textAlign:'center',flex:1}}>
                  <div style={{width:'80px',height:'80px',margin:'0 auto 8px',borderRadius:'50%',background: allPlayers[1]?.avatar.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:'700',color:'#000',border:'3px solid #C0C0C0'}}>
                    {allPlayers[1]?.avatar.initial}
                  </div>
                  <div style={{fontSize:'14px',fontWeight:'600',color:'var(--text)',marginBottom:'4px'}}>{allPlayers[1]?.name}</div>
                  <div style={{fontSize:'24px',fontWeight:'700',color:'var(--accent)'}}>{allPlayers[1]?.stats.totalPoints}</div>
                  <div style={{fontSize:'12px',color:'var(--muted)'}}>2nd</div>
                </div>
                <div style={{textAlign:'center',flex:1}}>
                  <div style={{fontSize:'32px',marginBottom:'8px'}}>👑</div>
                  <div style={{width:'100px',height:'100px',margin:'0 auto 8px',borderRadius:'50%',background: allPlayers[0]?.avatar.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'40px',fontWeight:'700',color:'#000',border:'4px solid var(--gold)'}}>
                    {allPlayers[0]?.avatar.initial}
                  </div>
                  <div style={{fontSize:'16px',fontWeight:'700',color:'var(--text)',marginBottom:'4px'}}>{allPlayers[0]?.name}</div>
                  <div style={{fontSize:'28px',fontWeight:'700',color:'var(--gold)'}}>{allPlayers[0]?.stats.totalPoints}</div>
                  <div style={{fontSize:'12px',color:'var(--gold)'}}>1st</div>
                </div>
                <div style={{textAlign:'center',flex:1}}>
                  <div style={{width:'80px',height:'80px',margin:'0 auto 8px',borderRadius:'50%',background: allPlayers[2]?.avatar.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'32px',fontWeight:'700',color:'#000',border:'3px solid #CD7F32'}}>
                    {allPlayers[2]?.avatar.initial}
                  </div>
                  <div style={{fontSize:'14px',fontWeight:'600',color:'var(--text)',marginBottom:'4px'}}>{allPlayers[2]?.name}</div>
                  <div style={{fontSize:'24px',fontWeight:'700',color:'var(--accent)'}}>{allPlayers[2]?.stats.totalPoints}</div>
                  <div style={{fontSize:'12px',color:'var(--muted)'}}>3rd</div>
                </div>
              </div>
            )}

            <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',letterSpacing:'0.5px',marginBottom:'12px'}}>ALL RANKINGS</div>
            {allPlayers.map((p, idx) => (
              <div
                key={p._id}
                style={{padding:'16px',background: p._id === playerId ? 'rgba(0,201,167,0.1)' : 'var(--s2)',border: p._id === playerId ? '2px solid var(--accent)' : '1px solid var(--border)',borderRadius:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'12px'}}
              >
                <div style={{fontSize:'18px',fontWeight:'700',color:'var(--muted)',width:'30px'}}>{idx + 1}</div>
                <div style={{width:'48px',height:'48px',borderRadius:'50%',background:p.avatar.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',fontWeight:'700',color:'#000'}}>
                  {p.avatar.initial}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'15px',fontWeight:'600',color:'var(--text)',marginBottom:'4px'}}>
                    {p.name} {p._id === playerId && '⭐'}
                  </div>
                  <div style={{fontSize:'12px',color:'var(--muted)'}}>{p.stats.wins}W • {p.stats.losses}L</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'20px',fontWeight:'700',color:'var(--accent)'}}>{p.stats.totalPoints}</div>
                  <div style={{fontSize:'11px',color:'var(--muted)'}}>{p.stats.winRate}% WR</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab === 'profile' && player && (
          <div className="section">
            <div style={{textAlign:'center',marginBottom:'32px'}}>
              <div style={{width:'120px',height:'120px',margin:'0 auto 16px',borderRadius:'50%',background:player.avatar.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'48px',fontWeight:'700',color:'#000'}}>
                {player.avatar.initial}
              </div>
              <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'8px'}}>{player.name}</div>
              <div style={{fontSize:'14px',color:'var(--muted)'}}>Member since {new Date(player.createdAt).toLocaleDateString()}</div>
            </div>
            <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',letterSpacing:'0.5px',marginBottom:'12px'}}>STATISTICS</div>
            <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
              {[['Games Played', player.stats.played, 'var(--accent)'],['Wins', player.stats.wins, 'var(--accent)'],['Losses', player.stats.losses, 'var(--text)'],['Win Rate', player.stats.winRate + '%', 'var(--gold)'],['Total Points', player.stats.totalPoints, 'var(--accent)']].map(([label, val, color]) => (
                <div key={label} style={{display:'flex',justifyContent:'space-between',marginBottom:'16px'}}>
                  <span style={{color:'var(--text)'}}>{label}</span>
                  <span style={{fontWeight:'700',color}}>{val}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('smash-playerId');
                setPlayerId(null);
                setPlayer(null);
              }}
              style={{width:'100%',padding:'16px',background:'transparent',border:'1px solid var(--danger)',borderRadius:'12px',color:'var(--danger)',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}
            >
              Sign Out
            </button>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div className="section">
            <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'24px'}}>⚙️ Settings</div>
            <div style={{padding:'16px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',marginBottom:'16px'}}>
              <div style={{fontSize:'14px',fontWeight:'600',color:'var(--text)',marginBottom:'8px'}}>App Version</div>
              <div style={{fontSize:'12px',color:'var(--muted)'}}>Smash v1.1.0</div>
            </div>
            <div style={{padding:'16px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px'}}>
              <div style={{fontSize:'14px',fontWeight:'600',color:'var(--text)',marginBottom:'8px'}}>About</div>
              <div style={{fontSize:'12px',color:'var(--muted)',lineHeight:'1.6'}}>
                Smash is a Padel tournament tracker built for competitive players. Track your stats, compete on leaderboards, and dominate the courts! 🎾
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── WINNER POPUP ── */}
      {showWinner && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.92)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:'20px'}}>
          <div style={{background:'var(--s2)',borderRadius:'20px',padding:'40px 30px',maxWidth:'400px',width:'100%',textAlign:'center',border:'2px solid var(--gold)'}}>
            <div style={{fontSize:'32px',marginBottom:'16px'}}>🎉</div>
            <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'8px'}}>Session Over!</div>
            <div style={{fontSize:'48px',marginBottom:'16px'}}>🏆</div>
            <div style={{fontSize:'14px',color:'var(--muted)',marginBottom:'8px'}}>Winner</div>
            <div style={{fontSize:'32px',fontWeight:'700',color:'var(--gold)',marginBottom:'24px'}}>
              {sessionWinner?.name || 'Champion'}
            </div>

            {sessionStandings.length > 1 && (
              <div style={{marginBottom:'28px'}}>
                <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'12px',textTransform:'uppercase',letterSpacing:'1px'}}>Final Standings</div>
                {sessionStandings.slice(0, 5).map((p, i) => (
                  <div key={p._id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'rgba(255,255,255,0.05)',borderRadius:'10px',marginBottom:'6px'}}>
                    <span style={{fontSize:'14px',color: i === 0 ? 'var(--gold)' : 'var(--muted)',width:'20px'}}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span>
                    <span style={{flex:1,textAlign:'left',marginLeft:'10px',fontSize:'14px',color:'var(--text)',fontWeight: i === 0 ? '700' : '400'}}>
                      {p.name}
                      {p.isLocal && <span style={{fontSize:'10px',color:'var(--muted)',marginLeft:'6px'}}>GUEST</span>}
                    </span>
                    <span style={{fontSize:'15px',color: i === 0 ? 'var(--gold)' : 'var(--accent)',fontWeight:'600'}}>{p.sessionPts} pts</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setShowWinner(false);
                setSessionWinner(null);
                setActiveSession(null);
                setSelectedPlayers([]);
                setSessionName('');
                setMatchInputs({});
                setCustomPlayers([]);
                loadAllPlayers();
              }}
              style={{width:'100%',padding:'16px',background:'var(--accent)',border:'none',borderRadius:'12px',color:'#000',fontSize:'16px',fontWeight:'700',cursor:'pointer'}}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <div className="bnav">
        <button className={`bnav-btn ${tab==="home"?"active":""}`} onClick={()=>setTab("home")}>
          <span className="bnav-icon">🏠</span>
          <span className="bnav-label">HOME</span>
        </button>
        <button className={`bnav-btn ${tab==="play"?"active":""}`} onClick={()=>setTab("play")}>
          <span className="bnav-icon">⚡</span>
          <span className="bnav-label">PLAY</span>
        </button>
        <button className={`bnav-btn ${tab==="leaderboard"?"active":""}`} onClick={()=>setTab("leaderboard")}>
          <span className="bnav-icon">🏆</span>
          <span className="bnav-label">RANKS</span>
        </button>
        <button className={`bnav-btn ${tab==="profile"?"active":""}`} onClick={()=>setTab("profile")}>
          <span className="bnav-icon">👤</span>
          <span className="bnav-label">ME</span>
        </button>
        <button className={`bnav-btn ${tab==="settings"?"active":""}`} onClick={()=>setTab("settings")}>
          <span className="bnav-icon">⚙️</span>
          <span className="bnav-label">SETTINGS</span>
        </button>
      </div>
    </div>
  );
}

export default App;
