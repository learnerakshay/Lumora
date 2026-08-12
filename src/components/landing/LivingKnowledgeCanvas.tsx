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
    camera.position.z = isMobile ? 7.2 : 6.4;

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
    const flowGeometries: THREE.BufferGeometry[] = [];
    const flowMaterials: THREE.Material[] = [];
    const inputLineMaterials: THREE.LineBasicMaterial[] = [];
    const outputLineMaterials: THREE.LineBasicMaterial[] = [];

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

    inputPoints.forEach((inPt, inputIndex) => {
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
      inputLineMaterials[inputIndex] = lineMat;
      flowGeometries.push(lineGeo);
      flowMaterials.push(lineMat);
      const line = new THREE.Line(lineGeo, lineMat);
      curveLinesGroup.add(line);

      // Pulse
      const pulseGeo = new THREE.SphereGeometry(0.06, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      flowGeometries.push(pulseGeo);
      flowMaterials.push(pulseMat);
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      curveLinesGroup.add(pulseMesh);

      pulses.push({
        mesh: pulseMesh,
        path: curve,
        speed: 0.006 + Math.random() * 0.004,
        progress: Math.random(),
      });
    });

    outputPoints.forEach((outPt, outputIndex) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1.8, outPt.y * 0.5, -0.5),
        outPt,
      ]);

      const points = curve.getPoints(50);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.2,
      });
      outputLineMaterials[outputIndex] = lineMat;
      flowGeometries.push(lineGeo);
      flowMaterials.push(lineMat);
      const line = new THREE.Line(lineGeo, lineMat);
      curveLinesGroup.add(line);

      // Pulse
      const pulseGeo = new THREE.SphereGeometry(0.06, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
      flowGeometries.push(pulseGeo);
      flowMaterials.push(pulseMat);
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
    const particleCount = isMobile ? 48 : 190;
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

    const accentCount = isMobile ? 12 : 42;
    const accentPos = new Float32Array(accentCount * 3);
    for (let i = 0; i < accentCount; i++) {
      const r = 1.45 + Math.random() * 1.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      accentPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      accentPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      accentPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const accentGeo = new THREE.BufferGeometry();
    accentGeo.setAttribute('position', new THREE.BufferAttribute(accentPos, 3));
    const accentMat = new THREE.PointsMaterial({
      color: 0xa78bfa,
      size: isMobile ? 0.022 : 0.028,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const accentParticles = new THREE.Points(accentGeo, accentMat);
    mainGroup.add(accentParticles);

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

    let animationFrameId = 0;
    const clock = new THREE.Clock();
    let inView = true;
    let pageVisible = document.visibilityState === 'visible';

    const animate = () => {
      if (!inView || !pageVisible) return;
      const elapsedTime = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        coreMesh.rotation.y = elapsedTime * 0.2;
        coreMesh.rotation.x = elapsedTime * 0.1;
        innerMesh.rotation.y = -elapsedTime * 0.3;

        particles.rotation.y = elapsedTime * 0.08;
        particles.rotation.x = Math.sin(elapsedTime * 0.08) * 0.08;
        accentParticles.rotation.y = -elapsedTime * 0.045;
        accentParticles.rotation.z = Math.sin(elapsedTime * 0.06) * 0.09;
        const coreBreath = 1 + Math.sin(elapsedTime * 0.72) * 0.045;
        innerMesh.scale.setScalar(coreBreath);
        coreMat.opacity = 0.32 + Math.sin(elapsedTime * 0.43) * 0.08;
        inputLineMaterials.forEach((material) => {
          material.opacity = 0.2;
        });
        outputLineMaterials.forEach((material, index) => {
          material.opacity =
            0.18 + Math.max(0, Math.sin(elapsedTime * 0.9 - index * 0.65)) * 0.18;
        });

        // Animate pulses along bezier paths
        pulses.forEach((p) => {
          p.progress += p.speed;
          if (p.progress > 1) p.progress = 0;
          const posVec = p.path.getPoint(p.progress);
          p.mesh.position.copy(posVec);
        });
      }

      renderer.render(scene, camera);
      if (!prefersReducedMotion) animationFrameId = requestAnimationFrame(animate);
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView && pageVisible && !prefersReducedMotion) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = requestAnimationFrame(animate);
        }
      },
      { rootMargin: '120px' },
    );
    intersectionObserver.observe(container);

    const handleVisibility = () => {
      pageVisible = document.visibilityState === 'visible';
      if (pageVisible && inView && !prefersReducedMotion) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    if (prefersReducedMotion) animate();
    else animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      coreGeo.dispose();
      coreMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      accentGeo.dispose();
      accentMat.dispose();
      flowGeometries.forEach((geometry) => geometry.dispose());
      flowMaterials.forEach((material) => material.dispose());
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
