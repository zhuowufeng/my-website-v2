// app/login/page.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function LoginPage() {
  const [isAccountHover, setIsAccountHover] = useState(false);
  const [isPasswordFocus, setIsPasswordFocus] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  const canvasRefs = useRef([]);
  const animationRef = useRef(null);
  const randomMouthTimeoutRef = useRef(null);
  const [mouthShapes, setMouthShapes] = useState(['smile', 'smile', 'smile']);

  const randomMouths = ['smile', 'sad', 'tongue', 'circle', 'wave', 'flat'];

  const getCurrentMouthShape = (idx) => {
    if (isAccountHover) return 'focus';
    if (isPasswordFocus) return 'shy';
    return mouthShapes[idx] || 'smile';
  };

  const startRandomMouthTimer = useCallback(() => {
    if (randomMouthTimeoutRef.current) clearTimeout(randomMouthTimeoutRef.current);
    const updateRandom = () => {
      if (!isAccountHover && !isPasswordFocus) {
        setMouthShapes(prev => prev.map(() => randomMouths[Math.floor(Math.random() * randomMouths.length)]));
      }
      randomMouthTimeoutRef.current = setTimeout(updateRandom, 2000);
    };
    randomMouthTimeoutRef.current = setTimeout(updateRandom, 2000);
  }, [isAccountHover, isPasswordFocus]);

  useEffect(() => {
    startRandomMouthTimer();
    return () => {
      if (randomMouthTimeoutRef.current) clearTimeout(randomMouthTimeoutRef.current);
    };
  }, [startRandomMouthTimer]);

  useEffect(() => {
    const onMouseMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  const drawCharacter = (ctx, width, height, pupilScale, mouthType) => {
    const centerX = width / 2;
    const bodyY = height * 0.25;
    const bodyWidth = 60;
    const bodyHeight = 110;

    ctx.save();
    ctx.fillStyle = '#F4A261';
    ctx.beginPath();
    ctx.roundRect(centerX - bodyWidth / 2, bodyY, bodyWidth, bodyHeight, 30);
    ctx.fill();

    ctx.fillStyle = '#FDD7A4';
    ctx.beginPath();
    ctx.ellipse(centerX, bodyY + 25, 30, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    const eyeY = bodyY + 20;
    const leftEyeX = centerX - 18;
    const rightEyeX = centerX + 18;
    const eyeRadius = 10;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    let pupilSize = 6 * pupilScale;
    const getPupilPos = (eyeX, eyeY) => {
      if (isPasswordFocus) return { x: eyeX - 12, y: eyeY };
      let dx = mousePos.x - eyeX;
      let dy = mousePos.y - eyeY;
      const distance = Math.min(8, Math.hypot(dx, dy) / 10);
      const angle = Math.atan2(dy, dx);
      return { x: eyeX + Math.cos(angle) * distance, y: eyeY + Math.sin(angle) * distance };
    };

    const leftPupil = getPupilPos(leftEyeX, eyeY);
    const rightPupil = getPupilPos(rightEyeX, eyeY);
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(leftPupil.x, leftPupil.y, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightPupil.x, rightPupil.y, pupilSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(leftPupil.x - 2, leftPupil.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightPupil.x - 2, rightPupil.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    const mouthY = bodyY + 48;
    ctx.beginPath();
    ctx.strokeStyle = '#8B4513';
    ctx.fillStyle = '#8B4513';
    ctx.lineWidth = 3;

    switch (mouthType) {
      case 'smile': ctx.arc(centerX, mouthY - 2, 12, 0.1, Math.PI - 0.1); ctx.stroke(); break;
      case 'sad': ctx.arc(centerX, mouthY + 2, 12, Math.PI + 0.1, 2 * Math.PI - 0.1); ctx.stroke(); break;
      case 'tongue':
        ctx.arc(centerX, mouthY - 2, 8, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#FF6B6B';
        ctx.ellipse(centerX, mouthY + 4, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'circle':
        ctx.arc(centerX, mouthY, 9, 0, Math.PI * 2); ctx.fillStyle = '#8B4513'; ctx.fill();
        ctx.fillStyle = '#FFB6C1'; ctx.arc(centerX, mouthY, 6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'wave':
        for (let x = centerX - 12; x <= centerX + 12; x += 6) ctx.lineTo(x, mouthY + (x % 12 === 0 ? -3 : 3));
        ctx.stroke();
        break;
      case 'flat': ctx.moveTo(centerX - 12, mouthY); ctx.lineTo(centerX + 12, mouthY); ctx.stroke(); break;
      case 'focus':
        ctx.ellipse(centerX, mouthY - 2, 6, 9, 0, 0, Math.PI * 2); ctx.fillStyle = '#8B4513'; ctx.fill();
        ctx.fillStyle = '#FFB6C1'; ctx.ellipse(centerX, mouthY - 2, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'shy':
        for (let x = centerX - 12; x <= centerX + 12; x += 4) ctx.lineTo(x, mouthY + 2 + (x % 8 === 0 ? -2 : 2));
        ctx.stroke();
        break;
      default: break;
    }
    ctx.restore();
  };

  useEffect(() => {
    const animate = () => {
      for (let i = 0; i < canvasRefs.current.length; i++) {
        const canvas = canvasRefs.current[i];
        if (!canvas) continue;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const pupilScale = isAccountHover ? 1.6 : 1;
        const mouthShape = getCurrentMouthShape(i);
        drawCharacter(ctx, canvas.width, canvas.height, pupilScale, mouthShape);
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [mousePos, isAccountHover, isPasswordFocus, mouthShapes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(isLoginMode ? '登录成功！' : '注册成功！请登录');
        if (isLoginMode) {
          localStorage.setItem('user', JSON.stringify(data.user));
          window.location.href = '/dashboard';
        } else {
          setIsLoginMode(true);
          setPassword('');
        }
      } else {
        setMessage(data.error || '出错了');
      }
    } catch (err) {
      setMessage('网络错误，请稍后重试');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #2b3b4e, #1d2c38)', fontFamily: 'sans-serif' }}>
      <div style={{ width: '50%', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '20px' }}>
        {[0, 1, 2].map(idx => (
          <div key={idx} style={{ textAlign: 'center' }}>
            <canvas ref={el => canvasRefs.current[idx] = el} width={100} height={180} style={{ width: '100px', height: '180px', display: 'block' }} />
            <div style={{ marginTop: '8px', color: 'white', fontWeight: 'bold' }}>{idx === 0 ? '小淘气' : idx === 1 ? '小可爱' : '小聪明'}</div>
          </div>
        ))}
      </div>
      <div style={{ width: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '320px', background: 'rgba(255,255,255,0.95)', borderRadius: '50%', padding: '50px 30px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
          <h2 style={{ marginBottom: '30px', color: '#2c3e50' }}>{isLoginMode ? '登录' : '注册'}</h2>
          <form onSubmit={handleSubmit}>
            <input type="email" placeholder="邮箱" value={email} onChange={e => setEmail(e.target.value)} onMouseEnter={() => setIsAccountHover(true)} onMouseLeave={() => setIsAccountHover(false)} required style={{ width: '80%', padding: '12px', marginBottom: '25px', borderRadius: '40px', border: '1px solid #ccc', textAlign: 'center', fontSize: '16px', outline: 'none' }} />
            <input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setIsPasswordFocus(true)} onBlur={() => setIsPasswordFocus(false)} required style={{ width: '80%', padding: '12px', marginBottom: '30px', borderRadius: '40px', border: '1px solid #ccc', textAlign: 'center', fontSize: '16px', outline: 'none' }} />
            <button type="submit" style={{ background: '#e67e22', color: 'white', border: 'none', padding: '10px 30px', borderRadius: '40px', fontSize: '18px', cursor: 'pointer' }}>{isLoginMode ? '登录' : '注册'}</button>
          </form>
          <p style={{ marginTop: '20px', fontSize: '12px' }}>{isLoginMode ? '还没有账号？' : '已有账号？'}<a href="#" onClick={() => { setIsLoginMode(!isLoginMode); setMessage(''); }}>{isLoginMode ? '立即注册' : '去登录'}</a></p>
          {message && <p style={{ color: 'red', fontSize: '14px' }}>{message}</p>}
        </div>
      </div>
    </div>
  );
}

// roundRect 辅助方法 — client-side only
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.moveTo(x+r, y);
    this.lineTo(x+w-r, y);
    this.quadraticCurveTo(x+w, y, x+w, y+r);
    this.lineTo(x+w, y+h-r);
    this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    this.lineTo(x+r, y+h);
    this.quadraticCurveTo(x, y+h, x, y+h-r);
    this.lineTo(x, y+r);
    this.quadraticCurveTo(x, y, x+r, y);
    return this;
  };
}