import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRollerCoaster } from "@/lib/stores/useRollerCoaster";
import { Line } from "@react-three/drei";

export function Track() {
  const { trackPoints, isLooped } = useRollerCoaster();
  const tubeRef = useRef<THREE.Mesh>(null);
  
  const { curve, railPoints, supportPositions } = useMemo(() => {
    if (trackPoints.length < 2) {
      return { curve: null, railPoints: [], supportPositions: [] };
    }
    
    const points = trackPoints.map((p) => p.position.clone());
    
    const curve = new THREE.CatmullRomCurve3(points, isLooped, "catmullrom", 0.5);
    
    const railPoints: THREE.Vector3[] = [];
    const numSamples = Math.max(trackPoints.length * 20, 100);
    
    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      railPoints.push(curve.getPoint(t));
    }
    
    const supportPositions: THREE.Vector3[] = [];
    const supportInterval = Math.floor(numSamples / Math.min(trackPoints.length * 2, 20));
    
    for (let i = 0; i <= numSamples; i += supportInterval) {
      const t = i / numSamples;
      const point = curve.getPoint(t);
      if (point.y > 0.5) {
        supportPositions.push(point.clone());
      }
    }
    
    return { curve, railPoints, supportPositions };
  }, [trackPoints, isLooped]);
  
  if (!curve || railPoints.length < 2) {
    return null;
  }
  
  const leftRail: [number, number, number][] = [];
  const rightRail: [number, number, number][] = [];
  const railOffset = 0.3;
  
  for (let i = 0; i < railPoints.length; i++) {
    const point = railPoints[i];
    const tangent = curve.getTangent(i / (railPoints.length - 1));
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    
    leftRail.push([
      point.x + normal.x * railOffset,
      point.y,
      point.z + normal.z * railOffset,
    ]);
    rightRail.push([
      point.x - normal.x * railOffset,
      point.y,
      point.z - normal.z * railOffset,
    ]);
  }
  
  return (
    <group>
      <Line
        points={leftRail}
        color="#ff4444"
        lineWidth={4}
      />
      <Line
        points={rightRail}
        color="#ff4444"
        lineWidth={4}
      />
      
      {supportPositions.map((pos, i) => (
        <mesh key={i} position={[pos.x, pos.y / 2, pos.z]}>
          <cylinderGeometry args={[0.1, 0.15, pos.y, 8]} />
          <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      
      {railPoints.filter((_, i) => i % 5 === 0).map((point, i) => {
        const t = (i * 5) / (railPoints.length - 1);
        const tangent = curve.getTangent(Math.min(t, 1));
        const angle = Math.atan2(tangent.x, tangent.z);
        
        return (
          <mesh
            key={i}
            position={[point.x, point.y - 0.1, point.z]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[1.2, 0.1, 0.15]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        );
      })}
    </group>
  );
}

export function getTrackCurve(trackPoints: { position: THREE.Vector3 }[], isLooped: boolean = false) {
  if (trackPoints.length < 2) return null;
  const points = trackPoints.map((p) => p.position.clone());
  return new THREE.CatmullRomCurve3(points, isLooped, "catmullrom", 0.5);
}
