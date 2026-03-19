import React, { useState, useEffect } from 'react';
import './App.css';

const BACKEND = process.env.REACT_APP_BACKEND || 'http://localhost:3001';

function App() {
  const [tab, setTab] = useState('home');
  const [playerId, setPlayerId] = useState(localStorage.getItem('smash-playerId'));
  const [player, setPlayer] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [courts, setCourts] = useState(2);
  const [rounds, setRounds] = useState(7);
  const [pointsPerGame, setPointsPerGame] = useState(24);
  const [showWinner, setShowWinner] = useState(false);
  const [sessionWinner, setSessionWinner] = useState(null);

  useEffect(() => {
    if (playerId) {
      loadPlayer();
      loadAllPlayers();
      loadActiveSessions();
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

  const loadActiveSessions = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/sessions/active`);
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Error loading sessions:', err);
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

  const createSession = async () => {
    if (selectedPlayers.length < 4) {
      alert('Need at least 4 players');
      return;
    }

    try {
      const res = await fetch(`${BACKEND}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName: sessionName || 'Americano Session',
          format: 'Americano',
          courts,
          pointsPerGame,
          rounds,
          playerIds: selectedPlayers
        })
      });

      const data = await res.json();
      setActiveSession(data.session);
      setTab('play');
      alert('🎾 Session created!');
      loadActiveSessions();
    } catch (err) {
      alert('Error creating session: ' + err.message);
    }
  };

  const togglePlayerSelect = (id) => {
    if (selectedPlayers.includes(id)) {
      setSelectedPlayers(selectedPlayers.filter(p => p !== id));
    } else {
      setSelectedPlayers([...selectedPlayers, id]);
    }
  };

  const updateScore = async (matchIndex, score1, score2) => {
    if (!activeSession) return;

    try {
      const res = await fetch(`${BACKEND}/api/sessions/${activeSession._id}/match/${matchIndex}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score1, score2 })
      });

      const data = await res.json();
      setActiveSession(data.session);
      await loadPlayer();
      await loadAllPlayers();
      
      // Check if all matches completed - show winner!
      const allCompleted = data.session.matches.every(m => m.completed);
      if (allCompleted) {
        if (data.winner) setSessionWinner(data.winner);
        setTimeout(() => {
          setShowWinner(true);
        }, 800);
      }
    } catch (err) {
      alert('Error updating score: ' + err.message);
    }
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
            style={{
              width:'100%',
              maxWidth:'320px',
              padding:'16px',
              background:'var(--s2)',
              border:'1px solid var(--border)',
              borderRadius:'12px',
              color:'var(--text)',
              fontSize:'16px',
              marginBottom:'16px'
            }}
          />
          
          <input
            type="text"
            placeholder="Invite Code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            style={{
              width:'100%',
              maxWidth:'320px',
              padding:'16px',
              background:'var(--s2)',
              border:'1px solid var(--border)',
              borderRadius:'12px',
              color:'var(--text)',
              fontSize:'16px',
              marginBottom:'24px'
            }}
          />
          
          <button
            onClick={handleRegister}
            style={{
              width:'100%',
              maxWidth:'320px',
              padding:'16px',
              background:'var(--accent)',
              border:'none',
              borderRadius:'12px',
              color:'#000',
              fontSize:'16px',
              fontWeight:'700',
              cursor:'pointer'
            }}
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
              style={{
                width:'100%',
                padding:'20px',
                background:'linear-gradient(135deg, var(--accent) 0%, #00a087 100%)',
                border:'none',
                borderRadius:'12px',
                color:'#000',
                fontSize:'16px',
                fontWeight:'700',
                cursor:'pointer',
                marginBottom:'12px',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between'
              }}
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
              style={{
                width:'100%',
                padding:'20px',
                background:'var(--s2)',
                border:'1px solid var(--border)',
                borderRadius:'12px',
                color:'var(--text)',
                fontSize:'16px',
                fontWeight:'600',
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between'
              }}
            >
              <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                <span style={{fontSize:'24px'}}>🏆</span>
                <div>Leaderboard</div>
              </div>
              <span>→</span>
            </button>
          </div>
        )}

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
                  style={{
                    width:'100%',
                    padding:'16px',
                    background:'var(--s2)',
                    border:'1px solid var(--border)',
                    borderRadius:'12px',
                    color:'var(--text)',
                    fontSize:'15px',
                    marginBottom:'16px'
                  }}
                />

                <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',marginBottom:'12px'}}>POINTS PER GAME</div>
                <div style={{display:'flex',gap:'8px',marginBottom:'24px'}}>
                  {[16, 24, 32, 40].map(pts => (
                    <button
                      key={pts}
                      onClick={() => setPointsPerGame(pts)}
                      style={{
                        flex:1,
                        padding:'12px',
                        background: pointsPerGame === pts ? 'var(--accent)' : 'var(--s2)',
                        border: pointsPerGame === pts ? 'none' : '1px solid var(--border)',
                        borderRadius:'8px',
                        color: pointsPerGame === pts ? '#000' : 'var(--text)',
                        fontSize:'16px',
                        fontWeight:'700',
                        cursor:'pointer'
                      }}
                    >
                      {pts}
                    </button>
                  ))}
                </div>

                <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',marginBottom:'12px'}}>COURTS</div>
                <div style={{display:'flex',gap:'8px',marginBottom:'24px'}}>
                  {[1, 2, 3, 4].map(ct => (
                    <button
                      key={ct}
                      onClick={() => setCourts(ct)}
                      style={{
                        flex:1,
                        padding:'12px',
                        background: courts === ct ? 'var(--accent)' : 'var(--s2)',
                        border: courts === ct ? 'none' : '1px solid var(--border)',
                        borderRadius:'8px',
                        color: courts === ct ? '#000' : 'var(--text)',
                        fontSize:'16px',
                        fontWeight:'700',
                        cursor:'pointer'
                      }}
                    >
                      {ct}
                    </button>
                  ))}
                </div>

                <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',marginBottom:'12px'}}>ROUNDS</div>
                <div style={{display:'flex',gap:'8px',marginBottom:'24px'}}>
                  {[3, 5, 7, 10].map(rd => (
                    <button
                      key={rd}
                      onClick={() => setRounds(rd)}
                      style={{
                        flex:1,
                        padding:'12px',
                        background: rounds === rd ? 'var(--accent)' : 'var(--s2)',
                        border: rounds === rd ? 'none' : '1px solid var(--border)',
                        borderRadius:'8px',
                        color: rounds === rd ? '#000' : 'var(--text)',
                        fontSize:'16px',
                        fontWeight:'700',
                        cursor:'pointer'
                      }}
                    >
                      {rd}
                    </button>
                  ))}
                </div>

                <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',letterSpacing:'0.5px',marginBottom:'12px'}}>
                  PLAYERS • {selectedPlayers.length} SELECTED
                </div>

                <div style={{display:'grid',gridTemplateColumns:'repeat(2, 1fr)',gap:'12px',marginBottom:'24px'}}>
                  {allPlayers.map(p => (
                    <div
                      key={p._id}
                      onClick={() => togglePlayerSelect(p._id)}
                      style={{
                        padding:'16px',
                        background: selectedPlayers.includes(p._id) ? 'var(--accent)' : 'var(--s2)',
                        border: selectedPlayers.includes(p._id) ? 'none' : '1px solid var(--border)',
                        borderRadius:'12px',
                        cursor:'pointer',
                        display:'flex',
                        alignItems:'center',
                        gap:'12px'
                      }}
                    >
                      <div style={{
                        width:'40px',
                        height:'40px',
                        borderRadius:'50%',
                        background: p.avatar.color,
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        fontSize:'18px',
                        fontWeight:'700',
                        color:'#000'
                      }}>
                        {p.avatar.initial}
                      </div>
                      <div style={{fontSize:'14px',fontWeight:'600',color: selectedPlayers.includes(p._id) ? '#000' : 'var(--text)'}}>
                        {p.name}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={createSession}
                  disabled={selectedPlayers.length < 4}
                  style={{
                    width:'100%',
                    padding:'18px',
                    background: selectedPlayers.length >= 4 ? 'var(--accent)' : 'var(--s2)',
                    border:'none',
                    borderRadius:'12px',
                    color: selectedPlayers.length >= 4 ? '#000' : 'var(--muted)',
                    fontSize:'16px',
                    fontWeight:'700',
                    cursor: selectedPlayers.length >= 4 ? 'pointer' : 'not-allowed'
                  }}
                >
                  Start Session
                </button>
              </>
            ) : (
              <>
                <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'24px'}}>Live Session ⚡</div>

                {activeSession.matches.map((match, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding:'16px',
                      background: match.completed ? 'var(--s2)' : 'linear-gradient(135deg, var(--s2) 0%, rgba(0,201,167,0.1) 100%)',
                      border: match.completed ? '1px solid var(--border)' : '2px solid var(--accent)',
                      borderRadius:'12px',
                      marginBottom:'12px'
                    }}
                  >
                    <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'8px',fontWeight:'600',letterSpacing:'0.5px'}}>
                      ROUND {match.round} • COURT {match.court}
                    </div>

                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'13px',fontWeight:'600',color:'var(--text)',marginBottom:'4px'}}>
                          {allPlayers.find(p => p._id === match.team1[0])?.name || 'Player'} + {allPlayers.find(p => p._id === match.team1[1])?.name || 'Player'}
                        </div>
                      </div>
                      
                      {!match.completed ? (
                        <input
                          id={`score1-${idx}`}
                          type="number"
                          defaultValue={0}
                          onBlur={(e) => {
                            const score2 = parseInt(document.getElementById(`score2-${idx}`).value) || 0;
                            updateScore(idx, parseInt(e.target.value) || 0, score2);
                          }}
                          style={{
                            width:'60px',
                            padding:'8px',
                            background:'var(--bg)',
                            border:'1px solid var(--border)',
                            borderRadius:'8px',
                            color:'var(--text)',
                            fontSize:'16px',
                            textAlign:'center'
                          }}
                        />
                      ) : (
                        <div style={{fontSize:'24px',fontWeight:'700',color:'var(--accent)'}}>{match.score1}</div>
                      )}
                    </div>

                    <div style={{height:'1px',background:'var(--border)',margin:'12px 0'}}></div>

                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'13px',fontWeight:'600',color:'var(--text)',marginBottom:'4px'}}>
                          {allPlayers.find(p => p._id === match.team2[0])?.name || 'Player'} + {allPlayers.find(p => p._id === match.team2[1])?.name || 'Player'}
                        </div>
                      </div>
                      
                      {!match.completed ? (
                        <input
                          id={`score2-${idx}`}
                          type="number"
                          defaultValue={0}
                          onBlur={(e) => {
                            const score1 = parseInt(document.getElementById(`score1-${idx}`).value) || 0;
                            updateScore(idx, score1, parseInt(e.target.value) || 0);
                          }}
                          style={{
                            width:'60px',
                            padding:'8px',
                            background:'var(--bg)',
                            border:'1px solid var(--border)',
                            borderRadius:'8px',
                            color:'var(--text)',
                            fontSize:'16px',
                            textAlign:'center'
                          }}
                        />
                      ) : (
                        <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)'}}>{match.score2}</div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => {
                    setActiveSession(null);
                    setSelectedPlayers([]);
                  }}
                  style={{
                    width:'100%',
                    padding:'16px',
                    background:'var(--s2)',
                    border:'1px solid var(--border)',
                    borderRadius:'12px',
                    color:'var(--text)',
                    fontSize:'14px',
                    fontWeight:'600',
                    cursor:'pointer',
                    marginTop:'24px'
                  }}
                >
                  End Session
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'leaderboard' && (
          <div className="section">
            <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'24px'}}>🏆 Leaderboard</div>

            {allPlayers.length >= 3 && (
              <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:'8px',marginBottom:'32px'}}>
                <div style={{textAlign:'center',flex:1}}>
                  <div style={{
                    width:'80px',
                    height:'80px',
                    margin:'0 auto 8px',
                    borderRadius:'50%',
                    background: allPlayers[1]?.avatar.color,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    fontSize:'32px',
                    fontWeight:'700',
                    color:'#000',
                    border:'3px solid #C0C0C0'
                  }}>
                    {allPlayers[1]?.avatar.initial}
                  </div>
                  <div style={{fontSize:'14px',fontWeight:'600',color:'var(--text)',marginBottom:'4px'}}>
                    {allPlayers[1]?.name}
                  </div>
                  <div style={{fontSize:'24px',fontWeight:'700',color:'var(--accent)'}}>
                    {allPlayers[1]?.stats.totalPoints}
                  </div>
                  <div style={{fontSize:'12px',color:'var(--muted)'}}>2nd</div>
                </div>

                <div style={{textAlign:'center',flex:1}}>
                  <div style={{fontSize:'32px',marginBottom:'8px'}}>👑</div>
                  <div style={{
                    width:'100px',
                    height:'100px',
                    margin:'0 auto 8px',
                    borderRadius:'50%',
                    background: allPlayers[0]?.avatar.color,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    fontSize:'40px',
                    fontWeight:'700',
                    color:'#000',
                    border:'4px solid var(--gold)'
                  }}>
                    {allPlayers[0]?.avatar.initial}
                  </div>
                  <div style={{fontSize:'16px',fontWeight:'700',color:'var(--text)',marginBottom:'4px'}}>
                    {allPlayers[0]?.name}
                  </div>
                  <div style={{fontSize:'28px',fontWeight:'700',color:'var(--gold)'}}>
                    {allPlayers[0]?.stats.totalPoints}
                  </div>
                  <div style={{fontSize:'12px',color:'var(--gold)'}}>1st</div>
                </div>

                <div style={{textAlign:'center',flex:1}}>
                  <div style={{
                    width:'80px',
                    height:'80px',
                    margin:'0 auto 8px',
                    borderRadius:'50%',
                    background: allPlayers[2]?.avatar.color,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    fontSize:'32px',
                    fontWeight:'700',
                    color:'#000',
                    border:'3px solid #CD7F32'
                  }}>
                    {allPlayers[2]?.avatar.initial}
                  </div>
                  <div style={{fontSize:'14px',fontWeight:'600',color:'var(--text)',marginBottom:'4px'}}>
                    {allPlayers[2]?.name}
                  </div>
                  <div style={{fontSize:'24px',fontWeight:'700',color:'var(--accent)'}}>
                    {allPlayers[2]?.stats.totalPoints}
                  </div>
                  <div style={{fontSize:'12px',color:'var(--muted)'}}>3rd</div>
                </div>
              </div>
            )}

            <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',letterSpacing:'0.5px',marginBottom:'12px'}}>
              ALL RANKINGS
            </div>

            {allPlayers.map((p, idx) => (
              <div
                key={p._id}
                style={{
                  padding:'16px',
                  background: p._id === playerId ? 'rgba(0,201,167,0.1)' : 'var(--s2)',
                  border: p._id === playerId ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius:'12px',
                  marginBottom:'8px',
                  display:'flex',
                  alignItems:'center',
                  gap:'12px'
                }}
              >
                <div style={{fontSize:'18px',fontWeight:'700',color:'var(--muted)',width:'30px'}}>
                  {idx + 1}
                </div>

                <div style={{
                  width:'48px',
                  height:'48px',
                  borderRadius:'50%',
                  background: p.avatar.color,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  fontSize:'20px',
                  fontWeight:'700',
                  color:'#000'
                }}>
                  {p.avatar.initial}
                </div>

                <div style={{flex:1}}>
                  <div style={{fontSize:'15px',fontWeight:'600',color:'var(--text)',marginBottom:'4px'}}>
                    {p.name} {p._id === playerId && '⭐'}
                  </div>
                  <div style={{fontSize:'12px',color:'var(--muted)'}}>
                    {p.stats.wins}W • {p.stats.losses}L
                  </div>
                </div>

                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'20px',fontWeight:'700',color:'var(--accent)'}}>
                    {p.stats.totalPoints}
                  </div>
                  <div style={{fontSize:'11px',color:'var(--muted)'}}>
                    {p.stats.winRate}% WR
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'profile' && player && (
          <div className="section">
            <div style={{textAlign:'center',marginBottom:'32px'}}>
              <div style={{
                width:'120px',
                height:'120px',
                margin:'0 auto 16px',
                borderRadius:'50%',
                background: player.avatar.color,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                fontSize:'48px',
                fontWeight:'700',
                color:'#000'
              }}>
                {player.avatar.initial}
              </div>
              <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'8px'}}>
                {player.name}
              </div>
              <div style={{fontSize:'14px',color:'var(--muted)'}}>
                Member since {new Date(player.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div style={{fontSize:'12px',fontWeight:'700',color:'var(--muted)',letterSpacing:'0.5px',marginBottom:'12px'}}>
              STATISTICS
            </div>

            <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'16px'}}>
                <span style={{color:'var(--text)'}}>Games Played</span>
                <span style={{fontWeight:'700',color:'var(--accent)'}}>{player.stats.played}</span>
              </div>
              
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'16px'}}>
                <span style={{color:'var(--text)'}}>Wins</span>
                <span style={{fontWeight:'700',color:'var(--accent)'}}>{player.stats.wins}</span>
              </div>
              
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'16px'}}>
                <span style={{color:'var(--text)'}}>Losses</span>
                <span style={{fontWeight:'700',color:'var(--text)'}}>{player.stats.losses}</span>
              </div>
              
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'16px'}}>
                <span style={{color:'var(--text)'}}>Win Rate</span>
                <span style={{fontWeight:'700',color:'var(--gold)'}}>{player.stats.winRate}%</span>
              </div>
              
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{color:'var(--text)'}}>Total Points</span>
                <span style={{fontWeight:'700',color:'var(--accent)'}}>{player.stats.totalPoints}</span>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('smash-playerId');
                setPlayerId(null);
                setPlayer(null);
              }}
              style={{
                width:'100%',
                padding:'16px',
                background:'transparent',
                border:'1px solid var(--danger)',
                borderRadius:'12px',
                color:'var(--danger)',
                fontSize:'14px',
                fontWeight:'600',
                cursor:'pointer'
              }}
            >
              Sign Out
            </button>
          </div>
        )}

        {tab === 'settings' && (
          <div className="section">
            <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'24px'}}>⚙️ Settings</div>
            
            <div style={{padding:'16px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px',marginBottom:'16px'}}>
              <div style={{fontSize:'14px',fontWeight:'600',color:'var(--text)',marginBottom:'8px'}}>
                App Version
              </div>
              <div style={{fontSize:'12px',color:'var(--muted)'}}>
                Smash v1.0.0
              </div>
            </div>

            <div style={{padding:'16px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:'12px'}}>
              <div style={{fontSize:'14px',fontWeight:'600',color:'var(--text)',marginBottom:'8px'}}>
                About
              </div>
              <div style={{fontSize:'12px',color:'var(--muted)',lineHeight:'1.6'}}>
                Smash is a Padel tournament tracker built for competitive players. Track your stats, compete on leaderboards, and dominate the courts! 🎾
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Winner Popup */}
      {showWinner && allPlayers.length > 0 && (
        <div style={{
          position:'fixed',
          top:0,
          left:0,
          right:0,
          bottom:0,
          background:'rgba(0,0,0,0.9)',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          zIndex:2000,
          padding:'20px'
        }}>
          <div style={{
            background:'var(--s2)',
            borderRadius:'20px',
            padding:'40px 30px',
            maxWidth:'400px',
            width:'100%',
            textAlign:'center',
            border:'2px solid var(--gold)'
          }}>
            <div style={{fontSize:'32px',marginBottom:'16px'}}>🎉</div>
            <div style={{fontSize:'24px',fontWeight:'700',color:'var(--text)',marginBottom:'8px'}}>
              Congratulations!
            </div>
            <div style={{fontSize:'48px',marginBottom:'16px'}}>🏆</div>
            <div style={{fontSize:'14px',color:'var(--muted)',marginBottom:'8px'}}>Winner</div>
            <div style={{fontSize:'32px',fontWeight:'700',color:'var(--gold)',marginBottom:'24px'}}>
              {sessionWinner?.name || allPlayers[0]?.name}
            </div>
            {(() => {
              const ids = activeSession?.players || [];
              const top3 = allPlayers.filter(p => ids.includes(p._id)).slice(0, 3);
              return top3.length > 1 ? (
                <div style={{marginBottom:'28px'}}>
                  <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'12px',textTransform:'uppercase',letterSpacing:'1px'}}>Top Players</div>
                  {top3.map((p, i) => (
                    <div key={p._id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'var(--s1)',borderRadius:'10px',marginBottom:'6px'}}>
                      <span style={{fontSize:'14px',color:'var(--muted)',width:'20px'}}>#{i+1}</span>
                      <span style={{flex:1,textAlign:'left',marginLeft:'8px',fontSize:'14px',color:'var(--text)',fontWeight: i===0?'700':'400'}}>{p.name}</span>
                      <span style={{fontSize:'14px',color:'var(--gold)',fontWeight:'600'}}>{p.stats.totalPoints}pts</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
            
            <button
              onClick={() => {
                setShowWinner(false);
                setSessionWinner(null);
                setActiveSession(null);
                setSelectedPlayers([]);
                setSessionName('');
              }}
              style={{
                width:'100%',
                padding:'16px',
                background:'var(--accent)',
                border:'none',
                borderRadius:'12px',
                color:'#000',
                fontSize:'16px',
                fontWeight:'700',
                cursor:'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

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
