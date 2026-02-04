
import React, { useEffect, useRef } from 'react';
import { SeasonalEffectType } from '../types';

interface ParticleBackgroundProps {
  effect?: SeasonalEffectType;
}

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ effect = 'nebula' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: any[] = [];
    let width = window.innerWidth;
    let height = window.innerHeight;

    // --- BASE CLASSES ---

    class BaseParticle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      color: string;
      rotation: number;
      rotationSpeed: number;
      
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = 0;
        this.speedX = 0;
        this.speedY = 0;
        this.opacity = 1;
        this.color = '#fff';
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 2;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        
        // Wrap
        if (this.y > height + 20) { this.y = -20; this.x = Math.random() * width; }
        if (this.y < -20) { this.y = height + 20; this.x = Math.random() * width; }
        if (this.x > width + 20) { this.x = -20; }
        if (this.x < -20) { this.x = width + 20; }
      }

      draw() {}
    }

    class EmojiParticle extends BaseParticle {
      emoji: string;
      
      constructor(emojis: string[]) {
        super();
        this.emoji = emojis[Math.floor(Math.random() * emojis.length)];
        this.size = Math.random() * 20 + 10;
        this.speedY = Math.random() * 1 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.5 + 0.3;
      }

      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.globalAlpha = this.opacity;
        ctx.font = `${this.size}px serif`;
        ctx.fillText(this.emoji, -this.size/2, -this.size/2);
        ctx.restore();
      }
    }

    // --- SPECIFIC EFFECTS ---

    // 1. NEBULA (Original)
    class NebulaParticle extends BaseParticle {
      constructor() {
        super();
        this.size = Math.random() * 2 + 0.5;
        this.speedY = Math.random() * 0.5 + 0.2;
        this.speedX = (Math.random() - 0.5) * 0.2;
        this.opacity = Math.random() * 0.5 + 0.1;
        const colors = ['#ff8800', '#ffaa00', '#ffcc00', '#ff6600', '#a855f7'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    class Meteor {
      x: number; y: number; length: number; speed: number; angle: number; opacity: number; dead: boolean;
      constructor() {
        this.x = Math.random() * width + width * 0.5;
        this.y = Math.random() * height * 0.5 - 100;
        this.length = Math.random() * 80 + 20;
        this.speed = Math.random() * 10 + 15;
        this.angle = Math.PI / 4 + (Math.random() - 0.5) * 0.2;
        this.opacity = 1;
        this.dead = false;
      }
      update() {
        this.x -= Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.opacity -= 0.01;
        if (this.opacity <= 0) this.dead = true;
      }
      draw() {
        if (!ctx) return;
        const tailX = this.x + Math.cos(this.angle) * this.length;
        const tailY = this.y - Math.sin(this.angle) * this.length;
        const gradient = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        gradient.addColorStop(0, 'rgba(255, 200, 100, 1)');
        gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = gradient; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // 2. SNOW (Winter)
    class SnowParticle extends BaseParticle {
      shape: string;

      constructor() {
        super();
        const shapes = ['❄', '❅', '❆', '•']; 
        this.shape = shapes[Math.floor(Math.random() * shapes.length)];
        this.size = Math.random() * 20 + 12; 
        this.speedY = Math.random() * 1.5 + 0.5; 
        this.speedX = (Math.random() - 0.5) * 1.5;
        this.opacity = Math.random() * 0.6 + 0.2;
      }
      
      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `${this.size}px sans-serif`;
        ctx.fillText(this.shape, -this.size/2, -this.size/2);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // 3. FIREWORKS (New Year - Enhanced)
    class FireworkParticle {
      x: number; y: number; vx: number; vy: number; 
      alpha: number; color: string; decay: number;
      
      constructor(x: number, y: number, color: string) {
        this.x = x; 
        this.y = y;
        
        // Explosão radial
        const angle = Math.random() * Math.PI * 2;
        // Velocidade variável para criar profundidade
        const speed = Math.random() * 5 + 2; 
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.alpha = 1;
        this.color = color;
        // Taxa de decaimento aleatória para alguns sumirem antes
        this.decay = Math.random() * 0.015 + 0.005; 
      }

      update() {
        // Atrito (ar) desacelera a partícula
        this.vx *= 0.96;
        this.vy *= 0.96;
        
        // Gravidade puxa levemente para baixo
        this.vy += 0.04;
        
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
      }

      draw() {
        if (!ctx || this.alpha <= 0) return;
        
        ctx.save();
        ctx.globalCompositeOperation = 'lighter'; // Faz as cores brilharem ao se sobrepor
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        
        // Desenha um "rastro" baseado na velocidade
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        // O rastro é o inverso da velocidade (onde ele estava)
        ctx.lineTo(this.x - this.vx * 3, this.y - this.vy * 3);
        ctx.stroke();
        
        ctx.restore();
      }
    }

    // 4. RAIN (Matrix / Spring Rain)
    class RainParticle extends BaseParticle {
      constructor() {
        super();
        this.y = Math.random() * height - height;
        this.speedY = Math.random() * 10 + 15; // Fast
        this.size = Math.random() * 15 + 10; // Length
        this.opacity = Math.random() * 0.3 + 0.1;
      }
      update() {
        this.y += this.speedY;
        if (this.y > height) { this.y = -20; this.x = Math.random() * width; }
      }
      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + this.size);
        ctx.strokeStyle = effect === 'matrix' ? '#0f0' : '#4a90e2';
        ctx.lineWidth = 1;
        ctx.globalAlpha = this.opacity;
        ctx.stroke();
      }
    }

    // --- INIT LOGIC ---

    let meteors: Meteor[] = [];
    let fireworks: FireworkParticle[] = [];
    let lastFireworkTime = 0;

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      particles = [];
      fireworks = [];
      meteors = [];

      const count = window.innerWidth < 768 ? 30 : 60;

      for (let i = 0; i < count; i++) {
        switch (effect) {
          case 'snow':
            particles.push(new SnowParticle());
            break;
          case 'leaves':
            particles.push(new EmojiParticle(['🍂', '🍁', '🌰', '🌾']));
            break;
          case 'halloween':
            particles.push(new EmojiParticle(['🎃', '👻', '🕸️', '🦇', '💀']));
            break;
          case 'valentine':
            particles.push(new EmojiParticle(['❤️', '💖', '💘', '💋']));
            break;
          case 'easter':
            particles.push(new EmojiParticle(['🐰', '🥚', '🐇', '🐣', '🌷']));
            break;
          case 'summer':
             particles.push(new EmojiParticle(['☀️', '🥥', '🌊', '🕶️', '🌴']));
             break;
          case 'rain':
          case 'matrix':
             particles.push(new RainParticle());
             // Add more for rain
             particles.push(new RainParticle());
             break;
          case 'nebula':
          default:
            particles.push(new NebulaParticle());
            break;
        }
      }
    };

    const animate = (time: number) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Regular Particles (Nebula, Snow, Rain, Emojis)
      particles.forEach(p => {
        p.update();
        p.draw();
      });

      // 2. Effect Specific Logic
      
      // NEBULA Meteors
      if (effect === 'nebula') {
         if (Math.random() < 0.005) meteors.push(new Meteor());
         meteors = meteors.filter(m => !m.dead);
         meteors.forEach(m => { m.update(); m.draw(); });
      }

      // FIREWORKS
      if (effect === 'fireworks') {
        // Lançar novos fogos aleatoriamente
        if (time - lastFireworkTime > (Math.random() * 500 + 300)) { // Frequência mais rápida
           const x = Math.random() * (width * 0.8) + (width * 0.1); // Margem de segurança
           const y = Math.random() * (height * 0.6) + (height * 0.1); // Mais para cima
           
           // Cores vibrantes estilo a imagem (Dourado, Ciano, Vermelho, Magenta)
           const colors = ['#FFD700', '#FF0040', '#00FFFF', '#FF00FF', '#FFA500'];
           const color = colors[Math.floor(Math.random() * colors.length)];
           
           // Criar muitas partículas para uma explosão cheia
           for (let i = 0; i < 80; i++) {
              fireworks.push(new FireworkParticle(x, y, color));
           }
           lastFireworkTime = time;
        }
        
        // Atualizar e desenhar
        fireworks = fireworks.filter(p => p.alpha > 0);
        fireworks.forEach(f => { f.update(); f.draw(); });
      }

      // MATRIX Glitch (Overlay)
      if (effect === 'matrix') {
        ctx.fillStyle = 'rgba(0, 20, 0, 0.1)'; // Trail
        ctx.fillRect(0,0,width,height);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => { init(); };

    window.addEventListener('resize', handleResize);
    init();
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [effect]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: effect === 'matrix' ? 'normal' : 'screen' }}
    />
  );
};

export default ParticleBackground;
