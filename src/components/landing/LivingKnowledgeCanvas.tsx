import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function LivingKnowledgeCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Central Core Mesh
    const coreGeo = new THREE.OctahedronGeometry(1.0, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    mainGroup.add(coreMesh);

    // Inner glowing core
    const innerGeo = new THREE.SphereGeometry(0.6, 24, 24);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.6,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    mainGroup.add(innerMesh);

    // Curved Data Flow Lines (Left -> Core -> Right)
    const curveLinesGroup = new THREE.Group();
    mainGroup.add(curveLinesGroup);

    const inputPoints = [
      new THREE.Vector3(-4, 1.5, 0),
      new THREE.Vector3(-4, 0.5, 0.5),
      new THREE.Vector3(-4, -0.5, -0.5),
      new THREE.Vector3(-4, -1.5, 0),
    ];

    const outputPoints = [
      new THREE.Vector3(4, 1.5, 0),
      new THREE.Vector3(4, 0.5, -0.5),
      new THREE.Vector3(4, -0.5, 0.5),
      new THREE.Vector3(4, -1.5, 0),
    ];

    const pulses: { mesh: THREE.Mesh; path: THREE.CatmullRomCurve3; speed: number; progress: number }[] = [];

    inputPoints.forEach((inPt) => {
      const curve = new THREE.CatmullRomCurve3([
        inPt,
        new THREE.Vector3(-1.8, inPt.y * 0.5, 0.5),
        new THREE.Vector3(0, 0, 0),
      ]);

      const points = curve.getPoints(50);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.2,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      curveLinesGroup.add(line);

      // Pulse
      const pulseGeo = new THREE.SphereGeometry(0.06, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      curveLinesGroup.add(pulseMesh);

      pulses.push({
        mesh: pulseMesh,
        path: curve,
        speed: 0.006 + Math.random() * 0.004,
        progress: Math.random(),
      });
    });

    outputPoints.forEach((outPt) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1.8, outPt.y * 0.5, -0.5),
        outPt,
      ]);

      const points = curve.getPoints(50);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x818cf8,
        transparent: true,
        opacity: 0.2,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      curveLinesGroup.add(line);

      // Pulse
      const pulseGeo = new THREE.SphereGeometry(0.06, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      curveLinesGroup.add(pulseMesh);

      pulses.push({
        mesh: pulseMesh,
        path: curve,
        speed: 0.006 + Math.random() * 0.004,
        progress: Math.random(),
      });
    });

    // Ambient Orbiting Particles
    const particleCount = isMobile ? 60 : 180;
    const particleGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const r = 1.2 + Math.random() * 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x2dd4bf,
      size: 0.035,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    mainGroup.add(particles);

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        coreMesh.rotation.y = elapsedTime * 0.2;
        coreMesh.rotation.x = elapsedTime * 0.1;
        innerMesh.rotation.y = -elapsedTime * 0.3;

        particles.rotation.y = elapsedTime * 0.08;

        // Animate pulses along bezier paths
        pulses.forEach((p) => {
          p.progress += p.speed;
          if (p.progress > 1) p.progress = 0;
          const posVec = p.path.getPoint(p.progress);
          p.mesh.position.copy(posVec);
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      coreGeo.dispose();
      coreMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full min-h-[300px] sm:min-h-[400px] relative flex items-center justify-center pointer-events-auto"
    />
  );
}
