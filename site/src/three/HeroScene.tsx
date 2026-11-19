import { ContactShadows, RoundedBox } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useLang } from '../i18n';
import { drawTodayTexture } from './screenTexture';

/**
 * Cena do hero: um telemóvel com o ecrã «Hoje» (desenhado em canvas) pousado numa secretária de caderno,
 * com folhas pautadas e post-its em papel. Inclina com o ponteiro e roda um pouco com o scroll.
 */

const PALETTE = {
  light: { paper: '#FFFDF7', paper2: '#F6EFE2', line: '#E6DFD3', margin: '#F1A897', phone: '#141312' },
  dark: { paper: '#24211C', paper2: '#1E1C18', line: '#3A342C', margin: '#7A3A2C', phone: '#0B0A09' },
};

function linedTexture(bg: string, line: string, margin: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 680;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = line;
  g.lineWidth = 2;
  for (let y = 90; y < c.height; y += 34) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(c.width, y);
    g.stroke();
  }
  g.strokeStyle = margin;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(70, 0);
  g.lineTo(70, c.height);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Sheet({ position, rotation, color, line, margin }: {
  position: [number, number, number];
  rotation: number;
  color: string;
  line: string;
  margin: string;
}) {
  const tex = useMemo(() => linedTexture(color, line, margin), [color, line, margin]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]} receiveShadow>
      <planeGeometry args={[3.0, 4.0]} />
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  );
}

function StickyNote({ position, color, phase, rot }: { position: [number, number, number]; color: string; phase: number; rot: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + phase;
    ref.current.position.y = position[1] + Math.sin(t * 0.9) * 0.06;
    ref.current.rotation.z = rot + Math.sin(t * 0.6) * 0.05;
    ref.current.rotation.x = -0.25 + Math.cos(t * 0.7) * 0.04;
  });
  return (
    <mesh ref={ref} position={position} castShadow>
      <boxGeometry args={[0.7, 0.7, 0.02]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}

/** Textura do ecrã «Hoje», redesenhada quando muda a língua ou o tema. */
function useScreenTexture(dark: boolean) {
  const { copy } = useLang();
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let alive = true;
    let made: THREE.CanvasTexture | null = null;
    document.fonts.ready.then(() => {
      if (!alive) return;
      made = drawTodayTexture(copy, dark);
      setTex(made);
    });
    return () => {
      alive = false;
      made?.dispose();
    };
  }, [copy, dark]);
  return tex;
}

function Phone({ dark, screen }: { dark: boolean; screen: THREE.Texture | null }) {
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  const scroll = useRef(0);

  useEffect(() => {
    const on = () => {
      scroll.current = Math.min(window.scrollY / window.innerHeight, 1);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const k = 1 - Math.pow(0.002, dt);
    const targetY = -0.3 + pointer.x * 0.26 + scroll.current * 0.5;
    const targetX = -0.1 - pointer.y * 0.14 + scroll.current * 0.18;
    g.rotation.y += (targetY - g.rotation.y) * k;
    g.rotation.x += (targetX - g.rotation.x) * k;
    g.rotation.z = 0.05 + Math.sin(t * 0.5) * 0.015;
    g.position.y = 0.2 + Math.sin(t * 0.8) * 0.05 - scroll.current * 0.4;
  });

  const p = dark ? PALETTE.dark : PALETTE.light;
  return (
    <group ref={group} position={[0.1, 0.25, 0]} scale={0.96}>
      <RoundedBox args={[2.05, 4.25, 0.2]} radius={0.24} smoothness={6} castShadow>
        <meshStandardMaterial color={p.phone} roughness={0.35} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0, 0.102]}>
        <planeGeometry args={[1.86, 3.93]} />
        {screen ? (
          <meshBasicMaterial map={screen} transparent toneMapped={false} />
        ) : (
          <meshBasicMaterial color={dark ? '#141311' : '#FAF8F2'} toneMapped={false} />
        )}
      </mesh>
      <mesh position={[0, 1.79, 0.104]}>
        <planeGeometry args={[0.55, 0.13]} />
        <meshBasicMaterial color="#0B0A09" />
      </mesh>
    </group>
  );
}

function Desk({ dark }: { dark: boolean }) {
  const p = dark ? PALETTE.dark : PALETTE.light;
  return (
    <group position={[0, -1.75, 0]}>
      <Sheet position={[-0.95, 0, -0.7]} rotation={0.24} color={p.paper2} line={p.line} margin={p.margin} />
      <Sheet position={[0.85, 0.005, -0.3]} rotation={-0.14} color={p.paper} line={p.line} margin={p.margin} />
      <ContactShadows position={[0, 0.02, 0]} opacity={dark ? 0.6 : 0.3} scale={8} blur={2.6} far={4} />
    </group>
  );
}

export default function HeroScene({ label, onReady }: { label: string; onReady?: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const screen = useScreenTexture(dark);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    const mo = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  const notes = dark ? ['#352D14', '#17312B', '#192A3D', '#382317'] : ['#FCE99F', '#BCEEE0', '#C4E0FD', '#FAD6BA'];

  return (
    <div
      ref={wrap}
      role="img"
      aria-label={label}
      className="absolute inset-0 [mask-image:radial-gradient(ellipse_75%_70%_at_50%_50%,black_62%,transparent_100%)]"
    >
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.75]}
        shadows
        camera={{ position: [0, 1.7, 8.4], fov: 36 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, -0.25, 0);
          requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()));
        }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={dark ? 0.55 : 0.85} />
        <directionalLight position={[3, 6, 5]} intensity={dark ? 1.1 : 1.6} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-4, 2, 3]} intensity={0.35} color="#FCE99F" />
        <Desk dark={dark} />
        <StickyNote position={[-1.95, 1.35, -0.4]} color={notes[0]} phase={0} rot={0.18} />
        <StickyNote position={[1.95, 1.6, -0.8]} color={notes[1]} phase={1.7} rot={-0.22} />
        <StickyNote position={[-1.75, -0.7, 0.3]} color={notes[2]} phase={3.1} rot={-0.1} />
        <StickyNote position={[1.85, -0.45, 0.2]} color={notes[3]} phase={4.4} rot={0.25} />
        <Phone dark={dark} screen={screen} />
      </Canvas>
    </div>
  );
}
