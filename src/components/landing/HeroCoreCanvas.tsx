import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface NeuralNode {
  base: THREE.Vector3;
  phase: number;
}

interface TravellingSignal {
  mesh: THREE.Mesh;
  from: number;
  to: number;
  progress: number;
  speed: number;
}

interface HeroCoreCanvasProps {
  onHoverChange?: (hovered: boolean) => void;
  /** Hex color (e.g. '#22d3ee') of the source card currently hovered outside
   * the canvas, or null when none is. Drives the "energy entering the core"
   * reaction — a source card's connection line lighting up should visibly
   * feed the core, not just animate in isolation. */
  activeSourceColor?: string | null;
}

export function HeroCoreCanvas({ onHoverChange, activeSourceColor }: HeroCoreCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const externalEnergyRef = useRef<{ active: boolean; color: THREE.Color }>({
    active: false,
    color: new THREE.Color(0x7dd3fc),
  });

  useEffect(() => {
    externalEnergyRef.current.active = Boolean(activeSourceColor);
    if (activeSourceColor) externalEnergyRef.current.color.set(activeSourceColor);
  }, [activeSourceColor]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const mobile = window.innerWidth < 768;
    let width = Math.max(1, container.clientWidth);
    let height = Math.max(1, container.clientHeight);
    let inView = true;
    let pageVisible = document.visibilityState === 'visible';
    let frame = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    // ~25% larger apparent core: pulling the camera in (rather than scaling
    // geometry) keeps every radius/edge-length constant used below correct.
    camera.position.z = mobile ? 6.5 : 5.8;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !mobile,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.6));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const system = new THREE.Group();
    scene.add(system);

    const coreGeometry = new THREE.IcosahedronGeometry(1.08, mobile ? 2 : 3);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    system.add(core);

    const innerGeometry = new THREE.SphereGeometry(0.6, 28, 28);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerCore = new THREE.Mesh(innerGeometry, innerMaterial);
    system.add(innerCore);

    const haloGeometry = new THREE.SphereGeometry(1.38, 24, 24);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.04,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    system.add(halo);

    const nodeCount = mobile ? 34 : 64;
    const nodes: NeuralNode[] = [];
    const nodePositions = new Float32Array(nodeCount * 3);
    const nodeColors = new Float32Array(nodeCount * 3);
    const nodeInfluence = new Float32Array(nodeCount);
    const nodeBaseColor = new THREE.Color(0x7dd3fc);
    const nodeHighlightColor = new THREE.Color(0xe0f2fe);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < nodeCount; index += 1) {
      const y = 1 - (index / Math.max(1, nodeCount - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = goldenAngle * index;
      const base = new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius,
      ).multiplyScalar(1.55 + (index % 4) * 0.035);
      nodes.push({ base, phase: index * 0.61 });
      base.toArray(nodePositions, index * 3);
      nodeBaseColor.toArray(nodeColors, index * 3);
    }

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(nodePositions, 3),
    );
    nodeGeometry.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));
    const nodeMaterial = new THREE.PointsMaterial({
      size: mobile ? 0.055 : 0.065,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nodeCloud = new THREE.Points(nodeGeometry, nodeMaterial);
    system.add(nodeCloud);

    // A sparser outer shell of smaller, dimmer "dust" nodes — pure depth
    // filler with its own slow independent drift, giving the core more
    // dimensionality without touching the edge/signal graph below.
    const dustCount = mobile ? 26 : 52;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let index = 0; index < dustCount; index += 1) {
      const y = 1 - (index / Math.max(1, dustCount - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const angle = goldenAngle * index * 1.31 + 1.4;
      const shell = 1.7 + (index % 5) * 0.075;
      dustPositions[index * 3] = Math.cos(angle) * radius * shell;
      dustPositions[index * 3 + 1] = y * shell;
      dustPositions[index * 3 + 2] = Math.sin(angle) * radius * shell;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: mobile ? 0.024 : 0.03,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustCloud = new THREE.Points(dustGeometry, dustMaterial);
    system.add(dustCloud);

    const edgePairs: Array<[number, number]> = [];
    for (let first = 0; first < nodeCount; first += 1) {
      const neighbors = nodes
        .map((node, second) => ({
          second,
          distance: nodes[first].base.distanceTo(node.base),
        }))
        .filter(({ second }) => second !== first)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, mobile ? 2 : 3);
      neighbors.forEach(({ second }) => {
        const pair: [number, number] =
          first < second ? [first, second] : [second, first];
        if (
          !edgePairs.some(
            ([from, to]) => from === pair[0] && to === pair[1],
          )
        ) {
          edgePairs.push(pair);
        }
      });
    }

    const edgePositions = new Float32Array(edgePairs.length * 6);
    const edgeColors = new Float32Array(edgePairs.length * 6);
    const edgeBaseColor = new THREE.Color(0x0ea5e9);
    const edgeHighlightColor = new THREE.Color(0x67e8f9);
    edgePairs.forEach((_, index) => {
      edgeBaseColor.toArray(edgeColors, index * 6);
      edgeBaseColor.toArray(edgeColors, index * 6 + 3);
    });
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(edgePositions, 3),
    );
    edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
    const edgeMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.26,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    system.add(edges);

    const signalGeometry = new THREE.SphereGeometry(
      mobile ? 0.035 : 0.045,
      8,
      8,
    );
    const signals: TravellingSignal[] = Array.from(
      { length: mobile ? 6 : 12 },
      (_, index) => {
        const pair = edgePairs[(index * 7) % edgePairs.length];
        const material = new THREE.MeshBasicMaterial({
          color: index % 3 === 0 ? 0x67e8f9 : 0x7dd3fc,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(signalGeometry, material);
        system.add(mesh);
        return {
          mesh,
          from: pair[0],
          to: pair[1],
          progress: (index * 0.17) % 1,
          speed: 0.0018 + (index % 5) * 0.00025,
        };
      },
    );

    let hoverTarget = 0;
    let hoverAmount = 0;
    let coreIsHovered = false;
    let pointerActive = false;
    const pointerNdc = new THREE.Vector2(10, 10);
    const setCoreHovered = (hovered: boolean) => {
      if (coreIsHovered === hovered) return;
      coreIsHovered = hovered;
      hoverTarget = hovered ? 1 : 0;
      onHoverChange?.(hovered);
    };
    const onCoreMove = (event: PointerEvent) => {
      if (mobile || reducedMotion) return;
      const rect = container.getBoundingClientRect();
      pointerNdc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      pointerActive = true;
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const hoverRadius = Math.min(rect.width, rect.height) * 0.28;
      setCoreHovered(Math.hypot(dx, dy) <= hoverRadius);
    };
    const onCoreLeave = () => {
      pointerActive = false;
      pointerNdc.set(10, 10);
      setCoreHovered(false);
    };
    container.addEventListener('pointermove', onCoreMove, { passive: true });
    container.addEventListener('pointerleave', onCoreLeave, { passive: true });

    const updateGeometry = (time: number) => {
      nodes.forEach((node, index) => {
        const breath =
          1 +
          Math.sin(time * (0.42 + (index % 5) * 0.017) + node.phase) * 0.035;
        nodePositions[index * 3] = node.base.x * breath;
        nodePositions[index * 3 + 1] = node.base.y * breath;
        nodePositions[index * 3 + 2] = node.base.z * breath;
      });
      (nodeGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

      edgePairs.forEach(([from, to], index) => {
        edgePositions[index * 6] = nodePositions[from * 3];
        edgePositions[index * 6 + 1] = nodePositions[from * 3 + 1];
        edgePositions[index * 6 + 2] = nodePositions[from * 3 + 2];
        edgePositions[index * 6 + 3] = nodePositions[to * 3];
        edgePositions[index * 6 + 4] = nodePositions[to * 3 + 1];
        edgePositions[index * 6 + 5] = nodePositions[to * 3 + 2];
      });
      (edgeGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    };

    const projectedNode = new THREE.Vector3();
    const mixedColor = new THREE.Color();
    const updateProximityColors = () => {
      nodes.forEach((_, index) => {
        projectedNode
          .set(
            nodePositions[index * 3],
            nodePositions[index * 3 + 1],
            nodePositions[index * 3 + 2],
          )
          .applyMatrix4(nodeCloud.matrixWorld)
          .project(camera);
        const distance = Math.hypot(
          projectedNode.x - pointerNdc.x,
          projectedNode.y - pointerNdc.y,
        );
        const influence = pointerActive ? Math.max(0, 1 - distance / 0.42) : 0;
        nodeInfluence[index] = influence;
        // Subtle Z-depth: nodes projected further from the camera read a
        // touch dimmer, giving the cloud dimensionality instead of a flat
        // wall of identical points.
        const depthFactor = THREE.MathUtils.clamp(
          THREE.MathUtils.mapLinear(projectedNode.z, -0.35, 0.35, 1, 0.55),
          0.5,
          1,
        );
        mixedColor.copy(nodeBaseColor).lerp(nodeHighlightColor, influence).multiplyScalar(depthFactor);
        mixedColor.toArray(nodeColors, index * 3);
      });

      edgePairs.forEach(([from, to], index) => {
        const influence = Math.max(nodeInfluence[from], nodeInfluence[to]);
        mixedColor.copy(edgeBaseColor).lerp(edgeHighlightColor, influence * 0.9);
        mixedColor.toArray(edgeColors, index * 6);
        mixedColor.toArray(edgeColors, index * 6 + 3);
      });
      (nodeGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (edgeGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    };

    const haloBaseColor = new THREE.Color(0x0ea5e9);
    const haloWorkingColor = new THREE.Color();
    let parallaxX = 0;
    let parallaxZ = 0;

    const clock = new THREE.Clock();
    const render = () => {
      if (!inView || !pageVisible) return;
      const elapsed = clock.getElapsedTime();
      updateGeometry(elapsed);

      if (!reducedMotion) {
        const externalEnergy = externalEnergyRef.current;
        // A source card hovered outside the canvas feeds the core exactly
        // like hovering the core directly — whichever signal is stronger
        // wins, so the two never fight each other.
        const effectiveHoverTarget = Math.max(hoverTarget, externalEnergy.active ? 0.9 : 0);
        hoverAmount += (effectiveHoverTarget - hoverAmount) * 0.055;
        const activity = 1 + hoverAmount * 0.85;
        core.rotation.y += 0.00215 * activity;
        core.rotation.z += 0.0009 * activity;
        nodeCloud.rotation.y -= 0.00058 * activity;
        dustCloud.rotation.y += 0.00032 * activity;
        dustCloud.rotation.x = Math.sin(elapsed * 0.09) * 0.05;
        edges.rotation.y = nodeCloud.rotation.y;

        // Mild perspective/parallax: the whole system tilts a touch toward
        // the pointer instead of only the node-color proximity effect.
        const targetParallaxX = pointerActive ? -pointerNdc.y * 0.05 : 0;
        const targetParallaxZ = pointerActive ? pointerNdc.x * 0.06 : 0;
        parallaxX += (targetParallaxX - parallaxX) * 0.04;
        parallaxZ += (targetParallaxZ - parallaxZ) * 0.04;
        system.rotation.x = parallaxX;
        system.rotation.z = parallaxZ;

        const breath = 1 + Math.sin(elapsed * 0.72) * 0.045;
        innerCore.scale.setScalar(breath);
        halo.scale.setScalar(1 + Math.sin(elapsed * 0.41 + 1.2) * 0.07);
        haloMaterial.opacity = 0.035 + Math.sin(elapsed * 0.53) * 0.012 + hoverAmount * 0.09;
        haloWorkingColor.copy(haloBaseColor).lerp(externalEnergy.color, externalEnergy.active ? hoverAmount : 0);
        haloMaterial.color.copy(haloWorkingColor);
        dustMaterial.opacity = 0.28 + Math.sin(elapsed * 0.6) * 0.06 + hoverAmount * 0.12;
        nodeMaterial.opacity = 0.9 + hoverAmount * 0.1;

        signals.forEach((signal, index) => {
          signal.progress += signal.speed * activity * (1 + Math.sin(elapsed * 0.3 + index) * 0.15);
          if (signal.progress >= 1) {
            signal.progress = 0;
            const pair =
              edgePairs[
                Math.floor(
                  Math.abs(Math.sin(elapsed * 0.37 + index * 2.1)) *
                    edgePairs.length,
                ) % edgePairs.length
              ];
            signal.from = pair[0];
            signal.to = pair[1];
          }
          const fromOffset = signal.from * 3;
          const toOffset = signal.to * 3;
          signal.mesh.position.set(
            nodePositions[fromOffset] +
              (nodePositions[toOffset] - nodePositions[fromOffset]) *
                signal.progress,
            nodePositions[fromOffset + 1] +
              (nodePositions[toOffset + 1] - nodePositions[fromOffset + 1]) *
                signal.progress,
            nodePositions[fromOffset + 2] +
              (nodePositions[toOffset + 2] - nodePositions[fromOffset + 2]) *
                signal.progress,
          );
        });
      }

      system.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      updateProximityColors();

      renderer.render(scene, camera);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(() => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (reducedMotion) render();
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView && pageVisible && !reducedMotion) {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(render);
        }
      },
      { rootMargin: '120px' },
    );
    intersectionObserver.observe(container);

    const handleVisibility = () => {
      pageVisible = document.visibilityState === 'visible';
      if (pageVisible && inView && !reducedMotion) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    if (reducedMotion) render();
    else frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      container.removeEventListener('pointermove', onCoreMove);
      container.removeEventListener('pointerleave', onCoreLeave);
      renderer.domElement.remove();
      coreGeometry.dispose();
      coreMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      signalGeometry.dispose();
      signals.forEach(({ mesh }) => {
        (mesh.material as THREE.Material).dispose();
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="relative flex h-full min-h-[300px] w-full items-center justify-center sm:min-h-[370px] lg:min-h-[410px]"
    />
  );
}
