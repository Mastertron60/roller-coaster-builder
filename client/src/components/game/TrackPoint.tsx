import { useRef, useState, useEffect } from "react";
import { ThreeEvent, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRollerCoaster } from "@/lib/stores/useRollerCoaster";

interface TrackPointProps {
  id: string;
  position: THREE.Vector3;
  index: number;
}

export function TrackPoint({ id, position, index }: TrackPointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { selectedPointId, selectPoint, updateTrackPoint, mode } = useRollerCoaster();
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { gl } = useThree();
  
  const currentYRef = useRef(position.y);
  const positionRef = useRef({ x: position.x, z: position.z });
  
  useEffect(() => {
    currentYRef.current = position.y;
    positionRef.current = { x: position.x, z: position.z };
  }, [position.x, position.y, position.z]);
  
  const isSelected = selectedPointId === id;
  
  useEffect(() => {
    if (!isDragging) return;
    
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || mode !== "build") return;
      
      const deltaY = e.movementY * -0.1;
      const newY = Math.max(0.5, currentYRef.current + deltaY);
      currentYRef.current = newY;
      
      const newPos = new THREE.Vector3(positionRef.current.x, newY, positionRef.current.z);
      updateTrackPoint(id, newPos);
    };
    
    const handlePointerUp = () => {
      setIsDragging(false);
    };
    
    gl.domElement.addEventListener("pointermove", handlePointerMove);
    gl.domElement.addEventListener("pointerup", handlePointerUp);
    
    return () => {
      gl.domElement.removeEventListener("pointermove", handlePointerMove);
      gl.domElement.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, id, updateTrackPoint, mode, gl.domElement]);
  
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (mode !== "build") return;
    e.stopPropagation();
    setIsDragging(true);
    selectPoint(id);
  };
  
  if (mode === "ride") return null;
  
  return (
    <group>
      <mesh
        ref={meshRef}
        position={[position.x, position.y, position.z]}
        onPointerDown={handlePointerDown}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color={isSelected ? "#ff6600" : hovered ? "#ffaa00" : "#4488ff"}
          emissive={isSelected ? "#ff3300" : hovered ? "#ff6600" : "#000000"}
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}
