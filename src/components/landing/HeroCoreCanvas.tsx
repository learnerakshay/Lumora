import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Easing functions for smooth staggered animation
const easeOutBack = (x: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const easeOutCubic = (x: number): number => {
  return 1 - Math.pow(1 - x, 3);
};

const easeInOutQuad = (x: number): number => {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};

export function HeroCoreCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;

    // Dimensions
    let width = container.clientWidth;
    let height = container.clientHeight;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 7;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Group for Core & Charts
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // 1. Central Glowing Sphere
    const sphereGeo = new THREE.IcosahedronGeometry(1.2, 3);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.scale.setScalar(0);
    coreGroup.add(sphereMesh);

    // Inner Solid Core
    const innerGeo = new THREE.SphereGeometry(0.85, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.6,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.scale.setScalar(0);
    coreGroup.add(innerMesh);

    // Core point light
    const pointLight = new THREE.PointLight(0x38bdf8, 3, 10);
    scene.add(pointLight);

    // 2. Orbital Rings
    const ringCount = 3;
    const rings: THREE.Mesh[] = [];
    const ringTargetOpacities = [0.5, 0.4, 0.3];
    const ringRotations = [
      { x: 0.005, y: 0.008 },
      { x: -0.006, y: 0.004 },
      { x: 0.003, y: -0.007 },
    ];

    for (let i = 0; i < ringCount; i++) {
      const radius = 1.8 + i * 0.45;
      const tubeRadius = 0.012;
      const ringGeo = new THREE.TorusGeometry(radius, tubeRadius, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0x38bdf8 : i === 1 ? 0x818cf8 : 0x2dd4bf,
        transparent: true,
        opacity: 0,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / (3 + i);
      ringMesh.rotation.y = (Math.PI / 4) * i;
      ringMesh.scale.setScalar(0);
      coreGroup.add(ringMesh);
      rings.push(ringMesh);
    }

    // 3. Staggered Chart Drawing Lines & Network Nodes
    const chartConfigs = [
      {
        points: [
          new THREE.Vector3(-2.8, -1.2, 0.5),
          new THREE.Vector3(-1.8, 0.8, -0.4),
          new THREE.Vector3(0, 0.2, 1.0),
          new THREE.Vector3(1.6, 1.4, -0.2),
          new THREE.Vector3(2.6, -0.6, 0.8),
        ],
        color: 0x38bdf8,
        startTime: 0.2,
        duration: 1.1,
      },
      {
        points: [
          new THREE.Vector3(-2.2, 1.4, -0.6),
          new THREE.Vector3(-0.8, -1.3, 0.7),
          new THREE.Vector3(1.1, -1.5, -0.4),
          new THREE.Vector3(2.3, 0.9, 0.5),
        ],
        color: 0x2dd4bf,
        startTime: 0.5,
        duration: 1.1,
      },
      {
        points: [
          new THREE.Vector3(0, 2.3, -0.2),
          new THREE.Vector3(2.1, 0.1, -1.1),
          new THREE.Vector3(0.1, -2.2, 0.4),
          new THREE.Vector3(-2.1, 0, -0.9),
          new THREE.Vector3(0, 2.3, -0.2),
        ],
        color: 0x818cf8,
        startTime: 0.8,
        duration: 1.2,
      },
    ];

    interface ChartNodeData {
      mesh: THREE.Mesh;
      ringMesh: THREE.Mesh;
      revealTime: number;
      initialPos: THREE.Vector3;
    }

    const chartLines: {
      lineMesh: THREE.Line;
      geo: THREE.BufferGeometry;
      mat: THREE.LineBasicMaterial;
      totalPoints: number;
      startTime: number;
      duration: number;
    }[] = [];

    const chartNodes: ChartNodeData[] = [];

    const SEGMENTS_PER_LINE = 100;
    const nodeSphereGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const nodeRingGeo = new THREE.RingGeometry(0.1, 0.18, 32);

    chartConfigs.forEach((cfg) => {
      const curve = new THREE.CatmullRomCurve3(cfg.points);
      const curvePoints = curve.getPoints(SEGMENTS_PER_LINE);

      const geo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      geo.setDrawRange(0, 0); // Start with 0 points rendered

      const mat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.85,
        linewidth: 2,
      });

      const lineMesh = new THREE.Line(geo, mat);
      coreGroup.add(lineMesh);

      chartLines.push({
        lineMesh,
        geo,
        mat,
        totalPoints: curvePoints.length,
        startTime: cfg.startTime,
        duration: cfg.duration,
      });

      // Create nodes at each key control point
      cfg.points.forEach((pt, pIdx) => {
        // Node reveal time matches line progress reaching this vertex
        const vertexProgress = pIdx / (cfg.points.length - 1);
        const revealTime = cfg.startTime + vertexProgress * cfg.duration;

        const nodeMat = new THREE.MeshBasicMaterial({
          color: cfg.color,
          transparent: true,
          opacity: 0.95,
        });

        const nodeMesh = new THREE.Mesh(nodeSphereGeo, nodeMat);
        nodeMesh.position.copy(pt);
        nodeMesh.scale.setScalar(0);
        coreGroup.add(nodeMesh);

        const haloMat = new THREE.MeshBasicMaterial({
          color: cfg.color,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(nodeRingGeo, haloMat);
        ringMesh.position.copy(pt);
        ringMesh.scale.setScalar(0);
        coreGroup.add(ringMesh);

        chartNodes.push({
          mesh: nodeMesh,
          ringMesh,
          revealTime,
          initialPos: pt.clone(),
        });
      });
    });

    // 4. Floating Particles
    const particleCount = isMobile ? 80 : 250;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 2.2 + Math.random() * 2.5;

      particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = r * Math.cos(phi);

      particleScales[i] = Math.random();
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.04,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    coreGroup.add(particleSystem);

    // Parallax mouse target
    let targetX = 0;
    let targetY = 0;

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetX = x * 0.4;
      targetY = y * 0.4;
    };

    window.addEventListener('mousemove', onPointerMove);

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // --- Staggered Reveal Animation Pipeline ---
      if (!prefersReducedMotion) {
        // 1. Core Sphere Reveal (0.0s -> 0.7s)
        const coreProgress = Math.min(1, Math.max(0, elapsedTime / 0.7));
        const coreScale = easeOutBack(coreProgress);
        sphereMesh.scale.setScalar(coreScale);
        innerMesh.scale.setScalar(coreScale * (1 + Math.sin(elapsedTime * 1.5) * 0.04));

        // 2. Orbital Rings Reveal (Staggered 0.2s, 0.45s, 0.7s)
        rings.forEach((ring, idx) => {
          const startTime = 0.2 + idx * 0.25;
          const ringProgress = Math.min(1, Math.max(0, (elapsedTime - startTime) / 0.6));
          const ringScale = easeOutCubic(ringProgress);
          ring.scale.setScalar(ringScale);
          (ring.material as THREE.MeshBasicMaterial).opacity =
            ringProgress * ringTargetOpacities[idx];

          ring.rotation.x += ringRotations[idx].x;
          ring.rotation.y += ringRotations[idx].y;
        });

        // 3. Chart Drawing Reveal Process (Staggered Line Drawing)
        chartLines.forEach((line) => {
          const lineProgress = Math.min(
            1,
            Math.max(0, (elapsedTime - line.startTime) / line.duration)
          );
          const easedProg = easeInOutQuad(lineProgress);
          const drawCount = Math.floor(easedProg * line.totalPoints);
          line.geo.setDrawRange(0, drawCount);
        });

        // 4. Chart Nodes Reveal & Pulse Rings
        chartNodes.forEach((node) => {
          if (elapsedTime >= node.revealTime) {
            const nodeProgress = Math.min(1, Math.max(0, (elapsedTime - node.revealTime) / 0.4));
            const nodeScale = easeOutBack(nodeProgress);

            // Slight floating bounce
            const hoverY = Math.sin(elapsedTime * 2 + node.revealTime * 10) * 0.03;
            node.mesh.position.y = node.initialPos.y + hoverY;
            node.ringMesh.position.y = node.initialPos.y + hoverY;

            node.mesh.scale.setScalar(nodeScale);

            // Halo ripple effect upon reveal
            if (nodeProgress < 1) {
              const ringScale = nodeProgress * 2.2;
              node.ringMesh.scale.setScalar(ringScale);
              (node.ringMesh.material as THREE.MeshBasicMaterial).opacity =
                (1 - nodeProgress) * 0.8;
            } else {
              node.ringMesh.scale.setScalar(1);
              (node.ringMesh.material as THREE.MeshBasicMaterial).opacity = 0;
            }
          }
        });

        // 5. Particles Fade In (0.3s -> 1.5s)
        const particleProgress = Math.min(1, Math.max(0, (elapsedTime - 0.3) / 1.2));
        particleMat.opacity = particleProgress * 0.7;
        particleSystem.rotation.y = elapsedTime * 0.05;

        // Core parallax and continuous rotation
        coreGroup.rotation.y += (targetX - coreGroup.rotation.y) * 0.03;
        coreGroup.rotation.x += (-targetY - coreGroup.rotation.x) * 0.03;

        sphereMesh.rotation.y = elapsedTime * 0.15;
        sphereMesh.rotation.z = elapsedTime * 0.1;
        innerMesh.rotation.y = -elapsedTime * 0.2;
      } else {
        // Fallback for reduced motion: immediate display
        sphereMesh.scale.setScalar(1);
        innerMesh.scale.setScalar(1);
        rings.forEach((ring, idx) => {
          ring.scale.setScalar(1);
          (ring.material as THREE.MeshBasicMaterial).opacity = ringTargetOpacities[idx];
        });
        chartLines.forEach((line) => line.geo.setDrawRange(0, line.totalPoints));
        chartNodes.forEach((node) => node.mesh.scale.setScalar(1));
        particleMat.opacity = 0.7;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onPointerMove);
      resizeObserver.disconnect();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }

      // Dispose geometries & materials
      sphereGeo.dispose();
      sphereMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      nodeSphereGeo.dispose();
      nodeRingGeo.dispose();

      rings.forEach((r) => {
        r.geometry.dispose();
        (r.material as THREE.Material).dispose();
      });

      chartLines.forEach((cl) => {
        cl.geo.dispose();
        cl.mat.dispose();
      });

      chartNodes.forEach((cn) => {
        (cn.mesh.material as THREE.Material).dispose();
        (cn.ringMesh.material as THREE.Material).dispose();
      });

      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full min-h-[380px] sm:min-h-[480px] lg:min-h-[550px] relative flex items-center justify-center pointer-events-auto"
    />
  );
}

