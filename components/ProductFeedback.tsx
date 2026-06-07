// 产品反馈组件 - 基于产品思维（模块7）
// 核心原则：用户是最好的老师，反馈渠道比数据重要
'use client';

import { useState, useCallback } from 'react';

type FeedbackType = 'idea' | 'bug' | 'like' | 'dislike' | 'other';

const FEEDBACK_TYPES: { key: FeedbackType; label: string; emoji: string }[] = [
  { key: 'like', label: '喜欢这个', emoji: '👍' },
  { key: 'idea', label: '想要的功能', emoji: '💡' },
  { key: 'bug', label: '遇到问题', emoji: '🐛' },
  { key: 'dislike', label: '不好用', emoji: '😕' },
  { key: 'other', label: '其他', emoji: '💬' },
];

export default function ProductFeedback() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [minimized, setMinimized] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;
    setStatus('sending');
    
    try {
      // 上报到服务端Analytics API
      const res = await fetch('/api/analytics/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          message: message.trim(),
          email: email.trim() || undefined,
          page: window.location.pathname,
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (res.ok) {
        setStatus('sent');
        setTimeout(() => {
          setIsOpen(false);
          setStatus('idle');
          setMessage('');
          setEmail('');
        }, 2000);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [feedbackType, message, email]);

  return (
    <>
      {/* Floating feedback button */}
      <button
        onClick={() => { setIsOpen(true); setMinimized(false); }}
        className="fixed bottom-4 right-4 z-50 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 
          text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 
          w-12 h-12 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 sm:rounded-xl
          flex items-center justify-center gap-1.5 text-sm font-medium cursor-pointer"
        title="给产品提建议"
      >
        <span className="text-lg">💬</span>
        <span className="hidden sm:inline">反馈</span>
      </button>

      {/* Feedback modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className={`relative bg-white w-full sm:max-w-md sm:rounded-2xl sm:shadow-2xl 
            rounded-t-2xl shadow-xl animate-slide-up
            ${minimized ? 'h-16 overflow-hidden' : ''}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <h3 className="font-bold text-gray-800 text-sm">给产品提建议</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(!minimized)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  {minimized ? '⬆' : '⬇'}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {!minimized && (
              <div className="p-5">
                {status === 'sent' ? (
                  <div className="text-center py-8">
                    <span className="text-4xl block mb-3">🎉</span>
                    <p className="text-gray-700 font-medium">感谢反馈！</p>
                    <p className="text-gray-400 text-sm mt-1">每条反馈我们都会认真看</p>
                  </div>
                ) : (
                  <>
                    {/* Feedback type selector */}
                    <div className="grid grid-cols-5 gap-1.5 mb-4">
                      {FEEDBACK_TYPES.map((ft) => (
                        <button
                          key={ft.key}
                          onClick={() => setFeedbackType(ft.key)}
                          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs transition-all cursor-pointer ${
                            feedbackType === ft.key
                              ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-400'
                              : 'bg-gray-50 text-gray-500 hover:bg-gray-100 active:scale-95'
                          }`}
                        >
                          <span className="text-lg">{ft.emoji}</span>
                          <span className="text-[10px] leading-tight text-center">{ft.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Message */}
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        feedbackType === 'like' ? '喜欢哪里？想看到什么改进？' :
                        feedbackType === 'idea' ? '想要什么新功能？什么场景下需要？' :
                        feedbackType === 'bug' ? '遇到什么问题了？步骤是？' :
                        feedbackType === 'dislike' ? '哪里不好用？怎么改会更好？' :
                        '说说你的想法...'
                      }
                      className="w-full p-3 border border-gray-200 rounded-xl text-sm 
                        focus:ring-2 focus:ring-teal-500 focus:border-teal-500 
                        outline-none transition resize-none bg-gray-50"
                      rows={3}
                      maxLength={1000}
                      disabled={status === 'sending'}
                    />

                    {/* Email (optional) */}
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="留下邮箱，方便我们回复你（选填）"
                      className="w-full mt-2 p-3 border border-gray-200 rounded-xl text-sm 
                        focus:ring-2 focus:ring-teal-500 focus:border-teal-500 
                        outline-none transition bg-gray-50"
                      disabled={status === 'sending'}
                    />

                    {/* Submit */}
                    <button
                      onClick={handleSubmit}
                      disabled={!message.trim() || status === 'sending'}
                      className={`mt-3 w-full py-3 rounded-xl text-white font-medium text-sm transition-all cursor-pointer ${
                        !message.trim() || status === 'sending'
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-teal-600 hover:bg-teal-700 active:scale-[0.98] shadow-sm'
                      }`}
                    >
                      {status === 'sending' ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          发送中...
                        </span>
                      ) : '提交反馈 💬'}
                    </button>

                    {status === 'error' && (
                      <p className="mt-2 text-xs text-red-500 text-center">发送失败，请稍后再试</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
