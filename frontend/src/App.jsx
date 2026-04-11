import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Check, SkipForward, Loader2, Bot, 
  BrainCircuit, ChevronRight, Activity, Zap 
} from 'lucide-react';

export default function App() {
  const [task, setTask] = useState('');
  const [autoMode, setAutoMode] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, running, waiting, complete
  const [rounds, setRounds] = useState([]);
  
  const eventSourceRef = useRef(null);
  const scrollRef = useRef(null);

  // Auto-scroll to latest activity
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [rounds, status]);

  const startSession = async (e) => {
    e.preventDefault();
    if (!task) return;

    setRounds([]);
    setStatus('running');

    try {
      await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, auto_mode: autoMode })
      });
      
      initStream();
    } catch (err) {
      console.error("Start error:", err);
      setStatus('idle');
    }
  };

  const initStream = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    
    const sse = new EventSource('/api/stream');
    eventSourceRef.current = sse;

    sse.addEventListener('round_start', (e) => {
      const { round } = JSON.parse(e.data);
      setRounds(prev => [...prev, { number: round, agents: [], critic: null }]);
    });

    sse.addEventListener('agent_result', (e) => {
      const data = JSON.parse(e.data);
      setRounds(prev => {
        const last = [...prev];
        last[last.length - 1].agents.push(data);
        return last;
      });
    });

    sse.addEventListener('critic_result', (e) => {
      const data = JSON.parse(e.data);
      setRounds(prev => {
        const last = [...prev];
        last[last.length - 1].critic = data;
        return last;
      });
    });

    sse.addEventListener('waiting_for_approval', () => setStatus('waiting'));
    sse.addEventListener('session_complete', () => {
      setStatus('complete');
      sse.close();
    });
  };

  const handleAction = async (action) => {
    setStatus('running');
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 p-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <Zap className="fill-current" />
            <span>PerJentic</span>
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              status === 'running' ? 'bg-blue-100 text-blue-600 animate-pulse' : 
              status === 'waiting' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {status}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Input Area */}
        {status === 'idle' && (
          <section className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-4">Orchestrate a New Task</h2>
              <textarea 
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="What complex objective should the agents solve?"
                value={task}
                onChange={(e) => setTask(e.target.value)}
              />
              <div className="mt-6 flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-indigo-600"
                    checked={autoMode}
                    onChange={(e) => setAutoMode(e.target.checked)}
                  />
                  <span className="text-slate-600 group-hover:text-indigo-600 transition-colors">Enable Auto-Pilot Mode</span>
                </label>
                <button 
                  onClick={startSession}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  <Play size={20} /> Start Loop
                </button>
              </div>
            </div>
          </section>
        )}

        {/* The Round-by-Round Display */}
        <div className="space-y-12">
          {rounds.map((round) => (
            <div key={round.number} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-md">
                  {round.number}
                </div>
                <h3 className="text-xl font-bold text-slate-800">Iteration Round</h3>
                <div className="h-[2px] flex-1 bg-gradient-to-r from-indigo-100 to-transparent"></div>
              </div>

              {/* Agents Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {round.agents.map((agent, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2 font-semibold text-slate-700">
                      <Bot size={18} className="text-indigo-500" />
                      {agent.agent_name}
                    </div>
                    <div className="p-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {agent.output}
                    </div>
                  </div>
                ))}
              </div>

              {/* Critic Section */}
              {round.critic && (
                <div className="mt-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-white p-2 rounded-lg shadow-sm border border-indigo-100">
                      <BrainCircuit className="text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-indigo-900 mb-1">Critic Consensus</h4>
                      <p className="text-indigo-800 text-sm mb-4 leading-relaxed">{round.critic.summary}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/60 p-3 rounded-lg border border-indigo-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Improvement Directives</span>
                          <ul className="mt-2 space-y-1">
                            {round.critic.directives.map((d, idx) => (
                              <li key={idx} className="text-sm text-slate-700 flex gap-2">
                                <ChevronRight size={14} className="mt-1 text-indigo-500 shrink-0" /> {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </main>

      {/* Floating Action Bar */}
      {status === 'waiting' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 flex items-center gap-2 animate-bounce-subtle">
          <div className="px-6 py-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Awaiting Review</p>
            <p className="text-sm font-semibold text-slate-700">Approve next iteration?</p>
          </div>
          <button 
            onClick={() => handleAction('skip')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl hover:bg-slate-100 font-bold transition-colors text-slate-600"
          >
            <SkipForward size={18} /> Stop
          </button>
          <button 
            onClick={() => handleAction('approve')}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Check size={18} /> Continue
          </button>
        </div>
      )}
    </div>
  );
}